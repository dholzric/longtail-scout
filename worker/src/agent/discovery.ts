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

  // Cap at 2 turns — each turn is N parallel SERPs through the bridge mutex, so each turn
  // costs ~N × 12s wall-clock. 3 turns was producing 120-150s discovery time; 2 is enough
  // when SERP num is 25 (= up to 50-100 unique hostnames per turn before dedupe).
  for (let turn = 0; turn < 2; turn++) {
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

    // Process tool_calls in parallel, but stagger the start of each one by 350ms. Brave Search
    // API's free tier rate-limits at 1 req/sec — if we fire 4 SERP queries simultaneously, 3 of
    // them get 429'd and silently fall through to slower tiers. A 350ms stagger keeps each one
    // under the limit AND we still parallelize within Promise.all (each fetch overlaps with the
    // tail of the previous one).
    let finalized = false;
    const toolResults = await Promise.all(msg.tool_calls.map(async (tc, idx) => {
      if (tc.type !== "function") return null;
      if (idx > 0) await new Promise(r => setTimeout(r, idx * 350));
      const args = JSON.parse(tc.function.arguments) as Record<string, unknown>;

      if (tc.function.name === "serp_search") {
        const query = String(args.query ?? "");
        await emit.emit("tool", { tool: "serp", args: { query }, url: null });
        try {
          const result = await serpSearchCached(query, { bridge, braveApiKey: env.BRAVE_API_KEY, serpApiKey: env.SERPAPI_KEY }, env.CACHE, { num: 25 });
          // Only charge a BD render when the bridge actually served the SERP (SerpAPI / DDG paths are flat-fee or free).
          if (tally && result.source === "bridge") tally.bd_renders += 1;
          // Per-SERP visibility — surface result count AND source so we can see which tier handled the query.
          await emit.emit("progress", { message: `SERP "${query}" → ${result.results.length} raw hit${result.results.length === 1 ? "" : "s"} via ${result.source ?? "?"}` });
          for (const r of result.results) {
            rawCandidates.push({ name: r.title, url: r.link, origin_query: query });
            await emit.emit("candidate", { name: r.title, url: r.link });
          }
          return {
            role: "tool" as const,
            tool_call_id: tc.id,
            content: JSON.stringify({
              count: result.results.length,
              // Show the LLM 15 per query so it has visibility for finalize_candidates; all results
            // are added to rawCandidates above regardless of this slice.
            results: result.results.slice(0, 15).map(r => ({ title: r.title, link: r.link }))
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

    // Force-finalize at 15 raw candidates. After SERP num was bumped to 25, a single SERP often
    // returns 15+ hits, so one turn is plenty for the LLM to have material to rank.
    // Lower this AND the turn cap (above) means typical scouts now finish discovery in ~30-60s
    // instead of 120-150s.
    if (rawCandidates.length >= 15) {
      await emit.emit("progress", { message: `Have ${rawCandidates.length} raw candidates after turn ${turn + 1} — finalizing.` });
      break;
    }
  }

  // Was 25 — letting more candidates through so we don't pre-truncate before synthesis can rank.
  // Synthesis is the right place to filter, not discovery.
  const deduped = dedupeCandidates(rawCandidates).slice(0, 60);
  await emit.emit("progress", { message: `Discovery total: ${rawCandidates.length} raw SERP hits → ${deduped.length} candidates after dedupe + blocklist.` });
  // Loud warning when discovery yielded nothing — usually means BD's google.com rendering is
  // returning a captcha or every result was an aggregator the blocklist eats.
  if (deduped.length === 0) {
    if (rawCandidates.length === 0) {
      await emit.emit("progress", { message: `⚠ No SERP results returned. Bright Data google.com rendering may be throttled — try again in 60s, or try ?sample=1 for a cached demo.` });
    } else {
      await emit.emit("progress", { message: `⚠ All ${rawCandidates.length} SERP hits were filtered as aggregators / manufacturers / directories. Either widen the dedupe blocklist or this niche genuinely has no long-tail operators on page 1.` });
    }
  }
  return deduped;
}
