/**
 * Brave Search API client — third-party SERP-as-JSON.
 *
 * Free tier: 2k queries/month, 1 req/sec rate limit. ~1-2s per query.
 * Far cheaper than SerpAPI ($50/mo) and faster than scraping DDG HTML, with stable JSON
 * that doesn't break when DDG/Google tweak their layouts.
 *
 * Docs: https://api.search.brave.com/app/documentation/web-search
 */
import type { SerpResponse, SerpResult } from "./serp";

const ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

interface BraveResult {
  title?: string;
  url?: string;
  description?: string;
}

interface BraveResponse {
  web?: { results?: BraveResult[] };
  error?: { code?: string; detail?: string };
}

export async function braveSearch(query: string, apiKey: string, opts: { num?: number } = {}): Promise<SerpResponse> {
  // Brave caps count at 20 per query — we ask for that max and let downstream dedupe handle it.
  const count = Math.min(Math.max(opts.num ?? 20, 1), 20);
  const url = new URL(ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(count));
  url.searchParams.set("country", "us");
  url.searchParams.set("search_lang", "en");
  url.searchParams.set("safesearch", "off"); // hackathon: don't filter

  try {
    const resp = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "accept": "application/json",
        "accept-encoding": "gzip",
        "x-subscription-token": apiKey,
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!resp.ok) {
      // 429 = rate limited; just bail and let next tier try
      return { query, results: [] };
    }
    const data = await resp.json() as BraveResponse;
    if (data.error || !data.web?.results) return { query, results: [] };

    const results: SerpResult[] = data.web.results.slice(0, count).map((r, i) => ({
      title: (r.title ?? "").slice(0, 240),
      link: r.url ?? "",
      snippet: (r.description ?? "").replace(/<[^>]+>/g, "").slice(0, 400), // Brave's descriptions include <strong> tags for the matched terms
      position: i + 1,
    })).filter(r => r.link.startsWith("http"));
    return { query, results };
  } catch {
    return { query, results: [] };
  }
}
