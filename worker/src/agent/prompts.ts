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

CRITICAL — what to PUT in finalize_candidates:
- ONLY URLs that look like a single company's own home page or product page.
- Strongly prefer short, branded domains (venusaero.com, fanthompropulsion.com, aegisaero.com).
- The hostname should match or hint at the company name (Venus Aerospace → venusaero.com).
- URL path should be \`/\` or short (\`/about\`, \`/products\`), NOT \`/blog/...\`, \`/news/...\`, \`/articles/...\`.

CRITICAL — what to SKIP from finalize_candidates:
- ANY URL on these domains: linkedin.com, crunchbase.com, builtin.com, globalspec.com, yelp.com, indeed.com, reddit.com, facebook.com, wikipedia.org, tracxn.com, wellfound.com, bizjournals.com, prnewswire.com, businesswire.com, techcrunch.com, spacenews.com, khou.com, innovationmap.com, houstoniamag.com, fly2houston.com, bayareahouston.com, houston.org, businessintexas.com, sciencedirect.com, scholar.google.com, gov.texas.gov, nasa.gov, .edu domains
- "List of companies in X" / "Top 10 X" / "Aerospace companies you should know" pages
- News headlines linking to khou.com / abc13.com / bizjournals / texasstandard / etc.
- Fortune-500 primes: boeing.com, lockheedmartin.com, raytheon.com, spacex.com, blueorigin.com, honeywell.com
- URLs containing #:~:text= fragments (Google text-fragment deep links into reference pages)

Target 15-30 high-quality candidates after filtering. Quality strictly over quantity — better 12 real operator sites than 50 with junk.`;

  const user = `Find long-tail operators for this query:

Niche: ${q.niche}
City: ${q.city}
Raw input: "${q.raw}"

Generate diverse SERP queries, call serp_search for each, then call finalize_candidates with your deduped list.`;

  return { system, user };
}

export function buildSynthesisPrompt(q: ScoutQuery, enriched: unknown[], nicheDemand: { count: number; rank_signal: number | null } | null = null): PromptPair {
  const system = `You are a GTM analyst ranking long-tail business operators and writing a single-sentence sales angle for each.

For each operator, output:
- rank (1 = strongest fit for the query)
- sales_angle: ONE sentence, specific, evidence-grounded. Reference at least one concrete fact from the enrichment record (hiring role, headline, demand score, or a phrase from the "about" field). Bad angles use vague language like "established presence" or "strong demand"; good angles cite specifics.

Rules:
- NEVER invent facts. Only use data present in the enrichment record.
- If hiring data is empty, do NOT say "actively hiring" or "growing team".
- Rank by: relevance to query > evidence of recent activity (hiring count, news headlines) > size-fit (smaller = better for "long tail") > demand signal score.

**HARD REJECT — drop these from the output entirely:**
- Aggregator/directory pages (GAF, CertainTeed, Angi, Houzz, HomeAdvisor, Thumbtack, BuildZoom, DownToBid, Modernize, Trustpilot, etc. — even if the URL hostname is for a real brand)
- Manufacturer "find a contractor" portals (CertainTeed-approved contractors, GAF-certified, IKO Shield contractors, etc.)
- Generic SEO content farms (fixr.com cost guides, "Best of Houston" lists, "Top 10 Roofers" review pages)
- Manufacturers themselves (e.g., the roofing material maker is NOT a roofing contractor)
- News articles, blog posts, "How much does X cost" pages

**KEEP — what makes the cut:**
- A single operator's own homepage (looks like Bob's Roofing Inc on its own .com, not a sub-page of a directory)
- The URL hostname matches the operator name (Braun's Roofing → braunsroofing.com)
- Multi-location operator's own site (one regional brand operating across cities)

Include as many real operators as possible from the input. Aim for 70-90% of the legitimate ones. Be ruthless about cutting aggregators and manufacturers even if they have rich enrichment data.
- Output strictly the JSON schema. No prose. No surrounding markdown fences.

Example of a GOOD sales angle (uses concrete scraped facts):
  "Posted 3 RF-engineer roles in the last 30 days; site mentions Lunar Gateway program — likely a fit if our tool helps small space subcontractors hit RFP deadlines."

Example of a BAD sales angle (vague):
  "Strong demand signal and established presence make this a good fit."`;

  const niche = nicheDemand
    ? `Niche-level demand context (from a private 3.97M-business index): the niche keyword has ${nicheDemand.count} matching businesses in the index${nicheDemand.rank_signal !== null ? ` (demand component score ${nicheDemand.rank_signal}/100)` : ""}. Interpret as market size — high count = crowded/active niche, low count = rare/niche.\n\n`
    : "";

  const user = `Query:
Niche: ${q.niche}
City: ${q.city}

${niche}Enriched candidates (JSON):
${JSON.stringify(enriched, null, 2)}

Output JSON: { "operators": [ { "name": "...", "url": "...", "rank": 1, "sales_angle": "..." }, ... ] }`;

  return { system, user };
}
