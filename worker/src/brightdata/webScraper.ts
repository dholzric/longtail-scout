import { brightDataFetch, BrightDataAuth } from "./client";
import { cachedFetch } from "../cache";

export interface ScrapedPage {
  url: string;
  fields: Record<string, unknown>;
}

export async function webScraperGeneric(
  url: string,
  zone: string,
  auth: BrightDataAuth,
  extractFields: string[]
): Promise<ScrapedPage> {
  const raw = await brightDataFetch(
    "https://api.brightdata.com/request",
    { zone, url, format: "json", extract: extractFields },
    auth
  ) as { extracted?: Record<string, unknown> };
  return { url, fields: raw.extracted ?? {} };
}

export async function webScraperCached(
  url: string,
  zone: string,
  auth: BrightDataAuth,
  kv: KVNamespace,
  extractFields: string[]
): Promise<ScrapedPage> {
  return cachedFetch(
    kv,
    "web_scraper",
    { url, fields: extractFields },
    { ttlSeconds: 604800 },
    () => webScraperGeneric(url, zone, auth, extractFields)
  );
}
