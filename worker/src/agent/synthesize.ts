import type { Env } from "../index";
import type { Operator, ScoutQuery } from "../types";
import { buildSynthesisPrompt } from "./prompts";
import { llmCall } from "../llm/client";
import { demandLookup } from "../demand/client";
import { recordOperator } from "../memory/store";
import { computeConfidence } from "./confidence";
import type { SseEmitter } from "../stream";
import type { CostTally } from "../cost";

type EnrichmentInput = Omit<Operator, "rank" | "sales_angle" | "icp_fit_reason" | "memory" | "confidence">;

export async function synthesize(q: ScoutQuery, enriched: EnrichmentInput[], env: Env, emit: SseEmitter, tally?: CostTally): Promise<Operator[]> {
  await emit.emit("phase", { phase: "synthesis" });

  // Niche-level demand context — one lookup against the ~7M-business demand index for the *niche keyword* the user typed.
  // This is the correct interpretation of the demand API; per-operator brandability scores were misleading.
  let nicheDemand: { count: number; rank_signal: number | null } | null = null;
  try {
    // Use just the niche (first 1-2 words) for the lookup
    const nicheKey = q.niche.replace(/\b(companies|firms|operators|businesses|in|the|a|an)\b/gi, "").trim().split(/\s+/).slice(0, 2).join(" ") || q.niche;
    const d = await demandLookup(nicheKey, env.DEMAND_API_BASE, env.CACHE);
    if (d) {
      nicheDemand = { count: d.demand, rank_signal: d.results[0]?.score_components?.demand ?? null };
      await emit.emit("progress", { message: `Niche "${nicheKey}" has ${d.demand} matching businesses in the demand index.` });
    }
  } catch (err) {
    await emit.emit("progress", { message: `Demand lookup failed (continuing): ${(err as Error).message.slice(0, 100)}` });
  }

  const { system, user } = buildSynthesisPrompt(q, enriched, nicheDemand);
  const { response, provider } = await llmCall(env, {
    system,
    messages: [{ role: "user", content: user }],
    responseFormat: "json_object"
  });
  if (tally) {
    tally.llm_calls += 1;
    tally.llm_input_tokens += response.usage?.prompt_tokens ?? 0;
    tally.llm_output_tokens += response.usage?.completion_tokens ?? 0;
  }
  await emit.emit("progress", { message: `Synthesis via ${provider}` });

  const text = response.choices[0]?.message.content ?? "";
  let jsonStr = text.trim();
  const fenceRe = /```(?:json)?\s*([\s\S]*?)```/;
  const fenceMatch = fenceRe.exec(jsonStr);
  if (fenceMatch) jsonStr = (fenceMatch[1] ?? "").trim();

  let parsed: { operators: Array<{ name: string; url: string; rank: number; icp_fit_reason?: string; sales_angle: string }> };
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    throw new Error(`Synthesis JSON parse failed: ${(err as Error).message}\nRaw: ${jsonStr.slice(0, 500)}`);
  }

  const byName = new Map(enriched.map(e => [e.name, e]));
  const operators: Operator[] = parsed.operators.map(o => {
    const base = byName.get(o.name);
    const icp_fit_reason = (o.icp_fit_reason ?? "").trim() || "Long-tail operator, web-first";
    if (!base) {
      const stub: Operator = {
        name: o.name,
        url: o.url,
        sources: [],
        about: null,
        size_estimate: null,
        hiring: { count: null, roles: [], source: null },
        recent_activity: [],
        demand_signal: null,
        icp_fit_reason,
        sales_angle: o.sales_angle,
        rank: o.rank,
        geo: null,
        memory: null,
        confidence: 0
      };
      stub.confidence = computeConfidence(stub);
      return stub;
    }
    const op: Operator = { ...base, icp_fit_reason, sales_angle: o.sales_angle, rank: o.rank, memory: null, confidence: 0 };
    op.confidence = computeConfidence(op);
    return op;
  });

  // Record each operator in the memory store + annotate with seen-count/new-vs-familiar.
  // 1 KV read + 1 KV write per operator. Cheap; runs after synthesis (post-rank).
  for (const op of operators) {
    try {
      const m = await recordOperator(env.CACHE, op.url, op.name, q.raw);
      op.memory = m;
    } catch (err) {
      // Memory is best-effort; failure should not break the response.
      await emit.emit("progress", { message: `memory annotation failed for ${op.name}: ${(err as Error).message.slice(0, 80)}` });
    }
  }

  operators.sort((a, b) => a.rank - b.rank);
  return operators;
}
