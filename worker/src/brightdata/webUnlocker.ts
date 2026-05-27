import { cachedFetch } from "../cache";
import { bridgeRender, type BridgeAuth } from "../bridge/client";

export interface UnlockedPage {
  url: string;
  status: number;
  html: string;
  fetched_at: string;
}

export async function webUnlocker(
  url: string,
  bridge: BridgeAuth
): Promise<UnlockedPage> {
  const r = await bridgeRender(url, {}, bridge);
  return { url: r.url, status: r.status, html: r.html, fetched_at: r.fetched_at };
}

export async function webUnlockerCached(
  url: string,
  bridge: BridgeAuth,
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
