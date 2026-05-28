import { cachedFetch } from "../cache";
import { bridgeSerp, type BridgeAuth } from "../bridge/client";
import { serpApiSearch } from "./serpApi";
import { ddgSearch } from "./ddgFallback";
import { braveSearch } from "./braveSearch";

export interface SerpResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

export interface SerpResponse {
  query: string;
  results: SerpResult[];
  /** Which provider served this response — surfaced in the trace so we can see at a glance which tier handled each query. */
  source?: "brave" | "serpapi" | "bridge" | "ddg" | "none";
}

interface SerpEnv {
  bridge: BridgeAuth;
  braveApiKey?: string;
  serpApiKey?: string;
}

/**
 * Four-tier SERP path. Order optimized for speed × cost × reliability:
 *   Tier 1 — Brave Search API (2k/mo free, ~1-2s, structured JSON)
 *   Tier 2 — DuckDuckGo HTML (free, no auth, ~1-2s, regex parse) — robustness backstop
 *   Tier 3 — Bright Data bridge (rendered google.com, ~10-15s, ~$0.005/render) — best quality, slowest
 *   Tier 4 — SerpAPI ($50/mo flat) — last-resort when SERPAPI_KEY is set
 *
 * Each tier kicks in only when the previous returned 0 usable results. Cached at the
 * serpSearchCached layer (KV, 1d TTL) so repeat queries skip the network entirely.
 */
export async function serpSearch(
  query: string,
  env: SerpEnv,
  opts: { num?: number } = {}
): Promise<SerpResponse> {
  const num = opts.num ?? 20;

  // Tier 1 — Brave Search API (free 2k/mo, JSON, ~1-2s, no scraping)
  if (env.braveApiKey) {
    const r = await braveSearch(query, env.braveApiKey, { num });
    if (r.results.length > 0) return { ...r, source: "brave" };
  }

  // Tier 2 — DuckDuckGo HTML (free, no auth, robustness backstop when Brave returns 0 or rate-limits)
  try {
    const ddg = await ddgSearch(query, { num });
    if (ddg.results.length > 0) return { ...ddg, source: "ddg" };
  } catch { /* fall through */ }

  // Tier 3 — Bright Data Scraping Browser via the bridge (~10-15s, paid, but rendered google.com — best quality)
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
  } catch { /* fall through */ }

  // Tier 4 — SerpAPI (last-resort paid fallback, only when SERPAPI_KEY is set)
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
