import type { Env } from "../index";
import type { Candidate, Citation, Operator } from "../types";
import { webUnlockerCached } from "../brightdata/webUnlocker";
import { demandLookup } from "../demand/client";
import { geocode } from "../geocode/nominatim";
import type { SseEmitter } from "../stream";
import type { CostTally } from "../cost";

type EnrichedPartial = Pick<Operator, "name" | "url" | "sources" | "about" | "size_estimate" | "hiring" | "recent_activity" | "demand_signal" | "geo" | "memory">;

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

async function enrichOne(c: Candidate, env: Env, emit: SseEmitter, tally?: CostTally): Promise<EnrichedPartial | null> {
  const bridge = { base: env.BRIDGE_BASE, token: env.BRIDGE_AUTH_TOKEN };
  const sources: Citation[] = [];

  let homepageHtml = "";
  try {
    const page = await webUnlockerCached(c.url, bridge, env.CACHE);
    if (tally) tally.bd_renders += 1;
    homepageHtml = page.html;
    sources.push({ field: "about", tool: "bridge_render", url: c.url });
    await emit.emit("enrich", { name: c.name, field: "homepage", status: "ok" });
  } catch (err) {
    await emit.emit("enrich", { name: c.name, field: "homepage", status: "fail", error: (err as Error).message });
    return null;
  }

  const about = extractAbout(homepageHtml);
  const size_estimate = estimateSize(homepageHtml);

  // Hiring — on-page heuristic only (no extra google.com hits which trigger BD per-domain cooldown).
  // We look for "hiring" keywords + a careers/jobs link on the homepage HTML.
  const hiring: Operator["hiring"] = { count: null, roles: [], source: null };
  const homeText = homepageHtml.toLowerCase();
  if (/we[\s']?re hiring|now hiring|join our team|careers|open positions|job openings|join us|we are growing/i.test(homeText)) {
    hiring.roles = extractRoles(homeText);
    hiring.count = hiring.roles.length || null;
    const careersMatch = /href=["']([^"']*(?:careers?|jobs|join-us|we-are-hiring)[^"']*)["']/i.exec(homepageHtml);
    if (careersMatch) {
      try {
        const careersUrl = new URL(careersMatch[1] ?? "", c.url).toString();
        hiring.source = careersUrl;
        sources.push({ field: "hiring", tool: "homepage_link", url: careersUrl });
      } catch { /* skip bad URL */ }
    }
  }
  await emit.emit("enrich", { name: c.name, field: "hiring", status: "ok", roles: hiring.roles.length });

  // Recent activity — derived from on-page press/blog links. No google.com hit.
  const recent_activity: Operator["recent_activity"] = [];
  const pressLinkMatches = homepageHtml.matchAll(/<a[^>]+href=["']([^"']*(?:news|press|blog|media)[^"']*)["'][^>]*>([^<]{8,120})<\/a>/gi);
  const seenPress = new Set<string>();
  for (const m of pressLinkMatches) {
    if (recent_activity.length >= 3) break;
    const href = m[1] ?? "";
    const text = (m[2] ?? "").trim().replace(/\s+/g, " ");
    if (!text || /^read more$|^learn more$|^view all$|^news$|^press$/i.test(text)) continue;
    try {
      const url = new URL(href, c.url).toString();
      if (seenPress.has(url)) continue;
      seenPress.add(url);
      recent_activity.push({ headline: text, date: "", source: url });
      sources.push({ field: "recent_activity", tool: "homepage_link", url });
    } catch { /* skip */ }
  }
  await emit.emit("enrich", { name: c.name, field: "press", status: "ok", count: recent_activity.length });

  // Geocode via local Nominatim (unlimited, no API key). Use "<operator name> <city>" as the search query.
  let geo: Operator["geo"] = null;
  if (env.NOMINATIM_BASE) {
    try {
      // Extract city from the candidate's origin_query if available, otherwise nothing.
      const cityHint = (c.origin_query.match(/\b(in|near|around)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/) ?? [])[2] ?? "";
      const q = `${c.name}${cityHint ? " " + cityHint : ""}`;
      const g = await geocode(q, env.NOMINATIM_BASE, env.CACHE);
      if (g) {
        geo = g;
        sources.push({ field: "geo", tool: "nominatim", url: `${env.NOMINATIM_BASE}/search?q=${encodeURIComponent(q)}` });
      }
      await emit.emit("enrich", { name: c.name, field: "geo", status: g ? "ok" : "fail" });
    } catch (err) {
      await emit.emit("enrich", { name: c.name, field: "geo", status: "fail", error: (err as Error).message.slice(0, 80) });
    }
  }

  // Per-operator demand signal removed (was misusing the API — see synthesize.ts for niche-level demand context).
  // Memory annotation + confidence score happen in synthesize() after ranking.
  return { name: c.name, url: c.url, sources, about, size_estimate, hiring, recent_activity, demand_signal: null, geo, memory: null };
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

export async function enrichCandidates(candidates: Candidate[], env: Env, emit: SseEmitter, tally?: CostTally): Promise<EnrichedPartial[]> {
  await emit.emit("phase", { phase: "enrichment" });
  // Bright Data Browser API has a navigation/concurrency quota per session.
  // The bridge serializes requests via mutex + recycles browser every 6 navs.
  // Cap candidates so total BD calls (3 per candidate: homepage + careers SERP + news SERP) fit within the demo time window.
  const capped = candidates.slice(0, 6);
  const CONCURRENCY = 2; // worker-side concurrency; bridge mutex serializes anyway, but this paces SSE events nicely
  await emit.emit("progress", { message: `Enriching ${capped.length} candidates (${CONCURRENCY} at a time)…` });

  const settled = await pool(capped, CONCURRENCY, c => enrichOne(c, env, emit, tally));
  const out: EnrichedPartial[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled" && r.value) out.push(r.value);
  }
  await emit.emit("progress", { message: `Enriched ${out.length} of ${capped.length}.` });
  return out;
}
