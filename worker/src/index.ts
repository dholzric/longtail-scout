import { smokeHandler } from "./handlers/smoke";

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
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/api/health") return Response.json({ ok: true, ts: Date.now() });
    if (url.pathname === "/api/smoke") return smokeHandler(env);
    return new Response("LongTail Scout - Worker is up", { headers: { "content-type": "text/plain" } });
  }
};
