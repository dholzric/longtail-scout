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

/** Shared bearer-token gate. The 7M-record demand index is our moat — anonymous traffic
 *  must not be able to enumerate it. Frontend components pass the demo password as
 *  Authorization: Bearer <PASSWORD>. */
function demandAuthorized(req: Request, env: Env): boolean {
  if (!env.DEMO_PASSWORD) return true;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${env.DEMO_PASSWORD}`;
}

export async function businessesHandler(req: Request, env: Env): Promise<Response> {
  if (!demandAuthorized(req, env)) {
    return Response.json({ error: "auth required — set Authorization: Bearer <DEMO_PASSWORD>" }, { status: 401 });
  }
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const city = (url.searchParams.get("city") ?? "").trim() || null;
  const state = (url.searchParams.get("state") ?? "").trim() || null;
  // Cap at 1000. The demand index front-loads duplicate rows (the same operator recorded across
  // many crawl passes), so a 200-row page dedupes to very few distinct businesses (~16 for
  // roofing/Houston) while a 1000-row page yields ~199 — the difference between a sparse and a
  // dense heat-map. The index is already gated behind the demo password, so the enumeration
  // concern is moot; density wins for the demo.
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "1000", 10) || 1000, 1), 1000);

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

/** The niches we proactively pre-warm into KV so first-time visitors see instant probe results. */
const PREWARM_NICHES = [
  "roofing", "hvac", "dental", "childcare", "law", "msp", "auto repair", "hotel",
  "plumbing", "electrician", "landscaping", "fitness", "yoga", "salon", "tattoo",
  "real estate", "accounting", "marketing agency", "insurance", "veterinary",
  "restaurant", "brewery", "photographer", "trucking", "construction"
];

/** Niches the LLM (in niche-recon) consistently picks from across product descriptions. We
 *  pre-warm the full /api/businesses sample (not just the count) so judges hitting niche-recon
 *  on a cold visit get warm KV instead of 8-10s upstream calls per niche. */
const PREWARM_NICHE_SAMPLES = [
  "roofing", "plumbing", "electrical", "electrician", "hvac", "landscaping",
  "lawn care", "pest control", "pool service", "tree service", "septic tank service",
  "garage door repair", "cleaning service", "auto repair", "auto detailing",
  "dental clinic", "chiropractor", "veterinary clinic", "pet grooming",
  "hair salon", "barber", "spa", "tattoo shop", "massage therapy", "nail salon",
  "photography studio", "yoga studio", "fitness studio", "personal training",
  "law firm", "accounting firm", "real estate agency", "restaurant", "brewery"
];

/**
 * Pre-warm KV with demand-index counts AND niche-recon business samples for the most common
 * niches. Called by the daily cron so first-time visitors see instant probe results AND
 * niche-recon hits warm cache for the verticals the LLM usually suggests.
 *
 * Why two passes: /api/research (count only) is fast (~1s) but /api/businesses (sample) is
 * slow (~8-12s). The cron is the right place to absorb the slow path so judge demos don't.
 *
 * Sequential, not parallel — the .29 demand server serializes internally, so 30 parallel
 * calls take longer than 30 sequential ones.
 */
export async function prewarmDemandIndex(env: Env): Promise<{ warmed: number; failed: number }> {
  let warmed = 0;
  let failed = 0;

  // Pass 1: demand-research counts (used by the DemandProbe under the query input).
  for (const niche of PREWARM_NICHES) {
    const q = niche.toLowerCase();
    const cacheKey = `demand-research:${q}`;
    const existing = await env.CACHE.get(cacheKey, "json");
    if (existing) { warmed++; continue; }
    const upstream = new URL("/api/research", env.DEMAND_API_BASE);
    upstream.searchParams.set("q", q);
    upstream.searchParams.set("tlds", "com");
    upstream.searchParams.set("limit", "1");
    try {
      const r = await fetch(upstream.toString(), { headers: { "user-agent": "longtailscout-prewarm/1.0" } });
      if (!r.ok) { failed++; continue; }
      const j = await r.json() as { query?: string; demand?: number };
      const out = { query: j.query ?? q, demand: typeof j.demand === "number" ? j.demand : 0 };
      // 12h TTL — the cron runs daily, so by the time entries expire, the next cron has refreshed.
      await env.CACHE.put(cacheKey, JSON.stringify(out), { expirationTtl: 43200 });
      warmed++;
    } catch { failed++; }
  }

  // Pass 2: niche-recon business samples (the slow upstream call). Same cache shape as
  // worker/src/handlers/nicheRecon.ts → `nichebiz:v4:<niche>:30`.
  for (const niche of PREWARM_NICHE_SAMPLES) {
    const q = niche.toLowerCase();
    const SAMPLE_LIMIT = 30;
    const cacheKey = `nichebiz:v4:${q}:${SAMPLE_LIMIT}`;
    const existing = await env.CACHE.get(cacheKey, "json");
    if (existing) { warmed++; continue; }
    const upstream = new URL("/api/businesses", env.DEMAND_API_BASE);
    upstream.searchParams.set("q", q);
    upstream.searchParams.set("limit", String(SAMPLE_LIMIT));
    try {
      const r = await fetch(upstream.toString(), {
        headers: { "user-agent": "longtailscout-prewarm/1.0" },
        signal: AbortSignal.timeout(20000)
      });
      if (!r.ok) { failed++; continue; }
      const j = await r.json() as { businesses?: Array<Record<string, unknown>> };
      const raw = Array.isArray(j.businesses) ? j.businesses : [];
      // Compute thinness on raw rows (same logic as nicheRecon.ts isOwnDomain). We inline a
      // simplified version here to avoid pulling the full handler module into businesses.ts.
      const ownDomain = raw.filter(b => isOwnDomainSimple(b.website as string | null | undefined)).length;
      const raw_thinness = raw.length > 0 ? 1 - ownDomain / raw.length : 0;
      // Dedupe by website hostname || lowercased name. Mirrors nicheRecon.ts dedupeSample.
      const seen = new Set<string>();
      const sample = raw.filter(b => {
        const w = b.website as string | null | undefined;
        const n = (b.name as string | undefined) ?? "";
        let key: string;
        if (w && w.length > 4) {
          try { key = `w:${new URL(w).hostname.replace(/^www\./, "").toLowerCase()}`; }
          catch { key = `n:${n.toLowerCase().trim()}`; }
        } else {
          key = `n:${n.toLowerCase().trim()}`;
        }
        if (!key || key === "n:" || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const payload = { sample, raw_count: raw.length, raw_thinness, saturated: raw.length >= SAMPLE_LIMIT };
      await env.CACHE.put(cacheKey, JSON.stringify(payload), { expirationTtl: 43200 });
      warmed++;
    } catch { failed++; }
  }

  return { warmed, failed };
}

/** Mirror of nicheRecon.ts isOwnDomain — kept in sync but inlined to avoid cross-module deps
 *  in businesses.ts (which is loaded by the cron). If this list drifts from nicheRecon.ts the
 *  thinness shown to a cold-cache visitor would differ from a warm one. */
const PREWARM_PLATFORM_HOSTS = new Set([
  "booksy.com", "getsquire.com", "servicetitan.com", "boulevard.io", "dashboard.boulevard.io",
  "vagaro.com", "phorest.com", "phorest.co", "mindbodyonline.com", "clients.mindbodyonline.com",
  "styleseat.com", "thumbtack.com", "yelp.com", "facebook.com", "fb.com", "m.facebook.com",
  "instagram.com", "linktr.ee", "linkedin.com", "tiktok.com", "yellowpages.com", "angi.com",
  "homeadvisor.com", "bbb.org", "manta.com", "sites.google.com", "business.google.com",
  "google.com", "googleusercontent.com", "g.page", "maps.google.com", "goo.gl",
  "square.site", "squareup.com", "wix.com", "wixsite.com", "weebly.com", "godaddysites.com",
  "shopify.com", "myshopify.com", "tripadvisor.com", "opentable.com", "resy.com",
  "schedulista.com", "setmore.com", "calendly.com", "acuityscheduling.com", "fresha.com",
  "joinblvd.com", "joinhonk.com"
]);

function isOwnDomainSimple(website: string | null | undefined): boolean {
  if (!website || website.length < 5) return false;
  try {
    const u = new URL(website);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (PREWARM_PLATFORM_HOSTS.has(host)) return false;
    if (PREWARM_PLATFORM_HOSTS.has(host.replace(/^[^.]+\./, ""))) return false;
    return true;
  } catch {
    return false;
  }
}

/** Lightweight passthrough to /api/research on the demand-API. Used by the live "N businesses match this niche" probe under the query input. */
export async function demandResearchHandler(req: Request, env: Env): Promise<Response> {
  if (!demandAuthorized(req, env)) {
    return Response.json({ error: "auth required — set Authorization: Bearer <DEMO_PASSWORD>" }, { status: 401 });
  }
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
