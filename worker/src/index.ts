import { smokeHandler } from "./handlers/smoke";
import { scoutHandler } from "./handlers/scout";

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
  BRIDGE_BASE: string;
  BRIDGE_AUTH_TOKEN?: string;
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/api/health") return Response.json({ ok: true, ts: Date.now() });
    if (url.pathname === "/api/smoke") return smokeHandler(env);
    if (url.pathname === "/api/scout") return scoutHandler(req, env, ctx);
    if (env.ASSETS) return env.ASSETS.fetch(req);
    return new Response("Not Found", { status: 404 });
  }
};
