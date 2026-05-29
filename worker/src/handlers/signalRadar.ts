/**
 * /api/signal-radar?name=<biz>&city=<city>&url=<homepage>  (v1.6.0)
 *
 * Live buying-trigger radar. Runs a `"<name>" (funding OR expansion OR award …)` search THROUGH
 * the Bright Data bridge and returns fresh THIRD-PARTY news categorized as buying signals
 * (funding, new location, leadership change, award, launch). The timeliest possible "why now"
 * for an SDR — and a deeper Bright Data showcase than homepage-only signals. KV-cached 24h.
 */
import type { Env } from "../index";
import { bridgeSerp } from "../bridge/client";
import { classifyNewsResults, type NewsSignal } from "../agent/newsSignals";
import { normalizeBizName } from "../agent/linkedinPresence";

interface SignalRadarResponse {
  signals: NewsSignal[];
  serp_query: string;
  via: "bright_data_serp";
  cached?: boolean;
  error?: string;
}

function authorized(req: Request, env: Env): boolean {
  if (!env.DEMO_PASSWORD) return true;
  const h = req.headers.get("authorization") ?? "";
  if (h === `Bearer ${env.DEMO_PASSWORD}`) return true;
  return new URL(req.url).searchParams.get("key") === env.DEMO_PASSWORD;
}

export async function signalRadarHandler(req: Request, env: Env): Promise<Response> {
  if (!authorized(req, env)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const name = (url.searchParams.get("name") ?? "").trim().slice(0, 160);
  const city = (url.searchParams.get("city") ?? "").trim().slice(0, 80);
  const homepage = (url.searchParams.get("url") ?? "").trim();
  if (!name || normalizeBizName(name).length < 2) {
    return Response.json({ error: "missing or too-short name" }, { status: 400 });
  }
  let opHost: string | undefined;
  try { opHost = homepage ? new URL(homepage).hostname : undefined; } catch { opHost = undefined; }

  // opHost is part of the key: own-domain results are excluded only when a url is supplied, so a
  // url-less call must NOT share a cache entry with a url-bearing one (else own-domain leaks).
  const cacheKey = `signals:v2:${normalizeBizName(name)}:${city.toLowerCase()}:${(opHost ?? "").replace(/^www\./, "").toLowerCase()}`;
  const cached = await env.CACHE.get(cacheKey, "json") as SignalRadarResponse | null;
  if (cached) return Response.json({ ...cached, cached: true }, { headers: { "cache-control": "public, max-age=3600" } });

  const serpQuery = `"${name}"${city ? ` ${city}` : ""} (funding OR raises OR expansion OR "new location" OR acquired OR award OR "now hiring" OR launches OR "new CEO")`;

  if (!env.BRIDGE_BASE) {
    return Response.json({ signals: [], serp_query: serpQuery, via: "bright_data_serp", error: "bridge not configured" } satisfies SignalRadarResponse, { status: 502 });
  }

  let signals: NewsSignal[];
  try {
    const serp = await bridgeSerp(serpQuery, { num: 12 }, { base: env.BRIDGE_BASE.replace(/\/$/, ""), token: env.BRIDGE_AUTH_TOKEN });
    signals = classifyNewsResults(name, serp.results, opHost);
  } catch (err) {
    // Don't cache a transient render failure.
    return Response.json({ signals: [], serp_query: serpQuery, via: "bright_data_serp", error: (err as Error).message.slice(0, 160) } satisfies SignalRadarResponse, { status: 502 });
  }

  const out: SignalRadarResponse = { signals, serp_query: serpQuery, via: "bright_data_serp" };
  // 24h cache — news moves faster than LinkedIn presence, but not minute-to-minute.
  await env.CACHE.put(cacheKey, JSON.stringify(out), { expirationTtl: 86400 });
  return Response.json(out, { headers: { "cache-control": "public, max-age=3600" } });
}
