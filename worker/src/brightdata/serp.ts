import { cachedFetch } from "../cache";
import { bridgeSerp, type BridgeAuth } from "../bridge/client";

export interface SerpResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

export interface SerpResponse {
  query: string;
  results: SerpResult[];
}

export async function serpSearch(
  query: string,
  bridge: BridgeAuth,
  opts: { num?: number } = {}
): Promise<SerpResponse> {
  const num = opts.num ?? 20;
  const data = await bridgeSerp(query, { num }, bridge);
  return {
    query: data.query,
    results: data.results.map((r, i) => ({
      title: r.title,
      link: r.link,
      snippet: r.snippet,
      position: r.position || i + 1
    }))
  };
}

export async function serpSearchCached(
  query: string,
  bridge: BridgeAuth,
  kv: KVNamespace,
  opts: { num?: number } = {}
): Promise<SerpResponse> {
  return cachedFetch(
    kv,
    "serp",
    { query, num: opts.num ?? 20 },
    { ttlSeconds: 86400 },
    () => serpSearch(query, bridge, opts)
  );
}
