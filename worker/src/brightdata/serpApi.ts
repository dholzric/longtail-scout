/**
 * SerpAPI client — third-party google.com SERP-as-JSON. ~1-2s per query, no browser render.
 * When SERPAPI_KEY env var is set, discovery prefers this over BD's google.com rendering;
 * massively cuts the discovery wall-clock (was 60-120s, now 5-10s for 4-5 parallel queries).
 *
 * Pricing: ~$50/mo for 5k searches. We use cached results aggressively (1d TTL via the
 * existing cachedFetch wrapper) so cold queries are the only paid ones.
 *
 * Docs: https://serpapi.com/search-api
 */
import type { SerpResponse, SerpResult } from "./serp";

const ENDPOINT = "https://serpapi.com/search";

interface SerpApiRawResult {
  position?: number;
  title?: string;
  link?: string;
  snippet?: string;
  displayed_link?: string;
}

interface SerpApiResponse {
  organic_results?: SerpApiRawResult[];
  error?: string;
}

export async function serpApiSearch(query: string, apiKey: string, opts: { num?: number } = {}): Promise<SerpResponse> {
  const num = Math.min(Math.max(opts.num ?? 25, 1), 100);
  const url = new URL(ENDPOINT);
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("num", String(num));
  url.searchParams.set("hl", "en");
  url.searchParams.set("gl", "us");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("output", "json");

  try {
    const resp = await fetch(url.toString(), {
      method: "GET",
      headers: { "accept": "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) return { query, results: [] };
    const data = await resp.json() as SerpApiResponse;
    if (data.error) return { query, results: [] };
    const results: SerpResult[] = (data.organic_results ?? []).slice(0, num).map((r, i) => ({
      title: (r.title ?? "").slice(0, 240),
      link: r.link ?? "",
      snippet: (r.snippet ?? "").slice(0, 400),
      position: r.position ?? i + 1,
    })).filter(r => r.link.startsWith("http"));
    return { query, results };
  } catch {
    return { query, results: [] };
  }
}
