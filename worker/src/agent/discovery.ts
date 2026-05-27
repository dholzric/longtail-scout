import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import type { Env } from "../index";
import type { Candidate, ScoutQuery } from "../types";
import { serpSearchCached } from "../brightdata/serp";
import { dedupeCandidates } from "./dedupe";
import { buildDiscoveryPrompt } from "./prompts";
import { llmCall } from "../llm/client";
import type { SseEmitter } from "../stream";
import type { CostTally } from "../cost";

const DISCOVERY_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "serp_search",
      description: "Search the web via Bright Data Browser API. Returns up to 20 organic results.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "The search query." } },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "finalize_candidates",
      description: "Submit the deduped candidate list and end discovery.",
      parameters: {
        type: "object",
        properties: {
          candidates: {
            type: "array",
            items: {
              type: "object",
              properties: { name: { type: "string" }, url: { type: "string" } },
              required: ["name", "url"]
            }
          }
        },
        required: ["candidates"]
      }
    }
  }
];

export async function discoverCandidates(q: ScoutQuery, env: Env, emit: SseEmitter, tally?: CostTally): Promise<Candidate[]> {
  await emit.emit("phase", { phase: "discovery" });
  const bridge = { base: env.BRIDGE_BASE, token: env.BRIDGE_AUTH_TOKEN };
  const { system, user } = buildDiscoveryPrompt(q);

  const messages: ChatCompletionMessageParam[] = [{ role: "user", content: user }];
  const rawCandidates: Candidate[] = [];

  for (let turn = 0; turn < 3; turn++) {
    const { response, provider } = await llmCall(env, {
      system,
      messages,
      tools: DISCOVERY_TOOLS,
      toolChoice: "auto"
    });
    if (tally) {
      tally.llm_calls += 1;
      tally.llm_input_tokens += response.usage?.prompt_tokens ?? 0;
      tally.llm_output_tokens += response.usage?.completion_tokens ?? 0;
    }
    await emit.emit("progress", { message: `Discovery turn ${turn + 1} via ${provider}` });

    const choice = response.choices[0];
    if (!choice) throw new Error("LLM returned no choices");
    const msg = choice.message;
    messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });

    if (!msg.tool_calls || msg.tool_calls.length === 0) break;

    // Process all tool_calls in this turn in parallel.
    let finalized = false;
    const toolResults = await Promise.all(msg.tool_calls.map(async (tc) => {
      if (tc.type !== "function") return null;
      const args = JSON.parse(tc.function.arguments) as Record<string, unknown>;

      if (tc.function.name === "serp_search") {
        const query = String(args.query ?? "");
        await emit.emit("tool", { tool: "serp", args: { query }, url: null });
        try {
          const result = await serpSearchCached(query, bridge, env.CACHE, { num: 15 });
          if (tally) tally.bd_renders += 1; // each SERP = one Bright Data Browser render
          for (const r of result.results) {
            rawCandidates.push({ name: r.title, url: r.link, origin_query: query });
            await emit.emit("candidate", { name: r.title, url: r.link });
          }
          return {
            role: "tool" as const,
            tool_call_id: tc.id,
            content: JSON.stringify({
              count: result.results.length,
              results: result.results.slice(0, 8).map(r => ({ title: r.title, link: r.link }))
            })
          };
        } catch (err) {
          return {
            role: "tool" as const,
            tool_call_id: tc.id,
            content: `Error: ${(err as Error).message}`
          };
        }
      } else if (tc.function.name === "finalize_candidates") {
        finalized = true;
        const candidates = (args.candidates as Array<{ name: string; url: string }>) ?? [];
        for (const c of candidates) {
          rawCandidates.push({ name: c.name, url: c.url, origin_query: "model_finalized" });
        }
        return {
          role: "tool" as const,
          tool_call_id: tc.id,
          content: `accepted ${candidates.length} candidates`
        };
      }
      return null;
    }));

    for (const r of toolResults) {
      if (r) messages.push(r);
    }

    if (finalized) break;

    // Force-finalize after ANY turn that produces enough candidates. We don't need a second LLM round-trip
    // just to ask the model to call finalize_candidates — dedupe handles it deterministically downstream.
    if (rawCandidates.length >= 10) {
      await emit.emit("progress", { message: `Have ${rawCandidates.length} raw candidates after turn ${turn + 1} — finalizing.` });
      break;
    }
  }

  const deduped = dedupeCandidates(rawCandidates).slice(0, 25);
  await emit.emit("progress", { message: `Discovered ${deduped.length} candidates after dedupe.` });
  return deduped;
}
