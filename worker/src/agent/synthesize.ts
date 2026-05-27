import type { Env } from "../index";
import type { Operator, ScoutQuery } from "../types";
import { buildSynthesisPrompt } from "./prompts";
import { llmCall } from "../llm/client";
import type { SseEmitter } from "../stream";

type EnrichmentInput = Omit<Operator, "rank" | "sales_angle">;

export async function synthesize(q: ScoutQuery, enriched: EnrichmentInput[], env: Env, emit: SseEmitter): Promise<Operator[]> {
  await emit.emit("phase", { phase: "synthesis" });

  const { system, user } = buildSynthesisPrompt(q, enriched);
  const { response, provider } = await llmCall(env, {
    system,
    messages: [{ role: "user", content: user }],
    responseFormat: "json_object"
  });
  await emit.emit("progress", { message: `Synthesis via ${provider}` });

  const text = response.choices[0]?.message.content ?? "";
  let jsonStr = text.trim();
  const fenceRe = /```(?:json)?\s*([\s\S]*?)```/;
  const fenceMatch = fenceRe.exec(jsonStr);
  if (fenceMatch) jsonStr = (fenceMatch[1] ?? "").trim();

  let parsed: { operators: Array<{ name: string; url: string; rank: number; sales_angle: string }> };
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    throw new Error(`Synthesis JSON parse failed: ${(err as Error).message}\nRaw: ${jsonStr.slice(0, 500)}`);
  }

  const byName = new Map(enriched.map(e => [e.name, e]));
  const operators: Operator[] = parsed.operators.map(o => {
    const base = byName.get(o.name);
    if (!base) {
      return {
        name: o.name,
        url: o.url,
        sources: [],
        about: null,
        size_estimate: null,
        hiring: { count: null, roles: [], source: null },
        recent_activity: [],
        demand_signal: null,
        sales_angle: o.sales_angle,
        rank: o.rank
      };
    }
    return { ...base, sales_angle: o.sales_angle, rank: o.rank };
  });

  operators.sort((a, b) => a.rank - b.rank);
  return operators;
}
