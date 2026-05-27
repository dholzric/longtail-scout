import type { Env } from "../index";
import type { ScoutQuery } from "../types";
import { createSseResponse } from "../stream";
import { discoverCandidates } from "../agent/discovery";
import { enrichCandidates } from "../agent/enrich";
import { synthesize } from "../agent/synthesize";

function parseQuery(raw: string): ScoutQuery {
  const inIdx = raw.toLowerCase().lastIndexOf(" in ");
  if (inIdx > 0) {
    return { niche: raw.slice(0, inIdx).trim(), city: raw.slice(inIdx + 4).trim(), raw };
  }
  return { niche: raw, city: "", raw };
}

function checkAuth(req: Request, env: Env): boolean {
  const expected = env.DEMO_PASSWORD;
  if (!expected) return true; // gate disabled if password unset
  // Authorization: Bearer <pw>
  const auth = req.headers.get("authorization") ?? "";
  if (auth === `Bearer ${expected}`) return true;
  // x-demo-key header
  if (req.headers.get("x-demo-key") === expected) return true;
  // ?key=<pw> query param (handy for demo URLs in slides)
  const url = new URL(req.url);
  if (url.searchParams.get("key") === expected) return true;
  return false;
}

export async function scoutHandler(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!checkAuth(req, env)) {
    return new Response(JSON.stringify({ error: "demo gated — enter demo password" }), {
      status: 401,
      headers: { "content-type": "application/json", "www-authenticate": "Bearer realm=\"longtail-scout-demo\"" }
    });
  }
  let body: { query?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (!body.query || typeof body.query !== "string") return new Response("Missing 'query'", { status: 400 });

  const q = parseQuery(body.query);
  const { response, emitter } = createSseResponse();

  ctx.waitUntil((async () => {
    try {
      await emitter.emit("progress", { message: `Parsed query — niche="${q.niche}", city="${q.city}".` });
      const candidates = await discoverCandidates(q, env, emitter);
      const enriched = await enrichCandidates(candidates, env, emitter);
      const operators = await synthesize(q, enriched, env, emitter);
      await emitter.emit("result", { operators });
      await emitter.emit("done", {});
    } catch (err) {
      await emitter.emit("error", { message: (err as Error).message, recoverable: false });
    } finally {
      await emitter.close();
    }
  })());

  return response;
}
