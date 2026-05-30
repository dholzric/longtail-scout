import type { Env } from "../index";
import { serpSearch } from "../brightdata/serp";
import { demandLookup } from "../demand/client";

export async function smokeHandler(env: Env): Promise<Response> {
  const bridge = { base: env.BRIDGE_BASE, token: env.BRIDGE_AUTH_TOKEN };
  const checks: Record<string, unknown> = {};

  try {
    const demand = await demandLookup("aerospace", env.DEMAND_API_BASE, env.CACHE, env.DEMAND_API_TOKEN);
    checks.demand = demand
      ? { ok: true, demand_count: demand.demand, results: demand.results.length }
      : { ok: false, error: "null response" };
  } catch (err) {
    checks.demand = { ok: false, error: String(err) };
  }

  if (!env.BRIDGE_BASE) {
    checks.serp = { ok: false, error: "BRIDGE_BASE not configured" };
  } else {
    try {
      const serp = await serpSearch("aerospace companies Houston", { bridge, braveApiKey: env.BRAVE_API_KEY, serpApiKey: env.SERPAPI_KEY }, { num: 5 });
      checks.serp = { ok: true, count: serp.results.length, first: serp.results[0] ?? null };
    } catch (err) {
      checks.serp = { ok: false, error: String(err) };
    }
  }

  return Response.json(checks);
}
