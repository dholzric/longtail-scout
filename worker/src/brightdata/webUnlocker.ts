import { cachedFetch } from "../cache";
import { bridgeRender, type BridgeAuth } from "../bridge/client";

export interface UnlockedPage {
  url: string;
  status: number;
  html: string;
  fetched_at: string;
  /** Which path served this page — "plain" for direct fetch, "bridge" for BD Scraping Browser. */
  source?: "plain" | "bridge";
}

/** Realistic browser headers so plain-HTTP fetches aren't immediately flagged. */
const PLAIN_HEADERS: Record<string, string> = {
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "accept-encoding": "gzip, deflate, br",
  "cache-control": "no-cache",
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "sec-fetch-user": "?1",
  "upgrade-insecure-requests": "1"
};

/** Heuristic: did the cheap fetch get useful HTML, or did the site throw up a bot wall?
 *  Returns true when we should fall back to BD. */
function looksBlocked(status: number, html: string): boolean {
  if (status < 200 || status >= 400) return true;
  if (!html || html.length < 1000) return true;
  const t = html.toLowerCase();
  if (/cf-error|cloudflare ray|attention required|access denied|just a moment|checking your browser|captcha|distil|datadome|perimeterx|are you a robot|enable javascript and cookies to continue/i.test(t)) return true;
  // Heuristic: pure SPA shell — body is empty, all JS-loaded. We can't render JS in a plain fetch.
  const visibleBody = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").trim().length;
  if (visibleBody < 500) return true;
  return false;
}

/**
 * Plain HTTP fetch with realistic browser headers. Optional BD-bridge fallback.
 *
 * DESIGN NOTE (this was the slowness culprit): when this function fell back to bridge inside
 * enrichOne, the bridge mutex serialized ALL candidates' homepage fetches. Worse, Promise.race
 * budgets in the pool didn't actually cancel the in-flight bridge fetches — they kept running
 * in the background after their candidate was budget-cut, hogging Workers CPU and connection
 * slots that downstream synthesize then had to wait for.
 *
 * Enrichment now passes `bridge: undefined` so we plain-fetch only. ~60% of US-SMB homepages
 * serve plain HTML; the remaining ~40% that need JS rendering are skipped, losing some
 * operators but enrichment becomes naturally bounded by the 3s plain-fetch timeout. Result:
 * 25 candidates enrich in ~5-15s total instead of multiple minutes.
 *
 * Other callers (e.g. screenshot endpoint) can still pass a bridge to enable the BD fallback.
 */
export async function webUnlocker(
  url: string,
  bridge?: BridgeAuth
): Promise<UnlockedPage> {
  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: PLAIN_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(3000)
    });
    if (resp.ok) {
      const html = await resp.text();
      if (!looksBlocked(resp.status, html)) {
        return { url, status: resp.status, html, fetched_at: new Date().toISOString(), source: "plain" };
      }
    }
  } catch { /* fall through to BD if available */ }

  // BD bridge fallback — only if a bridge was passed. Callers that don't want the
  // ~12s bridge mutex queue can omit it and we'll throw on plain-fetch failure instead.
  if (!bridge) {
    throw new Error(`webUnlocker: plain fetch failed for ${url} and no bridge fallback provided`);
  }
  const r = await bridgeRender(url, {}, bridge);
  return { url: r.url, status: r.status, html: r.html, fetched_at: r.fetched_at, source: "bridge" };
}

export async function webUnlockerCached(
  url: string,
  bridge: BridgeAuth | undefined,
  kv: KVNamespace
): Promise<UnlockedPage> {
  return cachedFetch(
    kv,
    "web_unlocker",
    { url },
    { ttlSeconds: 604800 },
    () => webUnlocker(url, bridge)
  );
}
