import { brightDataFetch, BrightDataAuth } from "./client";
import { cachedFetch } from "../cache";

export interface UnlockedPage {
  url: string;
  status: number;
  html: string;
  fetched_at: string;
}

export async function webUnlocker(
  url: string,
  zone: string,
  auth: BrightDataAuth
): Promise<UnlockedPage> {
  const raw = await brightDataFetch(
    "https://api.brightdata.com/request",
    { zone, url, format: "raw" },
    auth
  ) as { body?: string; status_code?: number };
  return {
    url,
    status: raw.status_code ?? 200,
    html: raw.body ?? "",
    fetched_at: new Date().toISOString()
  };
}

export async function webUnlockerCached(
  url: string,
  zone: string,
  auth: BrightDataAuth,
  kv: KVNamespace
): Promise<UnlockedPage> {
  return cachedFetch(
    kv,
    "web_unlocker",
    { url },
    { ttlSeconds: 604800 },
    () => webUnlocker(url, zone, auth)
  );
}
