import type { Env } from "../index";
import type { Operator, ScoutQuery } from "../types";
import { createSseResponse } from "../stream";
import { discoverCandidates } from "../agent/discovery";
import { enrichCandidates } from "../agent/enrich";
import { synthesize } from "../agent/synthesize";
import { newCostTally, snapshot } from "../cost";
import { findSample } from "../samples";
import { recordRunInWatchlist } from "./watchlist";
import { envWithByok } from "../llm/client";
import { recordRecentRun } from "./recentRuns";

/** Top ~80 US cities + common 2-word names. Used by the bare-adjacency parser so "Electrician Chicago"
 *  or "Roofing San Francisco" splits correctly even when the user omits " in ". Case-insensitive. */
const US_CITIES = new Set<string>([
  // 50 most populous US cities (rough order)
  "new york", "los angeles", "chicago", "houston", "phoenix", "philadelphia", "san antonio",
  "san diego", "dallas", "san jose", "austin", "jacksonville", "fort worth", "columbus",
  "charlotte", "indianapolis", "san francisco", "seattle", "denver", "washington", "boston",
  "el paso", "nashville", "detroit", "oklahoma city", "portland", "las vegas", "memphis",
  "louisville", "baltimore", "milwaukee", "albuquerque", "tucson", "fresno", "sacramento",
  "kansas city", "mesa", "atlanta", "omaha", "colorado springs", "raleigh", "miami",
  "long beach", "virginia beach", "oakland", "minneapolis", "tulsa", "arlington",
  "tampa", "new orleans",
  // additional metros people search
  "brooklyn", "queens", "the bronx", "manhattan", "staten island",
  "pittsburgh", "cincinnati", "cleveland", "buffalo", "rochester", "syracuse", "albany",
  "orlando", "st petersburg", "fort lauderdale", "jacksonville", "tallahassee",
  "savannah", "augusta", "macon",
  "charlotte", "durham", "greensboro", "winston salem",
  "richmond", "norfolk", "newport news", "virginia beach",
  "providence", "hartford", "new haven",
  "salt lake city", "boise", "spokane", "tacoma",
  "honolulu", "anchorage",
  "scottsdale", "tempe", "chandler", "glendale",
  "irvine", "anaheim", "santa ana", "riverside", "san bernardino", "bakersfield", "stockton",
  "santa clara", "santa monica", "berkeley", "palo alto",
  "boulder", "fort collins",
  "ann arbor", "grand rapids",
  "lexington", "louisville",
  "des moines", "madison", "madison", "milwaukee", "green bay",
  "wichita", "topeka",
  "little rock", "jackson", "biloxi",
  "shreveport", "baton rouge",
  "lubbock", "el paso", "amarillo", "corpus christi",
  "knoxville", "chattanooga", "memphis",
  "asheville", "fayetteville",
  "alexandria"
]);

// Top-3 cities per US state for multi-city expansion. Picked by population + commercial-density;
// adjust for verticals where coastal/Sun-Belt operators concentrate elsewhere.
const STATE_CITIES: Record<string, string[]> = {
  "texas": ["Houston", "Dallas", "Austin"], "tx": ["Houston", "Dallas", "Austin"],
  "california": ["Los Angeles", "San Francisco", "San Diego"], "ca": ["Los Angeles", "San Francisco", "San Diego"],
  "florida": ["Miami", "Orlando", "Tampa"], "fl": ["Miami", "Orlando", "Tampa"],
  "new york": ["New York City", "Brooklyn", "Buffalo"], "ny": ["New York City", "Brooklyn", "Buffalo"],
  "illinois": ["Chicago", "Aurora", "Springfield"], "il": ["Chicago", "Aurora", "Springfield"],
  "georgia": ["Atlanta", "Savannah", "Augusta"], "ga": ["Atlanta", "Savannah", "Augusta"],
  "north carolina": ["Charlotte", "Raleigh", "Greensboro"], "nc": ["Charlotte", "Raleigh", "Greensboro"],
  "arizona": ["Phoenix", "Tucson", "Mesa"], "az": ["Phoenix", "Tucson", "Mesa"],
  "washington": ["Seattle", "Spokane", "Tacoma"], "wa": ["Seattle", "Spokane", "Tacoma"],
  "colorado": ["Denver", "Colorado Springs", "Aurora"], "co": ["Denver", "Colorado Springs", "Aurora"],
  "massachusetts": ["Boston", "Worcester", "Cambridge"], "ma": ["Boston", "Worcester", "Cambridge"],
  "pennsylvania": ["Philadelphia", "Pittsburgh", "Allentown"], "pa": ["Philadelphia", "Pittsburgh", "Allentown"],
  "ohio": ["Columbus", "Cleveland", "Cincinnati"], "oh": ["Columbus", "Cleveland", "Cincinnati"]
};

interface ParsedQuery {
  niche: string;
  /** Compound queries split into multiple niche keywords ("roofing OR HVAC contractors in Houston" → ["roofing contractors","HVAC contractors"]). Single-element when not compound. */
  niches: string[];
  cities: string[]; // 1 city for normal queries, 3 for state queries
  raw: string;
  multi_city: boolean;
  multi_niche: boolean;
}

/**
 * Split a niche string like "roofing OR HVAC contractors" into ["roofing contractors", "HVAC contractors"].
 * The trailing qualifier word ("contractors", "firms", "centers", …) is broadcast across siblings that
 * don't include their own, so the user doesn't have to type it twice. Max 4 niches.
 */
const QUALIFIER_RE = /\b(contractors?|firms?|practices?|services?|centers?|shops?|companies?|providers?|specialists?|installers?|technicians?|locations?|stores?|studios?|salons?|offices?)\b/i;

function splitNiches(niche: string): string[] {
  const parts = niche.split(/\s+(?:OR|or|\/|,)\s+/).map(s => s.trim()).filter(Boolean);
  if (parts.length <= 1) return [niche];
  const tail = parts[parts.length - 1] ?? "";
  const tailQual = tail.match(QUALIFIER_RE);
  if (tailQual) {
    const qualifier = tailQual[0];
    return parts.slice(0, -1).map(p => QUALIFIER_RE.test(p) ? p : `${p} ${qualifier}`).concat([tail]).slice(0, 4);
  }
  return parts.slice(0, 4);
}

/**
 * Try every parsing strategy and return the first that produces a sensible niche+city split.
 * Strategies, in order:
 *   1. " in <place>" — "roofing contractors in Houston"
 *   2. " near <place>" / " around <place>" / " @ <place>"
 *   3. ", <place>" — "roofing, Chicago"
 *   4. " <place>" trailing token (1 or 2 words) that matches our known-US-cities set — "Electrician Chicago"
 *   5. " <state>" trailing token that matches a state key — "roofing Texas"
 *   6. Fallback: whole input is the niche, no city
 */
function parseQuery(raw: string): ParsedQuery {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  function build(niche: string, placeRaw: string): ParsedQuery {
    const niches = splitNiches(niche);
    const placeKey = placeRaw.toLowerCase().replace(/[.,]$/, "").trim();
    if (placeKey && STATE_CITIES[placeKey]) {
      return { niche, niches, cities: STATE_CITIES[placeKey]!, raw, multi_city: true, multi_niche: niches.length > 1 };
    }
    return { niche, niches, cities: [placeRaw], raw, multi_city: false, multi_niche: niches.length > 1 };
  }

  // (1) " in " split — strongest signal
  const inIdx = lower.lastIndexOf(" in ");
  if (inIdx > 0) {
    return build(trimmed.slice(0, inIdx).trim(), trimmed.slice(inIdx + 4).trim());
  }

  // (2) " near " / " around " / " @ "
  const nearMatch = trimmed.match(/^(.+?)\s+(?:near|around|@)\s+(.+)$/i);
  if (nearMatch && nearMatch[1] && nearMatch[2]) {
    return build(nearMatch[1].trim(), nearMatch[2].trim());
  }

  // (3) Comma split — "roofing, Chicago"
  const commaIdx = trimmed.lastIndexOf(",");
  if (commaIdx > 0 && commaIdx < trimmed.length - 1) {
    const tail = trimmed.slice(commaIdx + 1).trim();
    if (tail.length > 0 && tail.length < 40) {
      return build(trimmed.slice(0, commaIdx).trim(), tail);
    }
  }

  // (4)+(5) Bare-adjacency — peel off a trailing US city or state token (try 2 words first, then 1)
  const words = trimmed.split(/\s+/);
  if (words.length >= 2) {
    for (const peel of [2, 1]) {
      if (words.length <= peel) continue;
      const tailRaw = words.slice(-peel).join(" ");
      const tailLower = tailRaw.toLowerCase().replace(/[.,]$/, "");
      if (US_CITIES.has(tailLower) || STATE_CITIES[tailLower]) {
        const head = words.slice(0, -peel).join(" ").trim();
        if (head.length > 0) return build(head, tailRaw);
      }
    }
  }

  // Fallback: no city detected
  const niches = splitNiches(trimmed);
  return { niche: trimmed, niches, cities: [""], raw, multi_city: false, multi_niche: niches.length > 1 };
}

function checkAuth(req: Request, env: Env): boolean {
  const expected = env.DEMO_PASSWORD;
  if (!expected) return true; // gate disabled if password unset
  // Header-only auth — we deliberately don't accept ?key= here. Query-string secrets leak via
  // logs, browser history, Referer, and screen-recordings. Slides that show a scout call should
  // use the BYOK panel or a curl example with -H. The frontend captures ?key= on first load
  // into localStorage (then strips it from the URL) so shared bookmarks still bootstrap.
  const auth = req.headers.get("authorization") ?? "";
  if (auth === `Bearer ${expected}`) return true;
  if (req.headers.get("x-demo-key") === expected) return true;
  return false;
}

export async function scoutHandler(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!checkAuth(req, env)) {
    return new Response(JSON.stringify({ error: "demo gated — enter demo password" }), {
      status: 401,
      headers: { "content-type": "application/json", "www-authenticate": "Bearer realm=\"longtail-scout-demo\"" }
    });
  }
  let body: { query?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (!body.query || typeof body.query !== "string") return new Response("Missing 'query'", { status: 400 });

  // Apply Bring-Your-Own-Key headers — judges/users can paste their own DeepSeek/OpenRouter/GLM
  // keys via the BYOK panel and the worker prefers theirs over ours for this request.
  env = { ...env, ...envWithByok(env, req.headers) };

  const pq = parseQuery(body.query);
  const url = new URL(req.url);
  const sampleRequested = url.searchParams.get("sample") === "1";
  // Internal ScoutQuery — for the live pipeline we always use the first city; multi-city is orchestrated below.
  const q: ScoutQuery = { niche: pq.niche, city: pq.cities[0] ?? "", raw: pq.raw };
  const { response, emitter } = createSseResponse();

  ctx.waitUntil((async () => {
    // Sample mode: deterministic canned response. Used for demos + judging reliability when live BD/LLM
    // might be slow, throttled, or out of credits. The trace mimics the real run so the demo flow is identical.
    if (sampleRequested) {
      const sample = findSample(q.raw);
      if (sample) {
        try {
          await emitter.emit("progress", { message: `Sample mode — replaying ${sample.label} cached result (no live API spend).` });
          await emitter.emit("phase", { phase: "discovery" });
          await emitter.emit("progress", { message: `Discovery (cached) — 4 SERP queries via Bright Data, deduped to ${sample.operators.length} operators.` });
          await emitter.emit("phase", { phase: "enrichment" });
          for (const op of sample.operators) {
            await emitter.emit("candidate", { name: op.name, url: op.url });
            await emitter.emit("enrich", { name: op.name, field: "homepage", status: "ok" });
          }
          await emitter.emit("phase", { phase: "synthesis" });
          await emitter.emit("progress", { message: `Synthesis (cached) — ${sample.operators.length} operators ranked.` });
          await emitter.emit("cost", { phase: "sample", bd_renders: 0, llm_calls: 0, llm_input_tokens: 0, llm_output_tokens: 0, bd_usd: 0, llm_usd: 0, total_usd: 0, sample: true });
          // Stream operators one-by-one in sample mode too — matches the live demo's UX.
          for (const op of sample.operators) {
            await emitter.emit("operator", op);
            await new Promise(r => setTimeout(r, 220));
          }
          await emitter.emit("result", { operators: sample.operators });
          await emitter.emit("done", { sample: true });
        } catch (err) {
          await emitter.emit("error", { message: (err as Error).message, recoverable: false });
        } finally {
          await emitter.close();
        }
        return;
      }
      // No matching sample — DO NOT silently fall through to live mode (would burn real BD/LLM
      // dollars on a query the judge thought was free). Emit a clear stub instead.
      try {
        await emitter.emit("progress", { message: `Sample mode: no canned sample for "${q.raw}". Remove ?sample=1 from the URL to run this query live.` });
        await emitter.emit("result", { operators: [] });
        await emitter.emit("done", { sample: true, no_sample_available: true });
      } catch { /* ignore */ } finally {
        await emitter.close();
      }
      return;
    }

    const tally = newCostTally();
    const emitCost = async (phase: string) => {
      await emitter.emit("cost", { phase, ...snapshot(tally) });
    };
    try {
      if (pq.multi_city) {
        await emitter.emit("progress", { message: `Multi-city detected — niche="${pq.niche}", cities=${JSON.stringify(pq.cities)}.` });
      }
      if (pq.multi_niche) {
        await emitter.emit("progress", { message: `Multi-niche detected — niches=${JSON.stringify(pq.niches)}.` });
      }
      if (!pq.multi_city && !pq.multi_niche) {
        await emitter.emit("progress", { message: `Parsed query — niche="${q.niche}", city="${q.city}".` });
      }

      // Budget guard: cap total (niche × city) sub-scouts at MAX_SUB_SCOUTS. Without this, a
      // compound query like "roofing OR HVAC OR plumbing OR electrical contractors in Texas"
      // would expand to 4 × 3 = 12 sub-scouts on a shared demo password — ~$2.40 per click for
      // anyone who has the password. We trim cities first (multi-niche is more demo-worthy than
      // multi-city for the same niche; trimming cities preserves the variety of verticals).
      const MAX_SUB_SCOUTS = 6;
      let cities = pq.cities;
      const niches = pq.niches;
      let totalIterations = niches.length * cities.length;
      if (totalIterations > MAX_SUB_SCOUTS) {
        const maxCities = Math.max(1, Math.floor(MAX_SUB_SCOUTS / niches.length));
        cities = cities.slice(0, maxCities);
        const before = totalIterations;
        totalIterations = niches.length * cities.length;
        await emitter.emit("progress", { message: `Budget guard: capped from ${before} → ${totalIterations} sub-scouts (max ${MAX_SUB_SCOUTS}). Trimmed cities to ${cities.join(", ")}.` });
      }

      // Iterate every (niche × city) combination. Operators from each are merged + deduped by URL.
      const allOperators: Awaited<ReturnType<typeof synthesize>> = [];
      const seenUrls = new Set<string>();
      let iter = 0;
      for (const subNiche of niches) {
        for (let ci = 0; ci < cities.length; ci++) {
          iter++;
          const city = cities[ci]!;
          const subQuery: ScoutQuery = { niche: subNiche, city, raw: pq.raw };
          if (totalIterations > 1) {
            await emitter.emit("progress", { message: `Sub-scout ${iter}/${totalIterations}: "${subNiche}"${city ? ` in ${city}` : ""}` });
          }
          const candidates = await discoverCandidates(subQuery, env, emitter, tally);
          await emitCost(totalIterations > 1 ? `discovery (${subNiche}/${city})` : "discovery");
          const enriched = await enrichCandidates(candidates, env, emitter, tally);
          await emitCost(totalIterations > 1 ? `enrichment (${subNiche}/${city})` : "enrichment");
          const operators = await synthesize(subQuery, enriched, env, emitter, tally);
          await emitCost(totalIterations > 1 ? `synthesis (${subNiche}/${city})` : "synthesis");
          for (const op of operators) {
            if (seenUrls.has(op.url)) continue; // dedupe across niche×city sub-scouts
            seenUrls.add(op.url);
            (op as Operator & { city?: string }).city = city;
            allOperators.push(op);
            await emitter.emit("operator", op);
            await new Promise(r => setTimeout(r, 180));
          }
        }
      }

      // Re-rank across all cities (preserve per-city rank as "city_rank" via sales_angle context, simplest: global re-rank by confidence then rank)
      allOperators.sort((a, b) => (b.confidence - a.confidence) || (a.rank - b.rank));
      // Re-assign global rank
      allOperators.forEach((op, i) => { op.rank = i + 1; });
      // Watchlist diff — if this query is on the user's watchlist, compare URLs vs last run and emit "new since last run" count.
      try {
        const watch = await recordRunInWatchlist(env.CACHE, pq.raw, allOperators.map(o => o.url));
        if (watch) await emitter.emit("progress", { message: `Watchlist hit: ${watch.new_count} new operator(s) since last run${watch.previous_count !== null ? ` (was ${watch.previous_count}).` : "."}` });
      } catch { /* best-effort */ }
      await emitter.emit("result", { operators: allOperators });
      const finalCost = snapshot(tally);
      await emitter.emit("done", { cost: finalCost, multi_city: pq.multi_city });

      // Record in the recent-runs gallery (best-effort)
      try {
        const apolloThin = allOperators.filter(o => {
          try { const u = new URL(o.url); return !/^(www\.)?(linkedin\.com|crunchbase\.com|builtin\.com|wikipedia\.org)$/i.test(u.hostname); } catch { return true; }
        }).length;
        const hiring = allOperators.filter(o => (o.hiring.count ?? 0) > 0).length;
        await recordRecentRun(env, {
          query: pq.raw,
          niche: pq.niche,
          city: pq.cities[0] ?? "",
          operator_count: allOperators.length,
          apollo_thin: apolloThin,
          hiring,
          total_usd: finalCost.total_usd,
          ts: Date.now(),
          share_url: `https://longtailscout.com/?q=${encodeURIComponent(pq.raw)}&run=1`
        });
      } catch { /* best-effort */ }
    } catch (err) {
      // Live pipeline failed. Try the sample fallback if there is one — better to show stale results than nothing.
      const sample = findSample(q.raw);
      if (sample) {
        await emitter.emit("progress", { message: `Live pipeline failed (${(err as Error).message.slice(0, 80)}) — falling back to cached sample.` });
        await emitter.emit("result", { operators: sample.operators });
        await emitter.emit("done", { fallback: true });
      } else {
        await emitter.emit("error", { message: (err as Error).message, recoverable: false });
      }
    } finally {
      await emitter.close();
    }
  })());

  return response;
}
