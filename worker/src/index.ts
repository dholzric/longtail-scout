import { smokeHandler } from "./handlers/smoke";
import { scoutHandler } from "./handlers/scout";
import { watchlistHandler, refreshWatchlistDemand } from "./handlers/watchlist";
import { businessesHandler, demandResearchHandler, prewarmDemandIndex } from "./handlers/businesses";
import { screenshotHandler } from "./handlers/screenshot";
import { draftEmailHandler } from "./handlers/draftEmail";
import { mcpHandler } from "./handlers/mcp";
import { recentRunsHandler, nicheLeaderboardHandler } from "./handlers/recentRuns";
import { ogImageHandler, shareHandler } from "./handlers/og";
import { lookalikesHandler } from "./handlers/lookalikes";
import { nicheReconHandler } from "./handlers/nicheRecon";
import { linkedinCheckHandler } from "./handlers/linkedinCheck";
import { contactDiscoveryHandler } from "./handlers/contactDiscovery";
import { briefHandler } from "./handlers/brief";
import { triggersHandler } from "./handlers/triggers";
import { signalRadarHandler } from "./handlers/signalRadar";
import { decisionMakerHandler } from "./handlers/decisionMaker";
import { VERSION } from "./version";

export interface Env {
  CACHE: KVNamespace;
  ASSETS?: Fetcher;
  DEMO_PASSWORD?: string;
  DEEPSEEK_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  AIMLAPI_KEY?: string;
  GLM_API_KEY?: string;
  BRIGHTDATA_API_KEY: string;
  BRIGHTDATA_SERP_ZONE: string;
  BRIGHTDATA_WEB_UNLOCKER_ZONE: string;
  BRIGHTDATA_SCRAPER_ZONE: string;
  DEMAND_API_BASE: string;
  NOMINATIM_BASE?: string;
  BRIDGE_BASE: string;
  BRIDGE_AUTH_TOKEN?: string;
  RESEND_API_KEY?: string;
  /** Optional 4th-tier SERP fallback. Try order is: Brave → DDG → BD bridge → SerpAPI.
   *  SerpAPI is last because it's pay-per-call ($50/mo minimum) while the first three are
   *  free / already-paid. Keep this key if you have it as a hedge for the 1% of niches that
   *  return nothing through Brave/DDG/BD. */
  SERPAPI_KEY?: string;
  /** Primary SERP tier — Brave Search API (free 2k/mo, ~1-2s, JSON). With Brave set, discovery
   *  hits it first; the cascading fallbacks only fire if Brave returns no organic results. */
  BRAVE_API_KEY?: string;
}

/**
 * Auth gate for operator-triggered endpoints (smoke + cron triggers). These each hit a
 * real-cost upstream (Bright Data SERP / demand API / LLM), so anonymous traffic must not be
 * able to drain credits with curl loops. Unlike the user-facing /api/scout gate, these accept
 * a ?key= query param too because they're invoked from curl / the dashboard, where a bearer
 * header is awkward. Returns true when the request is authorized (or when no password is set).
 */
function operatorAuthorized(req: Request, url: URL, env: Env): boolean {
  const expected = env.DEMO_PASSWORD;
  if (!expected) return true; // gate disabled if password unset
  const auth = req.headers.get("authorization") ?? "";
  const keyParam = url.searchParams.get("key") ?? "";
  return auth === `Bearer ${expected}` || keyParam === expected;
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/api/health") return Response.json({ ok: true, version: VERSION, ts: Date.now() });
    if (url.pathname === "/api/smoke") {
      // SECURITY: smoke hits Bright Data SERP (real $$$) — gate behind the demo password.
      if (!operatorAuthorized(req, url, env)) return new Response("unauthorized", { status: 401 });
      return smokeHandler(env);
    }
    if (url.pathname === "/api/scout") return scoutHandler(req, env, ctx);
    if (url.pathname.startsWith("/api/watchlist")) return watchlistHandler(req, env);
    if (url.pathname === "/api/businesses") return businessesHandler(req, env);
    if (url.pathname === "/api/demand-research") return demandResearchHandler(req, env);
    if (url.pathname === "/api/screenshot") return screenshotHandler(req, env);
    if (url.pathname === "/api/draft-email") return draftEmailHandler(req, env);
    if (url.pathname === "/api/mcp" || url.pathname === "/mcp-api") return mcpHandler(req, env);
    if (url.pathname === "/api/recent-runs") return recentRunsHandler(req, env);
    if (url.pathname === "/api/niche-leaderboard") return nicheLeaderboardHandler(req, env);
    if (url.pathname === "/api/cron/prewarm-demand") {
      if (!operatorAuthorized(req, url, env)) return new Response("unauthorized", { status: 401 });
      const result = await prewarmDemandIndex(env);
      return Response.json(result);
    }
    if (url.pathname === "/api/og.svg") return ogImageHandler(req, env);
    if (url.pathname === "/share") return shareHandler(req, env);
    if (url.pathname === "/api/lookalikes") return lookalikesHandler(req, env);
    if (url.pathname === "/api/niche-recon") return nicheReconHandler(req, env);
    if (url.pathname === "/api/linkedin-check") return linkedinCheckHandler(req, env);
    if (url.pathname === "/api/contact-discovery") return contactDiscoveryHandler(req, env);
    if (url.pathname === "/api/brief") return briefHandler(req, env);
    if (url.pathname === "/api/triggers") return triggersHandler(req, env);
    if (url.pathname === "/api/signal-radar") return signalRadarHandler(req, env);
    if (url.pathname === "/api/decision-maker") return decisionMakerHandler(req, env);
    // Manual trigger for the daily watchlist refresh — gated by the demo password so judges can
    // see the cron logic without waiting until tomorrow morning.
    // Pass ?email=force to also send digest emails to subscribers even when delta is 0 (demo path).
    if (url.pathname === "/api/cron/watchlist-refresh") {
      if (!operatorAuthorized(req, url, env)) return new Response("unauthorized", { status: 401 });
      const forceEmail = url.searchParams.get("email") === "force";
      const result = await refreshWatchlistDemand(env, { forceEmail });
      return Response.json(result);
    }
    if (env.ASSETS) return env.ASSETS.fetch(req);
    return new Response("Not Found", { status: 404 });
  },

  /**
   * Scheduled cron handler (configured via wrangler.toml [triggers] crons).
   * Runs daily to refresh demand-signal counts on every saved watch, so the
   * watchlist UI can surface "+N businesses since yesterday" without us paying
   * the full BD+LLM scout cost per watch per day.
   */
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil((async () => {
      try {
        const r = await refreshWatchlistDemand(env);
        console.log(`[cron] watchlist-refresh: refreshed=${r.refreshed} failed=${r.failed}`);
      } catch (err) {
        console.error(`[cron] watchlist-refresh failed:`, err);
      }
      // Pre-warm the demand-index cache for popular niches so first-time visitors get instant probe results.
      try {
        const r = await prewarmDemandIndex(env);
        console.log(`[cron] prewarm demand index: warmed=${r.warmed} failed=${r.failed}`);
      } catch (err) {
        console.error(`[cron] prewarm demand index failed:`, err);
      }
    })());
  }
};
