/**
 * Operator-name cleanup (v1.7.2).
 *
 * Page <title>s come back as SEO cruft — "Houston Roofing Contractor | Advanced Roofing Solutions",
 * "Lone Star Roofing - Houston Roofing Company". This splits on title separators and picks the
 * segment that best matches the operator's own domain (the brand), with the domain's leading token
 * as a tiebreak. Conservative by design: it never invents a name, and when the domain gives no
 * signal it returns the first segment unchanged.
 */
const PLATFORM_SUFFIX_RE = /\s*[|｜]\s*(LinkedIn|Facebook|Instagram|Twitter|X|YouTube|Yelp)\s*$/i;
const HOME_SUFFIX_RE = /\s*[-|｜–—:]\s*(home|homepage|official site|official website)\s*$/i;
const WELCOME_PREFIX_RE = /^(welcome to|home)\s*[-|｜–—:]?\s*/i;
const SEP_RE = / *[|｜•·]+ *| +[–—-] +| +: +/;
const SMALL = new Set(["the", "and", "of", "a", "an", "for", "to", "in", "at", "by"]);
const MAX_LEN = 80;

function truncate(s: string): string {
  return s.length > MAX_LEN ? s.slice(0, MAX_LEN).trim() : s;
}

/** First dot-label of the host, alnum-only ("www.advancedroofinghouston.com" → "advancedroofinghouston"). */
function domainKey(url?: string): string {
  if (!url) return "";
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return (host.split(".")[0] ?? "").replace(/[^a-z0-9]/g, "");
  } catch {
    return "";
  }
}

function significantWords(seg: string): string[] {
  return seg.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length >= 3 && !SMALL.has(w));
}

export function cleanOperatorName(raw: string, url?: string): string {
  let s = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!s) return "";
  s = s.replace(PLATFORM_SUFFIX_RE, "").replace(HOME_SUFFIX_RE, "").replace(WELCOME_PREFIX_RE, "").trim();
  if (!s) return "";

  const segs = s.split(SEP_RE).map(x => x.trim()).filter(Boolean);
  if (segs.length <= 1) return truncate(s);

  const dk = domainKey(url);
  if (!dk) return truncate(segs[0]!);

  let best = segs[0]!;
  let bestComposite = -1;
  let bestRawScore = 0;
  for (const seg of segs) {
    const words = significantWords(seg);
    const rawScore = words.filter(w => dk.includes(w)).length;
    const starts = words.length > 0 && dk.startsWith(words[0]!) ? 1 : 0;
    // domain-matches dominate; leading-token match breaks ties; brevity is a final nudge.
    const composite = rawScore * 100 + starts * 10 + Math.max(0, 5 - words.length);
    if (composite > bestComposite) {
      bestComposite = composite;
      bestRawScore = rawScore;
      best = seg;
    }
  }
  // No segment shares anything with the domain → don't guess; return the first segment.
  if (bestRawScore <= 0) return truncate(segs[0]!);
  return truncate(best);
}
