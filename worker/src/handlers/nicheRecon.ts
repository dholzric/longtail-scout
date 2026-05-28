/**
 * /api/niche-recon — reverse the funnel.
 *
 * Input: { product_description } — a paragraph describing what the user sells.
 * Output: top 5 long-tail niches ranked by demand-density × Apollo-thinness.
 *
 * One LLM call expands the product description into ~10 candidate verticals, then we
 * cross-reference each candidate against the demand index for (a) total business count
 * and (b) website-coverage rate — businesses without a website are the long-tail
 * operators Apollo/ZoomInfo can't see. Score = log10(count) × thinness × long-tail
 * multiplier (penalizes ultra-mainstream verticals Apollo already covers fine).
 *
 * Cached aggressively: per-niche business samples for 1h, per-niche demand counts for
 * 12h — so even on a cold first visit we usually only pay the LLM call.
 */
import type { Env } from "../index";
import { llmCall, envWithByok } from "../llm/client";

interface NicheRow {
  niche: string;
  /** Deduped sample size from the demand index (capped at SAMPLE_LIMIT). */
  demand_count: number;
  /** True when the demand API returned a full page — actual count is >= demand_count. */
  saturated: boolean;
  thinness_pct: number;
  sample_cities: { city: string; count: number }[];
  sample_operators: { name: string; city: string | null; website: string | null }[];
  suggested_query: string;
  score: number;
}

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

/** Booking platforms, social pages, and aggregator hosts that DON'T count as a business's own
 *  domain. A salon's row showing `booksy.com/abc-salon` doesn't help Apollo enrich — Apollo
 *  matches on the operator's own domain to pull LinkedIn employees / Bombora intent / Clay
 *  signals. So if a business only has a booking-platform URL, they're effectively Apollo-thin. */
const PLATFORM_HOSTS = new Set([
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

/** Does this URL count as the business's OWN domain (i.e., Apollo can enrich from it)?
 *  Returns false for booking platforms, social profiles, aggregators, and obvious shared hosts. */
function isOwnDomain(website: string | null | undefined): boolean {
  if (!website || website.length < 5) return false;
  try {
    const u = new URL(website);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (PLATFORM_HOSTS.has(host)) return false;
    // Strip the leading "sub." for matches like "clients.mindbodyonline.com"
    if (PLATFORM_HOSTS.has(host.replace(/^[^.]+\./, ""))) return false;
    return true;
  } catch {
    return false;
  }
}

/** Dedupe sample businesses by canonical key (website host or lowercased name).
 *  Demand index sometimes records the same operator multiple times across crawl passes
 *  with slightly different lat/lng — we want one row per actual business. */
function dedupeSample(rows: BusinessRecord[]): BusinessRecord[] {
  const seen = new Set<string>();
  const out: BusinessRecord[] = [];
  for (const r of rows) {
    let key: string;
    if (r.website && r.website.length > 4) {
      try { key = `w:${new URL(r.website).hostname.replace(/^www\./, "").toLowerCase()}`; }
      catch { key = `n:${(r.name ?? "").toLowerCase().trim()}`; }
    } else {
      key = `n:${(r.name ?? "").toLowerCase().trim()}`;
    }
    if (!key || key === "n:" || seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

interface NicheBizPayload {
  /** Deduped sample (one row per canonical operator) — used for display. */
  sample: BusinessRecord[];
  /** Raw row count before dedup — used for size scoring (counts every location). */
  raw_count: number;
  /** Share of raw rows lacking a usable website. Apollo-thinness proxy. */
  raw_thinness: number;
  /** Did the demand API hit our sample ceiling? If yes, total count is >= raw_count. */
  saturated: boolean;
}

async function fetchNicheBusinesses(niche: string, env: Env, limit = 50): Promise<NicheBizPayload> {
  const cacheKey = `nichebiz:v4:${niche.toLowerCase()}:${limit}`;
  const cached = await env.CACHE.get(cacheKey, "json") as NicheBizPayload | null;
  if (cached) {
    // Old cache entries may lack raw_count/raw_thinness — backfill from the deduped sample.
    if (typeof cached.raw_count !== "number") cached.raw_count = cached.sample.length;
    if (typeof cached.raw_thinness !== "number") {
      const w = cached.sample.filter(b => typeof b.website === "string" && b.website.trim().length > 4).length;
      cached.raw_thinness = cached.sample.length > 0 ? 1 - w / cached.sample.length : 0;
    }
    console.log(`[niche-recon] cache hit: ${niche} (sample=${cached.sample.length})`);
    return cached;
  }
  const u = new URL("/api/businesses", env.DEMAND_API_BASE);
  u.searchParams.set("q", niche);
  u.searchParams.set("limit", String(limit));
  const t0 = Date.now();
  try {
    // Demand API serializes internally. Our caller batches at concurrency=2, but even then some
    // cold-cache niches stretch to 18-22s under load. 25s absorbs the worst case rather than
    // letting the call silently return an empty array on timeout.
    const r = await fetch(u.toString(), {
      headers: { "user-agent": "longtailscout-niche-recon/1.0" },
      signal: AbortSignal.timeout(25000)
    });
    const ms = Date.now() - t0;
    if (!r.ok) {
      console.log(`[niche-recon] ${niche}: HTTP ${r.status} in ${ms}ms`);
      return { sample: [], raw_count: 0, raw_thinness: 0, saturated: false };
    }
    const j = await r.json() as { businesses?: BusinessRecord[] };
    const raw = Array.isArray(j.businesses) ? j.businesses : [];
    const deduped = dedupeSample(raw);
    // Thinness measured on RAW rows (every location counts). "Has a website" is the wrong check —
    // most businesses have *some* URL (booking platform, Google profile, Facebook page). The real
    // Apollo-thinness signal is "does this business have its OWN domain that Apollo can enrich?"
    // Booksy/Boulevard/Yelp/Facebook profiles don't count.
    const rawOwnDomain = raw.filter(b => isOwnDomain(b.website)).length;
    const raw_thinness = raw.length > 0 ? 1 - rawOwnDomain / raw.length : 0;
    const payload: NicheBizPayload = {
      sample: deduped,
      raw_count: raw.length,
      raw_thinness,
      saturated: raw.length >= limit
    };
    await env.CACHE.put(cacheKey, JSON.stringify(payload), { expirationTtl: 3600 });
    console.log(`[niche-recon] ${niche}: ok in ${ms}ms (raw=${raw.length}, deduped=${deduped.length}, thin=${Math.round(raw_thinness * 100)}%)`);
    return payload;
  } catch (err) {
    const ms = Date.now() - t0;
    console.log(`[niche-recon] ${niche}: ${(err as Error).name} in ${ms}ms`);
    return { sample: [], raw_count: 0, raw_thinness: 0, saturated: false };
  }
}

export async function nicheReconHandler(req: Request, env: Env): Promise<Response> {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  // Gated behind DEMO_PASSWORD — costs an LLM call. Cheap (~500 tokens) but still real $$$.
  const expected = env.DEMO_PASSWORD;
  const auth = req.headers.get("authorization") ?? "";
  if (expected && auth !== `Bearer ${expected}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const body = await req.json().catch(() => null) as { product_description?: string } | null;
  const desc = (body?.product_description ?? "").trim();
  if (!desc || desc.length < 10 || desc.length > 800) {
    return Response.json({ error: "product_description required (10-800 chars)" }, { status: 400 });
  }

  // 1. LLM expands the product description into candidate verticals.
  const llmEnv = envWithByok(env, req.headers);
  let candidateNiches: string[] = [];
  try {
    const { response } = await llmCall(llmEnv, {
      system:
        "You map B2B SaaS products to long-tail vertical markets. Given a product description, suggest 6 DIVERSE niche business categories the product could sell to. " +
        "Bias toward small/local/operational businesses where Apollo / ZoomInfo / Clay have weak coverage — trades, services, hyperlocal operators, niche professional practices. " +
        "Prefer SHORT noun phrases (1-2 words) like 'roofing', 'dental clinic', 'tattoo shop' over long ones like 'commercial roofing contractor' — short phrases match more rows in our business index. " +
        "Avoid: generic terms ('small business', 'retail', 'companies'); near-duplicates (do NOT return both 'roofing' and 'roofing contractor'); " +
        "industries the product description already names explicitly (we want adjacent verticals). " +
        "Lowercase, singular preferred. Return ONLY JSON in the shape { \"niches\": string[] } with exactly 6 entries.",
      messages: [{ role: "user", content: desc }],
      responseFormat: "json_object",
      maxTokens: 400
    });
    const content = response.choices[0]?.message.content ?? "{}";
    const parsed = JSON.parse(content) as { niches?: unknown };
    if (Array.isArray(parsed.niches)) {
      candidateNiches = parsed.niches
        .filter((n): n is string => typeof n === "string")
        .map(n => n.trim().toLowerCase())
        .filter(n => n.length > 2 && n.length < 80)
        .slice(0, 6);
    }
  } catch (err) {
    return Response.json({ error: "llm failed", detail: (err as Error).message }, { status: 502 });
  }

  if (candidateNiches.length === 0) {
    return Response.json({ niches: [], note: "LLM returned no candidate niches" });
  }

  // 2. Score each candidate. We batch (concurrency = 3) instead of firing all at once because
  //    the .29 demand server serializes internally — 8 parallel calls hit ~17-20s each while 3
  //    parallel calls stay at ~10-12s. Batching keeps total wall-time predictable around 20-30s.
  const SAMPLE_LIMIT = 30;
  const BATCH = 2;
  async function scoreOne(niche: string): Promise<NicheRow | null> {
    const { sample, raw_count, raw_thinness, saturated } = await fetchNicheBusinesses(niche, env, SAMPLE_LIMIT);
    if (sample.length === 0 && raw_count === 0) return null;

    // City distribution from the deduped sample — picks the demo city for the "Scout this" button.
    const cityCounts = new Map<string, number>();
    for (const b of sample) {
      if (!b.city) continue;
      cityCounts.set(b.city, (cityCounts.get(b.city) ?? 0) + 1);
    }
    const sample_cities = Array.from(cityCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([city, count]) => ({ city, count }));

    const sample_operators = sample
      .filter(b => typeof b.name === "string" && b.name.trim().length > 0)
      .slice(0, 3)
      .map(b => ({ name: b.name, city: b.city, website: b.website }));

    // demand_count is the RAW count (every location counts); thinness is on raw rows too.
    // The deduped sample is just for display.
    const effectiveCount = Math.max(raw_count, sample.length);
    const sizeScore = Math.log10(effectiveCount + 1);
    // Long-tail premium: saturated samples (cap+) get full weight; tiny samples (<10) get penalized.
    const longTailMultiplier = effectiveCount < 10 ? 0.4 : 1.0;
    const score = sizeScore * raw_thinness * longTailMultiplier;

    const topCity = sample_cities[0]?.city ?? "";
    const suggested_query = topCity ? `${niche} in ${topCity}` : niche;

    return {
      niche,
      demand_count: effectiveCount,
      thinness_pct: raw_thinness,
      sample_cities,
      sample_operators,
      suggested_query,
      score,
      saturated
    };
  }

  // Run scoreOne in batches of BATCH concurrent calls.
  const rows: (NicheRow | null)[] = [];
  for (let i = 0; i < candidateNiches.length; i += BATCH) {
    const slice = candidateNiches.slice(i, i + BATCH);
    const results = await Promise.all(slice.map(scoreOne));
    rows.push(...results);
  }

  const ranked = rows
    .filter((r): r is NicheRow => r !== null && r.demand_count > 0 && r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return Response.json({
    product_description: desc,
    candidates_considered: candidateNiches.length,
    candidate_niches: candidateNiches,
    niches: ranked
  }, {
    headers: { "cache-control": "no-store" }
  });
}
