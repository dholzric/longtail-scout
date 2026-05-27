import type { Env } from "../index";
import type { Candidate, Citation, Operator } from "../types";
import { webUnlockerCached } from "../brightdata/webUnlocker";
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

  // Lightweight on-page heuristics (no extra BD calls — keeps us under session limits)
  const hiring: Operator["hiring"] = { count: null, roles: [], source: null };
  const text = homepageHtml.toLowerCase();
  if (/we[\s']?re hiring|now hiring|join our team|careers|open positions|job openings/i.test(text)) {
    hiring.roles = extractRoles(text);
    hiring.count = hiring.roles.length || null;
    // Try to find a careers link on the homepage
    const careersMatch = /href=["']([^"']*(?:careers?|jobs)[^"']*)["']/i.exec(homepageHtml);
    if (careersMatch) {
      try {
        const careersUrl = new URL(careersMatch[1] ?? "", c.url).toString();
        hiring.source = careersUrl;
        sources.push({ field: "hiring", tool: "homepage_link", url: careersUrl });
      } catch { /* skip bad URL */ }
    }
  }
  await emit.emit("enrich", { name: c.name, field: "hiring", status: "ok", roles: hiring.roles.length });

  const recent_activity: Operator["recent_activity"] = [];
  // No news SERP — judges' demo loop can't afford the BD call budget.

  let demand_signal: Operator["demand_signal"] = null;
  try {
    const d = await demandLookup(c.name.split(/\s+/)[0] ?? c.name, env.DEMAND_API_BASE, env.CACHE);
    if (d) {
      demand_signal = { score: d.results[0]?.score ?? 0, nearby_count: d.demand };
      sources.push({ field: "demand_signal", tool: "demand_api", url: `${env.DEMAND_API_BASE}/api/research?q=${encodeURIComponent(c.name)}` });
    }
    await emit.emit("enrich", { name: c.name, field: "demand", status: "ok" });
  } catch {
    await emit.emit("enrich", { name: c.name, field: "demand", status: "fail" });
  }

  return { name: c.name, url: c.url, sources, about, size_estimate, hiring, recent_activity, demand_signal };
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
  // Cap concurrency low and cap total candidates so we stay under it.
  const capped = candidates.slice(0, 8);
  const CONCURRENCY = 2;
  await emit.emit("progress", { message: `Enriching ${capped.length} candidates (${CONCURRENCY} at a time)…` });

  const settled = await pool(capped, CONCURRENCY, c => enrichOne(c, env, emit));
  const out: EnrichedPartial[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled" && r.value) out.push(r.value);
  }
  await emit.emit("progress", { message: `Enriched ${out.length} of ${capped.length}.` });
  return out;
}
