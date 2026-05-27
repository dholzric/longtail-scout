import { cachedFetch } from "../cache";
import { bridgeRender, type BridgeAuth } from "../bridge/client";

export interface ScrapedPage {
  url: string;
  html: string;
  fetched_at: string;
}

export async function webScraperGeneric(
  url: string,
  bridge: BridgeAuth
): Promise<ScrapedPage> {
  const r = await bridgeRender(url, {}, bridge);
  return { url: r.url, html: r.html, fetched_at: r.fetched_at };
}

export async function webScraperCached(
  url: string,
  bridge: BridgeAuth,
  kv: KVNamespace
): Promise<ScrapedPage> {
  return cachedFetch(
    kv,
    "web_scraper",
    { url },
    { ttlSeconds: 604800 },
    () => webScraperGeneric(url, bridge)
  );
}
