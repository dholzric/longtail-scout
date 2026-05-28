/**
 * /api/linkedin-check?name=<biz>&city=<city>&url=<homepage>  (v1.2.0 — Apollo-blind verification)
 *
 * Runs a `site:linkedin.com/company "<name>"` Google search THROUGH the Bright Data bridge and
 * decides whether a matching LinkedIn company page exists. A confirmed absence is hard evidence
 * for the core thesis: Apollo/ZoomInfo/Clay are LinkedIn-graph tools, so an operator with no
 * company page is invisible to them — but we found them via their own website + Bright Data.
 *
 * Lazy-loaded from the drill-down (never during the scout pass) and cached 30 days in KV, so the
 * per-check Bright Data SERP cost (~$0.005) is paid at most once per operator.
 */
import type { Env } from "../index";
import { bridgeSerp } from "../bridge/client";
import { classifyLinkedInResults, normalizeBizName } from "../agent/linkedinPresence";

interface LinkedInCheckResponse {
  checked: boolean;
  on_linkedin: boolean;
  evidence_url: string | null;
  match_count: number;
  serp_query: string;
  /** Always the BD bridge here — this feature is a deliberate Bright Data showcase. */
  via: "bright_data_serp";
  cached?: boolean;
  error?: string;
}

function authorized(req: Request, env: Env): boolean {
  if (!env.DEMO_PASSWORD) return true;
  const h = req.headers.get("authorization") ?? "";
  if (h === `Bearer ${env.DEMO_PASSWORD}`) return true;
  // Drill-down fetches from the browser pass ?key= (consistent with /api/screenshot).
  const url = new URL(req.url);
  return url.searchParams.get("key") === env.DEMO_PASSWORD;
}

export async function linkedinCheckHandler(req: Request, env: Env): Promise<Response> {
  if (!authorized(req, env)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const name = (url.searchParams.get("name") ?? "").trim().slice(0, 160);
  const city = (url.searchParams.get("city") ?? "").trim().slice(0, 80);
  if (!name || normalizeBizName(name).length < 2) {
    return Response.json({ error: "missing or too-short name" }, { status: 400 });
  }

  const cacheKey = `linkedin:v1:${normalizeBizName(name)}:${city.toLowerCase()}`;
  const cached = await env.CACHE.get(cacheKey, "json") as LinkedInCheckResponse | null;
  if (cached) {
    return Response.json({ ...cached, cached: true }, { headers: { "cache-control": "public, max-age=3600" } });
  }

  // Phrase-match the exact name, scoped to company pages, optionally biased by city.
  const serpQuery = `site:linkedin.com/company "${name}"${city ? ` ${city}` : ""}`;

  if (!env.BRIDGE_BASE) {
    return Response.json({ checked: false, on_linkedin: false, evidence_url: null, match_count: 0, serp_query: serpQuery, via: "bright_data_serp", error: "bridge not configured" } satisfies LinkedInCheckResponse, { status: 502 });
  }

  let verdict;
  try {
    const serp = await bridgeSerp(serpQuery, { num: 10 }, { base: env.BRIDGE_BASE.replace(/\/$/, ""), token: env.BRIDGE_AUTH_TOKEN });
    verdict = classifyLinkedInResults(name, serp.results);
  } catch (err) {
    // Don't cache failures — a flaky LinkedIn/Google render shouldn't poison the cache.
    return Response.json({ checked: false, on_linkedin: false, evidence_url: null, match_count: 0, serp_query: serpQuery, via: "bright_data_serp", error: (err as Error).message.slice(0, 160) } satisfies LinkedInCheckResponse, { status: 502 });
  }

  const out: LinkedInCheckResponse = {
    checked: true,
    on_linkedin: verdict.on_linkedin,
    evidence_url: verdict.evidence_url,
    match_count: verdict.match_count,
    serp_query: serpQuery,
    via: "bright_data_serp"
  };
  // 30-day cache — LinkedIn company-page presence is stable.
  await env.CACHE.put(cacheKey, JSON.stringify(out), { expirationTtl: 30 * 86400 });
  return Response.json(out, { headers: { "cache-control": "public, max-age=3600" } });
}
