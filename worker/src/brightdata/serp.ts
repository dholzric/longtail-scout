import { cachedFetch } from "../cache";
import { bridgeSerp, type BridgeAuth } from "../bridge/client";
import { serpApiSearch } from "./serpApi";
import { ddgSearch } from "./ddgFallback";

export interface SerpResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

export interface SerpResponse {
  query: string;
  results: SerpResult[];
  /** Which provider served this response — surfaced in the trace so we can see at a glance whether SerpAPI or BD or DDG handled each query. */
  source?: "serpapi" | "bridge" | "ddg" | "none";
}

interface SerpEnv {
  bridge: BridgeAuth;
  serpApiKey?: string;
}

/**
 * Three-tier SERP path. Order: SerpAPI (fast JSON) → BD bridge (rendered google.com) → DDG HTML.
 * Each tier is tried only if the previous returned 0 usable results.
 *
 * SerpAPI: ~1-2s, $50/mo flat. Only used when SERPAPI_KEY is set.
 * BD bridge: ~10-15s, ~$0.005/render. Default path when no SerpAPI.
 * DDG HTML: ~1-2s, free, lower-quality results. Last-resort robustness fallback.
 */
export async function serpSearch(
  query: string,
  env: SerpEnv,
  opts: { num?: number } = {}
): Promise<SerpResponse> {
  const num = opts.num ?? 20;

  // Tier 1 — SerpAPI when configured
  if (env.serpApiKey) {
    const r = await serpApiSearch(query, env.serpApiKey, { num });
    if (r.results.length > 0) return { ...r, source: "serpapi" };
  }

  // Tier 2 — Bright Data Scraping Browser via the bridge
  try {
    const data = await bridgeSerp(query, { num }, env.bridge);
    if (data.results.length > 0) {
      return {
        query: data.query,
        source: "bridge",
        results: data.results.map((r, i) => ({
          title: r.title,
          link: r.link,
          snippet: r.snippet,
          position: r.position || i + 1
        }))
      };
    }
  } catch { /* tier 3 fallback */ }

  // Tier 3 — DuckDuckGo HTML plain-fetch (last-resort robustness)
  const ddg = await ddgSearch(query, { num });
  if (ddg.results.length > 0) return { ...ddg, source: "ddg" };
  return { query, results: [], source: "none" };
}

export async function serpSearchCached(
  query: string,
  env: SerpEnv,
  kv: KVNamespace,
  opts: { num?: number } = {}
): Promise<SerpResponse> {
  return cachedFetch(
    kv,
    "serp",
    { query, num: opts.num ?? 20 },
    { ttlSeconds: 86400 },
    () => serpSearch(query, env, opts)
  );
}
