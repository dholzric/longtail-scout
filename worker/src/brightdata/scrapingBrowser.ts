import { cachedFetch } from "../cache";
import { bridgeRender, type BridgeAuth } from "../bridge/client";

export function needsBrowser(url: string): boolean {
  return /greenhouse\.io|lever\.co|workday\.com|ashbyhq\.com|myworkdayjobs\.com/i.test(url);
}

export interface BrowserPage {
  url: string;
  text: string;
  links: string[];
}

export async function scrapingBrowserFetch(
  url: string,
  bridge: BridgeAuth
): Promise<BrowserPage> {
  // Pass a selector hint so the bridge waits for likely-content; falls through gracefully
  const r = await bridgeRender(url, { selector: "main, body", waitMs: 1500 }, bridge);
  const html = r.html;
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
  bridge: BridgeAuth,
  kv: KVNamespace
): Promise<BrowserPage> {
  return cachedFetch(
    kv,
    "scraping_browser",
    { url },
    { ttlSeconds: 604800 },
    () => scrapingBrowserFetch(url, bridge)
  );
}
