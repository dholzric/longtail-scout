import type { Env } from "../index";
import { serpSearch } from "../brightdata/serp";
import { demandLookup } from "../demand/client";

export async function smokeHandler(env: Env): Promise<Response> {
  const auth = { apiKey: env.BRIGHTDATA_API_KEY };
  const checks: Record<string, unknown> = {};

  // Demand API
  try {
    const demand = await demandLookup("aerospace", env.DEMAND_API_BASE, env.CACHE);
    checks.demand = demand ? { ok: true, demand_count: demand.demand, results: demand.results.length } : { ok: false, error: "null response" };
  } catch (err) {
    checks.demand = { ok: false, error: String(err) };
  }

  // SERP — only attempt if zone is set (will fail with friendly message otherwise)
  if (!env.BRIGHTDATA_SERP_ZONE) {
    checks.serp = { ok: false, error: "BRIGHTDATA_SERP_ZONE not configured" };
  } else {
    try {
      const serp = await serpSearch("aerospace companies Houston", env.BRIGHTDATA_SERP_ZONE, auth, { num: 5 });
      checks.serp = { ok: true, count: serp.results.length, first: serp.results[0] ?? null };
    } catch (err) {
      checks.serp = { ok: false, error: String(err) };
    }
  }

  return Response.json(checks);
}
