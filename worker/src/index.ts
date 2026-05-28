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
  /** When set, discovery prefers SerpAPI's JSON SERP over BD's google.com rendering — ~5× faster. */
  SERPAPI_KEY?: string;
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/api/health") return Response.json({ ok: true, ts: Date.now() });
    if (url.pathname === "/api/smoke") {
      // SECURITY: smoke hits Bright Data SERP (real $$$) — gate behind the demo password
      // so anonymous traffic can't drain credits with curl loops.
      const expected = env.DEMO_PASSWORD;
      const auth = req.headers.get("authorization") ?? "";
      const keyParam = url.searchParams.get("key") ?? "";
      if (expected && auth !== `Bearer ${expected}` && keyParam !== expected) {
        return new Response("unauthorized", { status: 401 });
      }
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
      const expected = env.DEMO_PASSWORD;
      const auth = req.headers.get("authorization") ?? "";
      const keyParam = url.searchParams.get("key") ?? "";
      if (expected && auth !== `Bearer ${expected}` && keyParam !== expected) {
        return new Response("unauthorized", { status: 401 });
      }
      const result = await prewarmDemandIndex(env);
      return Response.json(result);
    }
    if (url.pathname === "/api/og.svg") return ogImageHandler(req, env);
    if (url.pathname === "/share") return shareHandler(req, env);
    if (url.pathname === "/api/lookalikes") return lookalikesHandler(req, env);
    // Manual trigger for the daily watchlist refresh — gated by the demo password so judges can
    // see the cron logic without waiting until tomorrow morning.
    // Pass ?email=force to also send digest emails to subscribers even when delta is 0 (demo path).
    if (url.pathname === "/api/cron/watchlist-refresh") {
      const expected = env.DEMO_PASSWORD;
      const auth = req.headers.get("authorization") ?? "";
      const keyParam = url.searchParams.get("key") ?? "";
      if (expected && auth !== `Bearer ${expected}` && keyParam !== expected) {
        return new Response("unauthorized", { status: 401 });
      }
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
