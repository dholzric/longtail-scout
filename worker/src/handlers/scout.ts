import type { Env } from "../index";
import type { Operator, ScoutQuery } from "../types";
import { createSseResponse } from "../stream";
import { discoverCandidates } from "../agent/discovery";
import { enrichCandidates } from "../agent/enrich";
import { synthesize } from "../agent/synthesize";
import { newCostTally, snapshot } from "../cost";
import { findSample } from "../samples";
import { recordRunInWatchlist } from "./watchlist";

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
  cities: string[]; // 1 city for normal queries, 3 for state queries
  raw: string;
  multi_city: boolean;
}

function parseQuery(raw: string): ParsedQuery {
  const inIdx = raw.toLowerCase().lastIndexOf(" in ");
  if (inIdx <= 0) return { niche: raw, cities: [""], raw, multi_city: false };
  const niche = raw.slice(0, inIdx).trim();
  const placeRaw = raw.slice(inIdx + 4).trim();
  const placeKey = placeRaw.toLowerCase().replace(/[.,]$/, "");
  if (STATE_CITIES[placeKey]) {
    return { niche, cities: STATE_CITIES[placeKey]!, raw, multi_city: true };
  }
  return { niche, cities: [placeRaw], raw, multi_city: false };
}

function checkAuth(req: Request, env: Env): boolean {
  const expected = env.DEMO_PASSWORD;
  if (!expected) return true; // gate disabled if password unset
  // Authorization: Bearer <pw>
  const auth = req.headers.get("authorization") ?? "";
  if (auth === `Bearer ${expected}`) return true;
  // x-demo-key header
  if (req.headers.get("x-demo-key") === expected) return true;
  // ?key=<pw> query param (handy for demo URLs in slides)
  const url = new URL(req.url);
  if (url.searchParams.get("key") === expected) return true;
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
      } else {
        await emitter.emit("progress", { message: `Parsed query — niche="${q.niche}", city="${q.city}".` });
      }

      // For each city, run discovery + enrichment + synthesis. Single-city = one iteration; multi-city = up to N.
      const allOperators: Awaited<ReturnType<typeof synthesize>> = [];
      for (let i = 0; i < pq.cities.length; i++) {
        const city = pq.cities[i]!;
        const cityQuery: ScoutQuery = { niche: pq.niche, city, raw: pq.raw };
        if (pq.multi_city) {
          await emitter.emit("progress", { message: `City ${i + 1}/${pq.cities.length}: ${city}` });
        }
        const candidates = await discoverCandidates(cityQuery, env, emitter, tally);
        await emitCost(pq.multi_city ? `discovery (${city})` : "discovery");
        const enriched = await enrichCandidates(candidates, env, emitter, tally);
        await emitCost(pq.multi_city ? `enrichment (${city})` : "enrichment");
        const operators = await synthesize(cityQuery, enriched, env, emitter, tally);
        await emitCost(pq.multi_city ? `synthesis (${city})` : "synthesis");
        // Stamp operators with their source city so the UI can group/label
        for (const op of operators) {
          (op as Operator & { city?: string }).city = city;
          allOperators.push(op);
          await emitter.emit("operator", op);
          await new Promise(r => setTimeout(r, 180));
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
      await emitter.emit("done", { cost: snapshot(tally), multi_city: pq.multi_city });
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
