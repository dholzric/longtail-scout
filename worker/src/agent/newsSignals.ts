/**
 * Signal-radar news classifier — the pure half of v1.6.0.
 *
 * Classifies the organic results of a live `"<name>" (funding OR expansion OR award …)` search
 * (run through Bright Data by the handler) into categorized, citation-linked buying signals.
 * Third-party news is the timeliest trigger an SDR can act on — so we exclude the operator's own
 * domain and social/aggregator hosts, and require the result to actually mention the operator.
 */
import { nameMatchesText } from "./linkedinPresence";

export type SignalCategory = "funding" | "expansion" | "leadership" | "award" | "hiring" | "launch" | "press";

export interface NewsSignal {
  category: SignalCategory;
  headline: string;
  url: string;
  source_host: string;
}

interface SerpLikeResult { title: string; link: string; snippet: string; position: number }

/** Social/aggregator/directory hosts that aren't real third-party press. */
const EXCLUDED_HOSTS = /(facebook|instagram|linkedin|tiktok|twitter|x|yelp|thumbtack|angi|yellowpages|bbb|google|pinterest|reddit|glassdoor|indeed|ziprecruiter)\./i;

// Ordered most- to least-specific: the first matching category wins. Each pattern anchors on a
// leading word boundary but NOT a trailing one, so stems match their suffixed forms
// (launch→launches, expand→expands, open→opens).
const CATEGORY_RULES: { category: SignalCategory; re: RegExp }[] = [
  { category: "funding", re: /\b(fund(ing|ed)|raise|invest|venture|capital|grant|acqui|merger)/i },
  { category: "leadership", re: /\b(appoint|names?\s+(new\s+)?(ceo|president|coo|cfo|director|owner)|hires?\s+[A-Z]|new\s+(ceo|president|owner|leadership)|promot|joins?\s+as)/i },
  { category: "expansion", re: /\b(expand|new\s+location|open|grand\s+opening|relocat|new\s+branch|new\s+office|second\s+location)/i },
  { category: "award", re: /\b(award|wins?|won|recogni[sz]|top\s+\d+|best\s+of|ranked|honored|named\s+to)/i },
  { category: "launch", re: /\b(launch|introduc|unveil|debut|rolls?\s+out|new\s+(service|product|plan|offering))/i },
  { category: "hiring", re: /\b(hiring|now\s+hiring|open\s+positions|adds?\s+jobs|workforce|expands?\s+team)/i }
];

function hostOf(url: string): string | null {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return null; }
}

function categorize(text: string): SignalCategory {
  for (const rule of CATEGORY_RULES) {
    if (rule.re.test(text)) return rule.category;
  }
  return "press";
}

export function classifyNewsResults(name: string, results: SerpLikeResult[], opHost?: string): NewsSignal[] {
  const ownHost = (opHost ?? "").replace(/^www\./, "").toLowerCase();
  const seen = new Set<string>();
  const out: NewsSignal[] = [];
  for (const r of results) {
    const host = hostOf(r.link);
    if (!host) continue;
    if (EXCLUDED_HOSTS.test(host)) continue;
    if (ownHost && host === ownHost) continue;
    const text = `${r.title} ${r.snippet}`.trim();
    if (!nameMatchesText(name, text)) continue;
    const dedupeKey = r.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push({ category: categorize(text), headline: r.title.trim(), url: r.link, source_host: host });
    if (out.length >= 8) break;
  }
  return out;
}
