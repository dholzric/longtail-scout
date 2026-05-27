import { smokeHandler } from "./handlers/smoke";
import { scoutHandler } from "./handlers/scout";
import indexHtml from "./static/index.html";

export interface Env {
  CACHE: KVNamespace;
  ASSETS?: Fetcher;
  OPENROUTER_API_KEY?: string;
  AIMLAPI_KEY?: string;
  GLM_API_KEY?: string;
  BRIGHTDATA_API_KEY: string;
  BRIGHTDATA_SERP_ZONE: string;
  BRIGHTDATA_WEB_UNLOCKER_ZONE: string;
  BRIGHTDATA_SCRAPER_ZONE: string;
  DEMAND_API_BASE: string;
  BRIDGE_BASE: string;
  BRIDGE_AUTH_TOKEN?: string;
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/api/health") return Response.json({ ok: true, ts: Date.now() });
    if (url.pathname === "/api/smoke") return smokeHandler(env);
    if (url.pathname === "/api/scout") return scoutHandler(req, env, ctx);
    return new Response(indexHtml, { headers: { "content-type": "text/html; charset=utf-8" } });
  }
};
