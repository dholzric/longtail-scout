import type { Operator } from "../types";

/**
 * Compute a 0-100 confidence score for an operator.
 *
 * Rank answers "who should I look at first?"
 * Confidence answers "how much should I trust this record?"
 *
 * A low-confidence-but-interesting row should still show up — just labeled honestly.
 *
 * Factors (additive, capped at 100):
 *   +30 for the homepage scrape succeeding (we have an `about`)
 *   +15 if hostname matches operator name (e.g. Braun's Roofing → braunsroofing.com)
 *   +15 if we have a size estimate
 *   +20 if hiring source URL present (+5 per role up to +10)
 *   +10 if recent_activity has ≥ 1 headline
 *   +10 if we have ≥ 3 source citations
 *   +10 if geocoded
 *   -25 if URL has a fragment / aggregator-ish path
 */
export function computeConfidence(op: Pick<Operator, "name" | "url" | "sources" | "about" | "size_estimate" | "hiring" | "recent_activity" | "geo">): number {
  let score = 0;
  if (op.about && op.about.length > 30) score += 30;
  if (op.size_estimate) score += 15;
  if (op.hiring?.source) {
    score += 20;
    score += Math.min(op.hiring.roles?.length ?? 0, 2) * 5;
  }
  if ((op.recent_activity?.length ?? 0) >= 1) score += 10;
  if ((op.sources?.length ?? 0) >= 3) score += 10;
  if (op.geo) score += 10;

  // Hostname-vs-name match heuristic
  try {
    const host = new URL(op.url).hostname.toLowerCase().replace(/^www\./, "");
    const nameWords = op.name
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter(w => w.length >= 4 && !/^(the|inc|llc|company|corp|group|services|service|solutions)$/.test(w));
    if (nameWords.some(w => host.includes(w))) score += 15;
  } catch { /* skip */ }

  // Penalties
  if (op.url.includes("#:~:text=")) score -= 25;
  if (/\/list\/|\/top-\d+|\/articles?\//.test(op.url)) score -= 25;

  return Math.max(0, Math.min(100, score));
}
