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
 * Three-tier SERP path. Order: DDG (free, plain fetch, ~1-2s) → BD bridge (rendered google.com,
 * ~10-15s, ~$0.005/render) → SerpAPI (paid JSON, only when SERPAPI_KEY is set).
 *
 * DDG-primary trade-off: slightly weaker SERP quality than google.com, but for our use case
 * (long-tail SMB websites) page 1 looks essentially the same. The 5-10× speedup vs BD-rendered
 * google.com pays back at every scout. BD stays as the robustness fallback when DDG returns 0.
 */
export async function serpSearch(
  query: string,
  env: SerpEnv,
  opts: { num?: number } = {}
): Promise<SerpResponse> {
  const num = opts.num ?? 20;

  // Tier 1 — DuckDuckGo HTML (free, fast, no auth)
  try {
    const ddg = await ddgSearch(query, { num });
    if (ddg.results.length > 0) return { ...ddg, source: "ddg" };
  } catch { /* tier 2 fallback */ }

  // Tier 2 — Bright Data Scraping Browser via the bridge (slower, paid, but excellent against
  // bot-protected SERPs and recovers when DDG returned 0)
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

  // Tier 3 — SerpAPI when configured (last-resort paid fallback)
  if (env.serpApiKey) {
    const r = await serpApiSearch(query, env.serpApiKey, { num });
    if (r.results.length > 0) return { ...r, source: "serpapi" };
  }

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
