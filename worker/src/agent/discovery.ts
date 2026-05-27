import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import type { Env } from "../index";
import type { Candidate, ScoutQuery } from "../types";
import { serpSearchCached } from "../brightdata/serp";
import { dedupeCandidates } from "./dedupe";
import { buildDiscoveryPrompt } from "./prompts";
import { llmCall } from "../llm/client";
import type { SseEmitter } from "../stream";

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

export async function discoverCandidates(q: ScoutQuery, env: Env, emit: SseEmitter): Promise<Candidate[]> {
  await emit.emit("phase", { phase: "discovery" });
  const bridge = { base: env.BRIDGE_BASE, token: env.BRIDGE_AUTH_TOKEN };
  const { system, user } = buildDiscoveryPrompt(q);

  const messages: ChatCompletionMessageParam[] = [{ role: "user", content: user }];
  const rawCandidates: Candidate[] = [];

  for (let turn = 0; turn < 4; turn++) {
    const { response, provider } = await llmCall(env, {
      system,
      messages,
      tools: DISCOVERY_TOOLS,
      toolChoice: "auto"
    });
    await emit.emit("progress", { message: `Discovery turn ${turn + 1} via ${provider}` });

    const choice = response.choices[0];
    if (!choice) throw new Error("LLM returned no choices");
    const msg = choice.message;
    messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });

    if (!msg.tool_calls || msg.tool_calls.length === 0) break;

    let finalized = false;
    for (const tc of msg.tool_calls) {
      if (tc.type !== "function") continue;
      const args = JSON.parse(tc.function.arguments) as Record<string, unknown>;

      if (tc.function.name === "serp_search") {
        const query = String(args.query ?? "");
        await emit.emit("tool", { tool: "serp", args: { query }, url: null });
        try {
          const result = await serpSearchCached(query, bridge, env.CACHE, { num: 15 });
          for (const r of result.results) {
            rawCandidates.push({ name: r.title, url: r.link, origin_query: query });
            await emit.emit("candidate", { name: r.title, url: r.link });
          }
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({
              count: result.results.length,
              results: result.results.slice(0, 10).map(r => ({ title: r.title, link: r.link, snippet: r.snippet }))
            })
          });
        } catch (err) {
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: `Error: ${(err as Error).message}`
          });
        }
      } else if (tc.function.name === "finalize_candidates") {
        finalized = true;
        const candidates = (args.candidates as Array<{ name: string; url: string }>) ?? [];
        for (const c of candidates) {
          rawCandidates.push({ name: c.name, url: c.url, origin_query: "model_finalized" });
        }
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: `accepted ${candidates.length} candidates`
        });
      }
    }

    if (finalized) break;
  }

  const deduped = dedupeCandidates(rawCandidates).slice(0, 25);
  await emit.emit("progress", { message: `Discovered ${deduped.length} candidates after dedupe.` });
  return deduped;
}
