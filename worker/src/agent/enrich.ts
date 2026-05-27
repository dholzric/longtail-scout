import type { Env } from "../index";
import type { Candidate, Citation, Operator } from "../types";
import { webUnlockerCached } from "../brightdata/webUnlocker";
import { serpSearchCached } from "../brightdata/serp";
import { demandLookup } from "../demand/client";
import type { SseEmitter } from "../stream";

type EnrichedPartial = Pick<Operator, "name" | "url" | "sources" | "about" | "size_estimate" | "hiring" | "recent_activity" | "demand_signal">;

function extractAbout(html: string): string | null {
  const meta = /<meta\s+name=["']description["']\s+content=["']([^"']{20,400})["']/i;
  const match = meta.exec(html);
  if (match) return match[1] ?? null;
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 400) || null;
}

function estimateSize(html: string): Operator["size_estimate"] {
  const t = html.toLowerCase();
  if (/\b(global|fortune|enterprise|thousands of employees|10,000\+|nasdaq|nyse)\b/.test(t)) return "100+";
  if (/\b(team of \d{2,3}|50\+ employees|growing team)\b/.test(t)) return "51-100";
  if (/\b(small team|boutique|family-owned|founded|startup|seed|series a)\b/.test(t)) return "11-50";
  return null;
}

function extractRoles(text: string): string[] {
  const roles = new Set<string>();
  const patterns = [/engineer/gi, /technician/gi, /machinist/gi, /developer/gi, /designer/gi, /manager/gi, /sales/gi, /operations/gi];
  for (const p of patterns) {
    for (const m of text.matchAll(p)) roles.add(m[0].toLowerCase());
  }
  return [...roles];
}

async function enrichOne(c: Candidate, env: Env, emit: SseEmitter): Promise<EnrichedPartial | null> {
  const bridge = { base: env.BRIDGE_BASE, token: env.BRIDGE_AUTH_TOKEN };
  const sources: Citation[] = [];

  let homepageHtml = "";
  try {
    const page = await webUnlockerCached(c.url, bridge, env.CACHE);
    homepageHtml = page.html;
    sources.push({ field: "about", tool: "bridge_render", url: c.url });
    await emit.emit("enrich", { name: c.name, field: "homepage", status: "ok" });
  } catch (err) {
    await emit.emit("enrich", { name: c.name, field: "homepage", status: "fail", error: (err as Error).message });
    return null;
  }

  const about = extractAbout(homepageHtml);
  const size_estimate = estimateSize(homepageHtml);

  // Hiring — first try on-page heuristic (free), then do a targeted SERP for "<name> careers" to find the careers page
  const hiring: Operator["hiring"] = { count: null, roles: [], source: null };
  const homeText = homepageHtml.toLowerCase();
  if (/we[\s']?re hiring|now hiring|join our team|careers|open positions|job openings/i.test(homeText)) {
    hiring.roles = extractRoles(homeText);
    hiring.count = hiring.roles.length || null;
    const careersMatch = /href=["']([^"']*(?:careers?|jobs)[^"']*)["']/i.exec(homepageHtml);
    if (careersMatch) {
      try {
        const careersUrl = new URL(careersMatch[1] ?? "", c.url).toString();
        hiring.source = careersUrl;
        sources.push({ field: "hiring", tool: "homepage_link", url: careersUrl });
      } catch { /* skip bad URL */ }
    }
  }
  // Augment with a SERP for "<name> careers" to catch external ATS pages
  try {
    const careersSerp = await serpSearchCached(`"${c.name}" careers OR hiring`, bridge, env.CACHE, { num: 5 });
    const hit = careersSerp.results.find(r => /career|jobs|hiring|greenhouse|lever|workday|ashby/i.test(r.link + r.title));
    if (hit) {
      hiring.source = hiring.source ?? hit.link;
      sources.push({ field: "hiring", tool: "bridge_serp", url: hit.link });
      // titles in SERP often contain role names — augment roles list
      const roles = new Set(hiring.roles);
      for (const r of careersSerp.results.slice(0, 3)) {
        for (const role of extractRoles(r.title)) roles.add(role);
      }
      hiring.roles = [...roles];
      hiring.count = hiring.roles.length || hiring.count;
    }
    await emit.emit("enrich", { name: c.name, field: "hiring", status: "ok", roles: hiring.roles.length });
  } catch (err) {
    await emit.emit("enrich", { name: c.name, field: "hiring", status: "fail", error: (err as Error).message.slice(0, 100) });
  }

  // Recent activity SERP — "<name> news" → top 3 headlines
  const recent_activity: Operator["recent_activity"] = [];
  try {
    const newsSerp = await serpSearchCached(`"${c.name}" news 2026`, bridge, env.CACHE, { num: 5 });
    for (const r of newsSerp.results.slice(0, 3)) {
      recent_activity.push({ headline: r.title, date: "", source: r.link });
      sources.push({ field: "recent_activity", tool: "bridge_serp", url: r.link });
    }
    await emit.emit("enrich", { name: c.name, field: "news", status: "ok", count: recent_activity.length });
  } catch (err) {
    await emit.emit("enrich", { name: c.name, field: "news", status: "fail", error: (err as Error).message.slice(0, 100) });
  }

  // Per-operator demand signal removed (was misusing the API — see synthesize.ts for niche-level demand context).
  return { name: c.name, url: c.url, sources, about, size_estimate, hiring, recent_activity, demand_signal: null };
}

async function pool<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      const item = items[idx]!;
      try {
        const value = await worker(item);
        results[idx] = { status: "fulfilled", value };
      } catch (reason) {
        results[idx] = { status: "rejected", reason };
      }
    }
  });
  await Promise.all(runners);
  return results;
}

export async function enrichCandidates(candidates: Candidate[], env: Env, emit: SseEmitter): Promise<EnrichedPartial[]> {
  await emit.emit("phase", { phase: "enrichment" });
  // Bright Data Browser API has a navigation/concurrency quota per session.
  // The bridge serializes requests via mutex + recycles browser every 6 navs.
  // Cap candidates so total BD calls (3 per candidate: homepage + careers SERP + news SERP) fit within the demo time window.
  const capped = candidates.slice(0, 6);
  const CONCURRENCY = 2; // worker-side concurrency; bridge mutex serializes anyway, but this paces SSE events nicely
  await emit.emit("progress", { message: `Enriching ${capped.length} candidates (${CONCURRENCY} at a time)…` });

  const settled = await pool(capped, CONCURRENCY, c => enrichOne(c, env, emit));
  const out: EnrichedPartial[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled" && r.value) out.push(r.value);
  }
  await emit.emit("progress", { message: `Enriched ${out.length} of ${capped.length}.` });
  return out;
}
