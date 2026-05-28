/**
 * LinkedIn-presence classifier — the pure half of v1.2.0 "Apollo-blind verification".
 *
 * Given an operator name and the organic results of a `site:linkedin.com/company "<name>"`
 * search (run through Bright Data by the handler), decide whether a LinkedIn *company* page
 * actually exists for THIS operator. A confirmed absence is the strongest possible proof of the
 * core thesis: Apollo/ZoomInfo/Clay are built on the LinkedIn graph, so an operator with no
 * company page is structurally invisible to them — but visible to us via their own website.
 *
 * Kept dependency-free and unit-tested (tests/linkedinPresence.test.ts) so the matching logic
 * can't silently regress.
 */

/** Legal/filler tokens that add noise to a business name match. */
const STOP_TOKENS = new Set([
  "the", "llc", "l.l.c", "inc", "inc.", "incorporated", "co", "co.", "company",
  "corp", "corp.", "corporation", "ltd", "ltd.", "and", "&", "of", "group"
]);

/** Lowercase, drop punctuation, and strip legal/filler tokens so "The Smith & Sons Co." and
 *  "Smith Sons" compare equal. */
export function normalizeBizName(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 0 && !STOP_TOKENS.has(t))
    .join(" ")
    .trim();
}

/** Is this a LinkedIn *company* page (not a personal /in/ profile, not a /posts/ share)? */
export function isLinkedInCompanyUrl(url: string): boolean {
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return false;
  return /^\/company\//i.test(u.pathname);
}

export interface SerpLikeResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

export interface LinkedInVerdict {
  on_linkedin: boolean;
  /** The matching LinkedIn company URL, if found. */
  evidence_url: string | null;
  /** How many distinct company results matched the operator name. */
  match_count: number;
}

/** Do the operator's name tokens overlap a result's title/snippet strongly enough to call it
 *  the same business? We require either a full normalized-name containment or a majority of the
 *  operator's significant tokens to appear. */
function nameMatches(opNorm: string, resultText: string): boolean {
  if (!opNorm) return false;
  const textNorm = normalizeBizName(resultText);
  if (!textNorm) return false;
  if (textNorm.includes(opNorm) || opNorm.includes(textNorm)) return true;
  const opTokens = opNorm.split(" ").filter(t => t.length >= 3);
  if (opTokens.length === 0) return false;
  const textTokens = new Set(textNorm.split(" "));
  const hits = opTokens.filter(t => textTokens.has(t)).length;
  return hits / opTokens.length >= 0.6;
}

export function classifyLinkedInResults(name: string, results: SerpLikeResult[]): LinkedInVerdict {
  const opNorm = normalizeBizName(name);
  let evidence_url: string | null = null;
  let match_count = 0;
  for (const r of results) {
    if (!isLinkedInCompanyUrl(r.link)) continue;
    // LinkedIn titles look like "Acme Roofing | LinkedIn" — the snippet adds the description.
    if (nameMatches(opNorm, `${r.title} ${r.snippet}`)) {
      match_count++;
      if (!evidence_url) evidence_url = r.link;
    }
  }
  return { on_linkedin: match_count > 0, evidence_url, match_count };
}
