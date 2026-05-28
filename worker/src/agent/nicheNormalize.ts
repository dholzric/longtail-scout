/**
 * Niche normalization — strip a raw user query down to the keyword that matches our
 * 7M-business demand index. Used by:
 *   - synthesize.ts  → demand-lookup for the niche-level context shown in the result page
 *   - businesses.ts  → demand-research probe under the query input
 *   - prewarm cron   → which niches to pre-warm into KV
 *
 * Frontend mirror: web/src/components/DemandProbe.tsx parseNiche(). The regex set MUST stay in
 * sync between these two files — if the UI says "82,200 businesses" but synthesis cites a
 * different count, the demo story falls apart (Codex live-run finding #4, 2026-05-28).
 *
 * Transformations applied (in order):
 *   1. Strip trailing " in <city>" / " near <city>" / " around <city>" / " @ <city>" if present.
 *   2. Iteratively strip trailing qualifier words: "contractors", "firms", "centers", etc.
 *      Iterative because two-word qualifiers exist: "law firms" → strip "firms" → "law".
 *   3. Strip stop-words (articles, prepositions) and collapse whitespace.
 *
 * Examples:
 *   "roofing contractors in Houston"        → "roofing"
 *   "law firms in California"               → "law"
 *   "pediatric dental practices"            → "pediatric dental"
 *   "boutique hotels in Miami"              → "boutique hotels"  (no qualifier word)
 *   "commercial HVAC installers near Tampa" → "commercial HVAC"
 */

/** Words we strip from the *end* of the niche (one at a time, iteratively). These are the
 *  qualifiers operators add to their own self-description that get in the way of an exact
 *  index keyword match. Order matters within each alternation: longer words first when
 *  prefixes would otherwise capture them. */
const TRAILING_QUALIFIERS = /\s+(contractors?|firms?|practices?|services?|centers?|shops?|businesses?|companies?|providers?|specialists?|professionals?|technicians?|installers?|locations?|stores?|studios?|salons?|offices?)$/i;

/** Stop-words to remove globally — articles, prepositions, generic "business" filler. */
const STOP_WORDS = /\b(companies|firms|operators|businesses|the|a|an)\b/gi;

export function normalizeNicheKey(raw: string): string {
  let s = (raw ?? "").trim();
  if (!s) return "";

  // (1) Strip trailing " in <city>" etc. so we keep the niche when normalization is called on
  //     a raw user query (DemandProbe gets the raw query; synthesize gets q.niche which is
  //     already city-stripped — this is a safe no-op there).
  const cityMatch = s.match(/^\s*(.+?)\s+(?:in|near|around|@)\s+(.+?)\s*$/i);
  if (cityMatch && cityMatch[1]) s = cityMatch[1].trim();

  // (2) Iteratively strip trailing qualifier words.
  let prev = "";
  while (prev !== s) {
    prev = s;
    s = s.replace(TRAILING_QUALIFIERS, "").trim();
  }

  // (3) Remove stop-words + collapse whitespace.
  s = s.replace(STOP_WORDS, "").replace(/\s+/g, " ").trim();

  // Defensive: never return empty. If we stripped everything (rare), fall back to the raw input.
  return s || raw.trim();
}
