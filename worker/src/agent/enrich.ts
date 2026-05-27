import type { Env } from "../index";
import type { Candidate, Citation, Operator } from "../types";
import { serpSearchCached } from "../brightdata/serp";
import { webUnlockerCached } from "../brightdata/webUnlocker";
import { needsBrowser, scrapingBrowserCached } from "../brightdata/scrapingBrowser";
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

  const hiring: Operator["hiring"] = { count: null, roles: [], source: null };
  try {
    const hiringSerp = await serpSearchCached(`"${c.name}" hiring careers`, bridge, env.CACHE, { num: 10 });
    const careersHit = hiringSerp.results.find(r => /career|jobs|hiring/i.test(r.link + r.title));
    if (careersHit) {
      hiring.source = careersHit.link;
      sources.push({ field: "hiring", tool: "bridge_serp", url: careersHit.link });
      if (needsBrowser(careersHit.link)) {
        try {
          const page = await scrapingBrowserCached(careersHit.link, bridge, env.CACHE);
          hiring.roles = extractRoles(page.text);
          hiring.count = hiring.roles.length || null;
        } catch (err) {
          await emit.emit("enrich", { name: c.name, field: "hiring-browser", status: "fail", error: (err as Error).message });
        }
      } else {
        try {
          const page = await webUnlockerCached(careersHit.link, bridge, env.CACHE);
          hiring.roles = extractRoles(page.html);
          hiring.count = hiring.roles.length || null;
        } catch {
          // tolerate
        }
      }
    }
    await emit.emit("enrich", { name: c.name, field: "hiring", status: "ok", roles: hiring.roles.length });
  } catch (err) {
    await emit.emit("enrich", { name: c.name, field: "hiring", status: "fail", error: (err as Error).message });
  }

  const recent_activity: Operator["recent_activity"] = [];
  try {
    const newsSerp = await serpSearchCached(`"${c.name}" news`, bridge, env.CACHE, { num: 5 });
    for (const r of newsSerp.results.slice(0, 3)) {
      recent_activity.push({ headline: r.title, date: "", source: r.link });
      sources.push({ field: "recent_activity", tool: "bridge_serp", url: r.link });
    }
    await emit.emit("enrich", { name: c.name, field: "news", status: "ok", count: recent_activity.length });
  } catch {
    await emit.emit("enrich", { name: c.name, field: "news", status: "fail" });
  }

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

export async function enrichCandidates(candidates: Candidate[], env: Env, emit: SseEmitter): Promise<EnrichedPartial[]> {
  await emit.emit("phase", { phase: "enrichment" });
  const capped = candidates.slice(0, 15);
  await emit.emit("progress", { message: `Enriching ${capped.length} candidates in parallel…` });

  const settled = await Promise.allSettled(capped.map(c => enrichOne(c, env, emit)));
  const out: EnrichedPartial[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled" && r.value) out.push(r.value);
  }
  await emit.emit("progress", { message: `Enriched ${out.length} of ${capped.length}.` });
  return out;
}
