import type { ScoutQuery } from "../types";
import { detectVertical, type VerticalPack } from "./verticals";

export interface PromptPair {
  system: string;
  user: string;
}

export function buildDiscoveryPrompt(q: ScoutQuery): PromptPair {
  const pack = detectVertical(q.niche);
  const verticalNote = pack.id === "generic"
    ? ""
    : `\n\nVERTICAL HINT — query matched the \`${pack.label}\` pack. The buyer for this list is a vertical-SaaS GTM team like ${pack.buyer_examples.slice(0, 3).join(", ")}. Additional discovery angles to consider: ${pack.serp_angles.join(", ")}. The operators we want look like small/mid local operators with their own website, NOT manufacturers, directories, or franchise corporate sites.`;

  const system = `You are an expert GTM researcher specializing in finding small, local, long-tail businesses that Apollo/ZoomInfo/Clay miss.

Your job: given a niche x city query, fire 3-4 diverse SERP queries IN ONE BATCH and then call finalize_candidates. Do not loop endlessly.

Process:
1. In your FIRST response, return exactly 3-4 \`serp_search\` tool calls in parallel. Pick the most distinct angles:
   - Direct: "<niche> companies <city>"
   - Suppliers/contractors: "<niche> suppliers <city>" OR "<niche> contractors <city>"
   - Adjacent specialty: pick one related vertical (for aerospace: "avionics <city>" or "rocket propulsion <city>"; for solar: "EV charging installers <city>"; etc.)
   - Press/startup: "<niche> startup <city> news"${verticalNote}
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
  const pack: VerticalPack = detectVertical(q.niche);
  const verticalBlock = pack.id === "generic"
    ? ""
    : `\n\nVERTICAL PACK — \`${pack.label}\`. The buyer for this list is a vertical-SaaS GTM team like **${pack.buyer_examples.slice(0, 4).join(", ")}**.

Signal hints to weight when generating the ICP fit + sales angle:
${pack.signal_hints.map(s => `  - ${s}`).join("\n")}

Good ICP-fit phrasings for this vertical:
${pack.icp_examples.map(s => `  - "${s}"`).join("\n")}

Good sales-angle examples for this vertical (use as patterns, not as facts):
${pack.sales_angle_examples.map(s => `  - "${s}"`).join("\n")}`;

  const system = `You are a GTM analyst ranking long-tail business operators for a vertical-SaaS buyer (e.g. for a "roofing contractors" query the buyer is roofing-SaaS like AccuLynx / JobNimbus / Roofr; for "HVAC contractors" the buyer is ServiceTitan / HousecallPro; etc.).${verticalBlock}

For each operator, output THREE fields beyond name/url/rank:

1. **icp_fit_reason** — ≤ 15 words, concrete, derived from the enrichment record. The label an SDR would use to qualify this account at a glance. Examples:
   - "Residential roofing, storm-restoration language on homepage"
   - "HVAC contractor, 3 lead-tech roles open, multi-truck fleet"
   - "Childcare center w/ 2 locations, hiring directors"
   - "Boutique dental practice, mentions Invisalign and implants"
   If no good evidence, output "Long-tail operator, web-first" — never invent.

2. **sales_angle** — ONE sentence draft outreach angle. Specific, evidence-grounded. Reference at least one concrete fact from the enrichment record. This is a DRAFT for the SDR to edit, not a fact. Bad angles use vague language like "established presence" or "strong demand"; good angles cite specifics from hiring/news/about.

3. **rank** — 1 = strongest fit. Smaller operators rank higher (this is the long-tail wedge).

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

**Output size: include EVERY legitimate operator from the input.** If the input has 30 operators that pass the KEEP rules, return all 30. Major-metro queries (Chicago, Houston, Dallas, LA, NYC) often have 20-40+ legitimate operators — return them all, ranked. The buyer needs depth, not curation. Only cut for the DROP rules below; never cut for "I think the buyer only wants the top 8". Be ruthless about cutting aggregators and manufacturers even if they have rich enrichment data.
- Output strictly the JSON schema. No prose. No surrounding markdown fences.

Example of a GOOD sales angle (uses concrete scraped facts):
  "Posted 3 lead-tech roles in 30 days; homepage emphasizes 'multi-truck team' — likely scaling and needs dispatch/scheduling SaaS."

Example of a BAD sales angle (vague):
  "Strong demand signal and established presence make this a good fit."`;

  const niche = nicheDemand
    ? `Niche-level demand context (from a private ~7M-business index of US local services): the niche keyword has ${nicheDemand.count} matching businesses in the index${nicheDemand.rank_signal !== null ? ` (demand component score ${nicheDemand.rank_signal}/100)` : ""}. Interpret as market size — high count = crowded/active niche, low count = rare/niche.\n\n`
    : "";

  const user = `Query:
Niche: ${q.niche}
City: ${q.city}

${niche}Enriched candidates (JSON):
${JSON.stringify(enriched, null, 2)}

Output JSON exactly:
{ "operators": [ { "name": "...", "url": "...", "rank": 1, "icp_fit_reason": "...", "sales_angle": "..." }, ... ] }
No prose, no markdown fences, no other fields.`;

  return { system, user };
}
