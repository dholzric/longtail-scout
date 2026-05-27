/**
 * /api/businesses — proxy to the demand-API geotagged business index.
 *
 * Fronted by the worker so the SPA has one origin (no CORS) and we get free KV caching
 * (90% of hackathon judges will hit the same niche/city pairs). Returns lat/lng/rating
 * records for the heat-map underlay on the map view.
 */
import type { Env } from "../index";

interface BusinessRecord {
  name: string;
  city: string | null;
  state: string | null;
  lat: number;
  lng: number;
  rating: number | null;
  review_count: number | null;
  website: string | null;
  category: string | null;
  address: string | null;
}

interface BusinessesResponse {
  query: string;
  city: string | null;
  state: string | null;
  count: number;
  businesses: BusinessRecord[];
  cached?: boolean;
}

export async function businessesHandler(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const city = (url.searchParams.get("city") ?? "").trim() || null;
  const state = (url.searchParams.get("state") ?? "").trim() || null;
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "200", 10) || 200, 1), 500);

  if (!q || q.length > 80) {
    return Response.json({ error: "missing or invalid q param" }, { status: 400 });
  }

  const cacheKey = `businesses:${q}:${city ?? ""}:${state ?? ""}:${limit}`;
  const cached = await env.CACHE.get(cacheKey, "json") as BusinessesResponse | null;
  if (cached) {
    return Response.json({ ...cached, cached: true }, {
      headers: { "cache-control": "public, max-age=300" }
    });
  }

  const upstream = new URL("/api/businesses", env.DEMAND_API_BASE);
  upstream.searchParams.set("q", q);
  if (city) upstream.searchParams.set("city", city);
  if (state) upstream.searchParams.set("state", state);
  upstream.searchParams.set("limit", String(limit));

  let resp: Response;
  try {
    resp = await fetch(upstream.toString(), {
      headers: { "user-agent": "longtailscout-worker/1.0" }
    });
  } catch (err) {
    return Response.json({ error: "demand api unreachable", detail: (err as Error).message }, { status: 502 });
  }
  if (!resp.ok) {
    return Response.json({ error: "demand api error", status: resp.status }, { status: 502 });
  }
  const body = await resp.json() as BusinessesResponse;
  // Scraper sometimes records the same business across multiple passes — dedupe by
  // (rounded lat/lng + lowercased name) and keep the row with the highest review_count.
  const deduped = dedupeBusinesses(body.businesses);
  const final: BusinessesResponse = { ...body, businesses: deduped, count: deduped.length };
  // 1-hour cache — demand index updates only via batch scrapes.
  await env.CACHE.put(cacheKey, JSON.stringify(final), { expirationTtl: 3600 });
  return Response.json(final, {
    headers: { "cache-control": "public, max-age=300" }
  });
}

/** Lightweight passthrough to /api/research on the demand-API. Used by the live "N businesses match this niche" probe under the query input. */
export async function demandResearchHandler(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  if (!q || q.length < 3 || q.length > 80) return Response.json({ error: "invalid q" }, { status: 400 });
  const cacheKey = `demand-research:${q}`;
  const cached = await env.CACHE.get(cacheKey, "json") as { query: string; demand: number } | null;
  if (cached) return Response.json({ ...cached, cached: true }, { headers: { "cache-control": "public, max-age=600" } });
  const upstream = new URL("/api/research", env.DEMAND_API_BASE);
  upstream.searchParams.set("q", q);
  upstream.searchParams.set("tlds", "com");
  upstream.searchParams.set("limit", "1");
  try {
    const r = await fetch(upstream.toString(), { headers: { "user-agent": "longtailscout-worker/1.0" } });
    if (!r.ok) return Response.json({ error: "upstream error" }, { status: 502 });
    const j = await r.json() as { query?: string; demand?: number };
    const out = { query: j.query ?? q, demand: typeof j.demand === "number" ? j.demand : 0 };
    await env.CACHE.put(cacheKey, JSON.stringify(out), { expirationTtl: 600 });
    return Response.json(out, { headers: { "cache-control": "public, max-age=600" } });
  } catch (err) {
    return Response.json({ error: "demand api unreachable", detail: (err as Error).message }, { status: 502 });
  }
}

function dedupeBusinesses(rows: BusinessRecord[]): BusinessRecord[] {
  const byKey = new Map<string, BusinessRecord>();
  for (const r of rows) {
    if (typeof r.lat !== "number" || typeof r.lng !== "number") continue;
    const key = `${r.lat.toFixed(4)}|${r.lng.toFixed(4)}|${(r.name ?? "").toLowerCase().trim()}`;
    const existing = byKey.get(key);
    if (!existing || (r.review_count ?? 0) > (existing.review_count ?? 0)) {
      byKey.set(key, r);
    }
  }
  return Array.from(byKey.values()).sort((a, b) => (b.review_count ?? 0) - (a.review_count ?? 0));
}
