import { brightDataFetch, BrightDataAuth } from "./client";
import { cachedFetch } from "../cache";

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
  zone: string,
  auth: BrightDataAuth,
  opts: { num?: number; country?: string } = {}
): Promise<SerpResponse> {
  const num = opts.num ?? 20;
  const params = new URLSearchParams({
    q: query,
    num: String(num),
    brd_json: "1"
  });
  if (opts.country) params.set("gl", opts.country);
  const targetUrl = `https://www.google.com/search?${params.toString()}`;

  const raw = await brightDataFetch(
    "https://api.brightdata.com/serp/req",
    { zone, url: targetUrl, format: "json" },
    auth
  ) as { organic?: Array<{ title: string; link: string; description?: string }> };

  const results: SerpResult[] = (raw.organic ?? []).map((r, i) => ({
    title: r.title,
    link: r.link,
    snippet: r.description ?? "",
    position: i + 1
  }));

  return { query, results };
}

export async function serpSearchCached(
  query: string,
  zone: string,
  auth: BrightDataAuth,
  kv: KVNamespace,
  opts: { num?: number; country?: string } = {}
): Promise<SerpResponse> {
  return cachedFetch(
    kv,
    "serp",
    { query, num: opts.num ?? 20, country: opts.country ?? null },
    { ttlSeconds: 86400 },
    () => serpSearch(query, zone, auth, opts)
  );
}
