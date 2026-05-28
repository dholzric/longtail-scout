/**
 * Plain-fetch DuckDuckGo HTML SERP fallback. Used when Bright Data's google.com rendering
 * returns 0 results — usually because BD's IP pool tripped a captcha / soft-block. DDG
 * accepts anonymous browser-shaped fetches without auth or rate-limit on the HTML endpoint.
 *
 * We parse the HTML with regex (no cheerio in the Worker — would inflate the bundle). DDG's
 * result anchors are reliably shaped like:
 *   <a class="result__a" href="//duckduckgo.com/l/?uddg=<encoded-real-url>&rut=...">Title</a>
 * with a sibling <a class="result__snippet">snippet text</a>.
 */
import type { SerpResponse, SerpResult } from "./serp";

const DDG_HTML_URL = "https://html.duckduckgo.com/html/";

const PLAIN_HEADERS: Record<string, string> = {
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "accept-encoding": "gzip, deflate, br",
  "referer": "https://duckduckgo.com/",
};

/** Decode the real URL out of DDG's `/l/?uddg=...` redirect wrapper. */
function unwrapDdgUrl(href: string): string {
  // Sometimes DDG protocol-relative: //duckduckgo.com/l/?uddg=...
  let u = href.startsWith("//") ? `https:${href}` : href;
  try {
    const parsed = new URL(u);
    const real = parsed.searchParams.get("uddg");
    if (real) return decodeURIComponent(real);
  } catch { /* fall through */ }
  return u;
}

/** Light HTML decoder — DDG's results have HTML entities in titles and snippets. */
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x?(\d+);/gi, (_, code) => String.fromCharCode(parseInt(code, /[a-f]/i.test(code) ? 16 : 10)))
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function ddgSearch(query: string, opts: { num?: number } = {}): Promise<SerpResponse> {
  const num = Math.min(Math.max(opts.num ?? 25, 1), 50);
  const url = new URL(DDG_HTML_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("kl", "us-en");

  let html: string;
  try {
    const resp = await fetch(url.toString(), {
      method: "GET",
      headers: PLAIN_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) return { query, results: [] };
    html = await resp.text();
  } catch {
    return { query, results: [] };
  }

  const results: SerpResult[] = [];
  const seenLinks = new Set<string>();
  // Capture each result block: <a class="result__a" href="...">Title</a> with optional snippet next.
  // We use a non-greedy match on the whole block so we can grab snippet if present.
  const blockRe = /<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>([\s\S]{0,800}?)(?=<a[^>]+result__a|<\/body|$)/gi;

  for (const m of html.matchAll(blockRe)) {
    if (results.length >= num) break;
    const rawHref = (m[1] ?? "").trim();
    const titleRaw = (m[2] ?? "").trim();
    const tail = (m[3] ?? "").trim();
    if (!rawHref || !titleRaw) continue;
    const link = unwrapDdgUrl(rawHref);
    if (!link.startsWith("http")) continue;
    if (seenLinks.has(link)) continue;
    // Skip DDG's own pages AND its ad-redirect endpoint. y.js is DDG's ad-tracker
    // (e.g. duckduckgo.com/y.js?ad_provider=...&ad_domain=...&u=...) — unwrapping leaves us
    // with the y.js URL itself, which then dies in enrichment with no useful signal.
    // (Codex live-run finding #1, 2026-05-28 — wasted one enrich slot per ad row.)
    if (/duckduckgo\.com\/(?:l\/|html\/|\?q=|y\.js)/i.test(link)) continue;
    // Bing also occasionally appears in DDG fallback results via cross-syndication.
    if (/bing\.com\/aclick/i.test(link)) continue;
    // Any link still carrying ad-provider tracking params after unwrap is an ad.
    if (/[?&](?:ad_provider|ad_domain|adurl)=/i.test(link)) continue;
    seenLinks.add(link);

    const title = decodeHtmlEntities(titleRaw);
    let snippet = "";
    const snipMatch = tail.match(/<a[^>]+class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
    if (snipMatch && snipMatch[1]) snippet = decodeHtmlEntities(snipMatch[1]).slice(0, 280);

    results.push({ title, link, snippet, position: results.length + 1 });
  }

  return { query, results };
}
