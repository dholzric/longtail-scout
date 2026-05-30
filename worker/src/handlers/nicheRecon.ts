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
  /** True national count from the demand index (falls back to the capped sample size only if
   *  the demand probe is unavailable). */
  demand_count: number;
  /** Only true in the fallback case (demand probe failed AND the sample hit its ceiling) — then
   *  the real count is >= demand_count and the UI appends a "+". False whenever we have the true count. */
  saturated: boolean;
  thinness_pct: number;
  /** Top states the niche concentrates in (stable signal; replaces the noisy modal-city). */
  regions: { state: string; count: number }[];
  /** Flagship metro of the top state — the geographically sensible place to scout. */
  suggested_metro: string;
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
  "joinblvd.com", "joinhonk.com",
  // Field-service / home-service platforms operators front instead of an own domain. Subdomain
  // forms (clienthub.getjobber.com, book.housecallpro.com) are caught by the sub-strip in isOwnDomain.
  "getjobber.com", "jobber.com", "housecallpro.com", "workiz.com", "servicem8.com",
  "fieldpulse.com", "markate.com", "nextdoor.com", "alignable.com"
]);

/** Does this URL count as the business's OWN domain (i.e., Apollo can enrich from it)?
 *  Returns false for booking platforms, social profiles, aggregators, and obvious shared hosts. */
export function isOwnDomain(website: string | null | undefined): boolean {
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
  const cacheKey = `nichebiz:v5:${niche.toLowerCase()}:${limit}`;
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

/** True national count for a niche from the demand index (the same `/api/research` demand
 *  signal `/api/demand-research` surfaces). This is the REAL index depth — e.g. ~16,666
 *  electrical, ~42,873 hvac — not the 30-row display sample fetchNicheBusinesses pulls.
 *  Shares the `demand-research:` cache key so a probe under the query input warms it too. */
async function fetchNicheDemand(niche: string, env: Env): Promise<number> {
  const cacheKey = `demand-research:${niche.toLowerCase()}`;
  const cached = await env.CACHE.get(cacheKey, "json") as { query: string; demand: number } | null;
  if (cached) return typeof cached.demand === "number" ? cached.demand : 0;
  const u = new URL("/api/research", env.DEMAND_API_BASE);
  u.searchParams.set("q", niche);
  u.searchParams.set("tlds", "com");
  u.searchParams.set("limit", "1");
  // count_only skips the demand server's per-domain registrar+scoring work (the ~18s bottleneck) —
  // we only need the `demand` count here. Ignored by older demand-API builds, so safe to always send.
  u.searchParams.set("count_only", "1");
  try {
    // /api/research is the slow endpoint (~18s cold — it does Cloudflare-registrar work for the
    // count). 15s timed out on cold calls → spurious "30+". 30s absorbs the worst case.
    const r = await fetch(u.toString(), {
      headers: { "user-agent": "longtailscout-niche-recon/1.0" },
      signal: AbortSignal.timeout(30000)
    });
    if (!r.ok) return 0;
    const j = await r.json() as { query?: string; demand?: number };
    const demand = typeof j.demand === "number" ? j.demand : 0;
    // 24h TTL — demand counts only move on batch index scrapes, and this is the expensive call.
    await env.CACHE.put(cacheKey, JSON.stringify({ query: j.query ?? niche, demand }), { expirationTtl: 86400 });
    return demand;
  } catch {
    return 0;
  }
}

/** Top US states → a recognizable flagship metro to scout. The 30-row sample's modal *city* is
 *  noise (operators are scattered nationwide), but the modal *state* is stable — so we suggest the
 *  niche in that state's flagship metro instead of a random small town ("septic service in Apple
 *  Valley"). Covers the states that actually dominate local-service demand. */
const STATE_METRO: Record<string, string> = {
  TX: "Houston", CA: "Los Angeles", FL: "Tampa", NY: "New York", IL: "Chicago",
  PA: "Philadelphia", OH: "Columbus", GA: "Atlanta", NC: "Charlotte", MI: "Detroit",
  NJ: "Newark", VA: "Virginia Beach", WA: "Seattle", AZ: "Phoenix", MA: "Boston",
  TN: "Nashville", IN: "Indianapolis", MO: "Kansas City", MD: "Baltimore", WI: "Milwaukee",
  CO: "Denver", MN: "Minneapolis", SC: "Charleston", AL: "Birmingham", LA: "New Orleans",
  KY: "Louisville", OR: "Portland", OK: "Oklahoma City", CT: "Hartford", UT: "Salt Lake City",
  NV: "Las Vegas", AR: "Little Rock", MS: "Jackson", KS: "Wichita", NM: "Albuquerque",
  NE: "Omaha", ID: "Boise", WV: "Charleston", IA: "Des Moines", PR: "San Juan",
};
const DEFAULT_METRO = "Houston";

export async function nicheReconHandler(req: Request, env: Env): Promise<Response> {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  // Gated behind DEMO_PASSWORD — costs an LLM call. Cheap (~500 tokens) but still real $$$.
  const expected = env.DEMO_PASSWORD;
  const auth = req.headers.get("authorization") ?? "";
  if (expected && auth !== `Bearer ${expected}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const body = await req.json().catch(() => null) as { product_description?: string; fresh?: boolean } | null;
  const desc = (body?.product_description ?? "").trim();
  if (!desc || desc.length < 10 || desc.length > 800) {
    return Response.json({ error: "product_description required (10-800 chars)" }, { status: 400 });
  }

  // Response cache keyed by the exact description. The niche SET comes from a (non-deterministic)
  // LLM call, so without this the same description returns different verticals every click —
  // bad for a scripted demo. Caching makes a warmed result reproducible: pre-warm with
  // `{"fresh":true}` until you get a strong set, then the UI click returns that same cached set.
  // `fresh:true` bypasses the read but still writes, so re-rolls overwrite to the latest result.
  const respCacheKey = `nicherecon:resp:v2:${desc.toLowerCase()}`;
  if (!body?.fresh) {
    const cached = await env.CACHE.get(respCacheKey, "json");
    if (cached) {
      return Response.json({ ...(cached as object), cached: true }, { headers: { "cache-control": "no-store" } });
    }
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

  // 2. Score each candidate. Concurrency 3 (the demand server handles parallel calls — measured
  //    ~12s for 3 parallel probes). Each candidate fires its probe + sample in parallel too.
  const SAMPLE_LIMIT = 30;
  const BATCH = 3;
  async function scoreOne(niche: string): Promise<NicheRow | null> {
    // Probe (true count) and sample run in PARALLEL — the demand server handles concurrent calls,
    // and the probe's 30s timeout means it no longer loses the race and falls back to "30+".
    const [trueDemand, biz] = await Promise.all([
      fetchNicheDemand(niche, env),
      fetchNicheBusinesses(niche, env, SAMPLE_LIMIT),
    ]);
    const { sample, raw_count, raw_thinness, saturated: sampleSaturated } = biz;
    if (sample.length === 0 && raw_count === 0) return null;

    // STATE distribution, not city. The modal *city* of 30 nationally-scattered rows is noise
    // (e.g. "septic service" → Apple Valley, CA with 1 row); the modal *state* is stable. We scout
    // the niche in that state's flagship metro instead of a random town.
    const stateCounts = new Map<string, number>();
    for (const b of sample) {
      const st = (b.state ?? "").trim().toUpperCase();
      if (st && st.length <= 3) stateCounts.set(st, (stateCounts.get(st) ?? 0) + 1);
    }
    const regions = Array.from(stateCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([state, count]) => ({ state, count }));
    const topState = regions[0]?.state ?? "";
    const suggested_metro = STATE_METRO[topState] ?? DEFAULT_METRO;

    // Prefer Apollo-thin operators (no own-domain website) for the sample — they ARE the long-tail
    // this niche is about. The upstream sorts by review_count, which otherwise surfaces big regional
    // chains (with their own sites + LinkedIn) that directly contradict the "Apollo can't see them" pitch.
    const namedSample = sample.filter(b => typeof b.name === "string" && b.name.trim().length > 0);
    const sample_operators = [
      ...namedSample.filter(b => !isOwnDomain(b.website)),
      ...namedSample.filter(b => isOwnDomain(b.website)),
    ].slice(0, 3).map(b => ({ name: b.name, city: b.city, website: b.website }));

    // demand_count is the TRUE national count from the demand index (real moat depth — tens of
    // thousands per niche). Fall back to the raw sample count only if the demand probe is
    // unavailable. thinness stays measured on the 30-row sample; the deduped sample is display-only.
    const sampleCount = Math.max(raw_count, sample.length);
    const effectiveCount = trueDemand > 0 ? trueDemand : sampleCount;
    // With the true count we no longer show a "30+" ceiling; only fall back to "+" if we had to
    // use the capped sample (demand probe failed) and that sample saturated.
    const saturated = trueDemand > 0 ? false : sampleSaturated;
    const sizeScore = Math.log10(effectiveCount + 1);
    // Long-tail premium: real-sized niches get full weight; near-empty ones (<10) get penalized.
    const longTailMultiplier = effectiveCount < 10 ? 0.4 : 1.0;
    const score = sizeScore * raw_thinness * longTailMultiplier;

    const suggested_query = `${niche} in ${suggested_metro}`;

    return {
      niche,
      demand_count: effectiveCount,
      thinness_pct: raw_thinness,
      regions,
      suggested_metro,
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

  const payload = {
    product_description: desc,
    candidates_considered: candidateNiches.length,
    candidate_niches: candidateNiches,
    niches: ranked
  };
  // Cache non-empty results for 2h so a warmed run is reproducible (incl. after a `fresh` re-roll).
  // Never cache an empty set — that's usually a transient demand-server hiccup we want to retry.
  if (ranked.length > 0) {
    await env.CACHE.put(respCacheKey, JSON.stringify(payload), { expirationTtl: 7200 });
  }

  return Response.json(payload, { headers: { "cache-control": "no-store" } });
}
