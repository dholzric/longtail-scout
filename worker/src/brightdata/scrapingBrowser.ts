import { cachedFetch } from "../cache";

/**
 * Heuristic: returns true if the URL looks like a JS-heavy ATS page that needs
 * a real browser to render. Used by enrichment to decide between
 * webUnlocker (cheap, fast) and scrapingBrowser (expensive, slow, reliable).
 */
export function needsBrowser(url: string): boolean {
  return /greenhouse\.io|lever\.co|workday\.com|ashbyhq\.com|myworkdayjobs\.com/i.test(url);
}

export interface BrowserPage {
  url: string;
  text: string;
  links: string[];
}

/**
 * Calls Bright Data via the unified `/request` endpoint with `render: true`,
 * which (for `unblocker`-style zones) triggers a real browser render.
 * NOTE: pure `browser_api` zones cannot be hit via REST; they require WSS/CDP.
 * If this is wired against a browser_api zone, expect 403s with x-brd-err-code
 * client_10090. In that case we either swap to an unblocker zone or use a
 * separate Playwright bridge.
 */
export async function scrapingBrowserFetch(
  url: string,
  zone: string,
  apiKey: string
): Promise<BrowserPage> {
  const res = await fetch("https://api.brightdata.com/request", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ zone, url, format: "raw", render: true })
  });
  if (!res.ok) {
    throw new Error(`scrapingBrowserFetch ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json() as { body?: string };
  const html = data.body ?? "";
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const links = Array.from(html.matchAll(/href=["']([^"']+)["']/g))
    .map(m => m[1] as string)
    .slice(0, 100);
  return { url, text, links };
}

export async function scrapingBrowserCached(
  url: string,
  zone: string,
  apiKey: string,
  kv: KVNamespace
): Promise<BrowserPage> {
  return cachedFetch(
    kv,
    "scraping_browser",
    { url },
    { ttlSeconds: 604800 },
    () => scrapingBrowserFetch(url, zone, apiKey)
  );
}
