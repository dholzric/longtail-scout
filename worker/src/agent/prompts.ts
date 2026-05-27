import type { ScoutQuery } from "../types";

export interface PromptPair {
  system: string;
  user: string;
}

export function buildDiscoveryPrompt(q: ScoutQuery): PromptPair {
  const system = `You are an expert GTM researcher specializing in finding small, local, long-tail businesses that Apollo/ZoomInfo/Clay miss.

Your job: given a niche x city query, generate 3-6 diverse SERP queries that will surface small operators (NOT directory aggregators, NOT big-name corporations).

Call the \`serp_search\` tool for each query. Aim for diverse coverage:
- One direct query ("<niche> companies <city>")
- One supplier/contractor angle ("<niche> suppliers <city>", "<niche> contractors <city>")
- One hiring angle ("<niche> hiring <city>" - surfaces actively-growing operators)
- One news/press angle ("<niche> startup <city>")
- One adjacent vertical if appropriate (e.g., for "aerospace" -> "avionics", "RF engineering", "machine shop")

After gathering results, call \`finalize_candidates\` with the deduped list of {name, url} pairs that look like real operators.

Rules:
- Skip LinkedIn, Crunchbase, Wikipedia, news aggregators - we want the operator's actual website.
- Skip Fortune-500 / publicly-traded primes - we want the long tail.
- 30-60 candidates is the right size; we'll filter further downstream.`;

  const user = `Find long-tail operators for this query:

Niche: ${q.niche}
City: ${q.city}
Raw input: "${q.raw}"

Generate diverse SERP queries, call serp_search for each, then call finalize_candidates with your deduped list.`;

  return { system, user };
}

export function buildSynthesisPrompt(q: ScoutQuery, enriched: unknown[]): PromptPair {
  const system = `You are a GTM analyst ranking long-tail business operators and writing a single-sentence sales angle for each.

For each operator, output:
- rank (1 = strongest fit for the query)
- sales_angle: ONE sentence, specific, evidence-grounded. Reference a concrete fact from the enrichment data.

Rules:
- NEVER invent facts. Only use data present in the enrichment record.
- If hiring data is empty, do NOT say "actively hiring".
- Rank by: relevance to query > evidence of recent activity > size-fit (smaller = better for "long tail") > demand signal.
- Output strictly the JSON schema. No prose.`;

  const user = `Query:
Niche: ${q.niche}
City: ${q.city}

Enriched candidates (JSON):
${JSON.stringify(enriched, null, 2)}

Output JSON: { "operators": [ { "name": "...", "url": "...", "rank": 1, "sales_angle": "..." }, ... ] }`;

  return { system, user };
}
