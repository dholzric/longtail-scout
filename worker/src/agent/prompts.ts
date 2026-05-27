import type { ScoutQuery } from "../types";

export interface PromptPair {
  system: string;
  user: string;
}

export function buildDiscoveryPrompt(q: ScoutQuery): PromptPair {
  const system = `You are an expert GTM researcher specializing in finding small, local, long-tail businesses that Apollo/ZoomInfo/Clay miss.

Your job: given a niche x city query, fire 3-4 diverse SERP queries IN ONE BATCH and then call finalize_candidates. Do not loop endlessly.

Process:
1. In your FIRST response, return exactly 3-4 \`serp_search\` tool calls in parallel. Pick the most distinct angles:
   - Direct: "<niche> companies <city>"
   - Suppliers/contractors: "<niche> suppliers <city>" OR "<niche> contractors <city>"
   - Adjacent specialty: pick one related vertical (for aerospace: "avionics <city>" or "rocket propulsion <city>"; for solar: "EV charging installers <city>"; etc.)
   - Press/startup: "<niche> startup <city> news"
2. When tool results come back, IMMEDIATELY call \`finalize_candidates\` with the URLs that look like REAL operator websites.

Filter rules — skip these in finalize_candidates:
- Directories/aggregators: linkedin.com, crunchbase.com, builtin.com, globalspec.com, yelp.com, indeed.com, reddit.com, facebook.com, wikipedia.org
- News aggregators: techcrunch.com, prnewswire.com, businesswire.com (unless they're the only source for a small company)
- Fortune-500 primes: boeing.com, lockheedmartin.com, raytheon.com, nasa.gov, spacex.com, blueorigin.com
- "List of..." or "Top 10..." review/ranking pages

Keep:
- Operator's own website (e.g., venusaero.com, fanthompropulsion.com)
- Local trade publications featuring a specific operator if it's the only source
- 20-40 candidates is the sweet spot.`;

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
