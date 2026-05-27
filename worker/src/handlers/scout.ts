import type { Env } from "../index";
import type { ScoutQuery } from "../types";
import { createSseResponse } from "../stream";
import { discoverCandidates } from "../agent/discovery";
import { enrichCandidates } from "../agent/enrich";
import { synthesize } from "../agent/synthesize";
import { newCostTally, snapshot } from "../cost";
import { findSample } from "../samples";

function parseQuery(raw: string): ScoutQuery {
  const inIdx = raw.toLowerCase().lastIndexOf(" in ");
  if (inIdx > 0) {
    return { niche: raw.slice(0, inIdx).trim(), city: raw.slice(inIdx + 4).trim(), raw };
  }
  return { niche: raw, city: "", raw };
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

  const q = parseQuery(body.query);
  const url = new URL(req.url);
  const sampleRequested = url.searchParams.get("sample") === "1";
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
          await emitter.emit("result", { operators: sample.operators });
          await emitter.emit("done", { sample: true });
        } catch (err) {
          await emitter.emit("error", { message: (err as Error).message, recoverable: false });
        } finally {
          await emitter.close();
        }
        return;
      }
      // No matching sample — fall through to live mode
    }

    const tally = newCostTally();
    const emitCost = async (phase: string) => {
      await emitter.emit("cost", { phase, ...snapshot(tally) });
    };
    try {
      await emitter.emit("progress", { message: `Parsed query — niche="${q.niche}", city="${q.city}".` });
      const candidates = await discoverCandidates(q, env, emitter, tally);
      await emitCost("discovery");
      const enriched = await enrichCandidates(candidates, env, emitter, tally);
      await emitCost("enrichment");
      const operators = await synthesize(q, enriched, env, emitter, tally);
      await emitCost("synthesis");
      await emitter.emit("result", { operators });
      await emitter.emit("done", { cost: snapshot(tally) });
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
