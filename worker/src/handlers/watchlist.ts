import type { Env } from "../index";
import { cacheKey } from "../cache";

interface Watch {
  id: string;
  query: string;
  created_at: number;
  last_run_at: number | null;
  last_count: number | null;
  last_op_urls: string[]; // for diffing "new since last run"
}

const INDEX_KEY = "watch:index"; // JSON array of watch IDs for listing

async function watchKey(query: string): Promise<string> {
  return (await cacheKey("watch", { q: query.toLowerCase().trim() })).replace(/^tool:/, "");
}

async function readIndex(kv: KVNamespace): Promise<string[]> {
  return (await kv.get(INDEX_KEY, "json") as string[]) ?? [];
}

async function writeIndex(kv: KVNamespace, ids: string[]): Promise<void> {
  await kv.put(INDEX_KEY, JSON.stringify(ids));
}

async function loadWatch(kv: KVNamespace, id: string): Promise<Watch | null> {
  return await kv.get(id, "json") as Watch | null;
}

async function saveWatch(kv: KVNamespace, w: Watch): Promise<void> {
  await kv.put(w.id, JSON.stringify(w));
}

function checkAuth(req: Request, env: Env): boolean {
  const expected = env.DEMO_PASSWORD;
  if (!expected) return true;
  const auth = req.headers.get("authorization") ?? "";
  if (auth === `Bearer ${expected}`) return true;
  if (req.headers.get("x-demo-key") === expected) return true;
  const url = new URL(req.url);
  if (url.searchParams.get("key") === expected) return true;
  return false;
}

export async function watchlistHandler(req: Request, env: Env): Promise<Response> {
  if (!checkAuth(req, env)) {
    return new Response(JSON.stringify({ error: "auth required" }), {
      status: 401,
      headers: { "content-type": "application/json" }
    });
  }

  const url = new URL(req.url);
  const path = url.pathname; // /api/watchlist or /api/watchlist/:id

  // LIST: GET /api/watchlist
  if (req.method === "GET" && /\/api\/watchlist\/?$/.test(path)) {
    const ids = await readIndex(env.CACHE);
    const watches: Watch[] = [];
    for (const id of ids) {
      const w = await loadWatch(env.CACHE, id);
      if (w) watches.push(w);
    }
    watches.sort((a, b) => (b.last_run_at ?? b.created_at) - (a.last_run_at ?? a.created_at));
    return Response.json({ watches });
  }

  // CREATE: POST /api/watchlist  { query }
  if (req.method === "POST" && /\/api\/watchlist\/?$/.test(path)) {
    let body: { query?: string };
    try { body = await req.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }
    if (!body.query || typeof body.query !== "string" || body.query.length > 512) {
      return new Response("Invalid query", { status: 400 });
    }
    const id = await watchKey(body.query);
    const existing = await loadWatch(env.CACHE, id);
    if (existing) {
      return Response.json({ watch: existing, already_exists: true });
    }
    const w: Watch = {
      id,
      query: body.query.trim(),
      created_at: Date.now(),
      last_run_at: null,
      last_count: null,
      last_op_urls: []
    };
    await saveWatch(env.CACHE, w);
    const ids = await readIndex(env.CACHE);
    await writeIndex(env.CACHE, [id, ...ids.filter(x => x !== id)]);
    return Response.json({ watch: w, created: true });
  }

  // DELETE: DELETE /api/watchlist/:id
  if (req.method === "DELETE" && /\/api\/watchlist\/[^/]+\/?$/.test(path)) {
    const id = decodeURIComponent(path.split("/").pop() ?? "");
    await env.CACHE.delete(id);
    const ids = await readIndex(env.CACHE);
    await writeIndex(env.CACHE, ids.filter(x => x !== id));
    return Response.json({ deleted: true });
  }

  return new Response("Not found", { status: 404 });
}

/**
 * Called after a scout run completes — update any matching watch with the latest result snapshot.
 * Returns the watch (if matched) so the response can include the "X new since last run" delta.
 */
export async function recordRunInWatchlist(kv: KVNamespace, query: string, opUrls: string[]): Promise<{ new_count: number; previous_count: number | null } | null> {
  const id = await watchKey(query);
  const existing = await loadWatch(kv, id);
  if (!existing) return null;
  const prevSet = new Set(existing.last_op_urls);
  const newCount = opUrls.filter(u => !prevSet.has(u)).length;
  const previous_count = existing.last_count;
  existing.last_run_at = Date.now();
  existing.last_count = opUrls.length;
  existing.last_op_urls = opUrls.slice(0, 50); // cap stored URLs
  await saveWatch(kv, existing);
  return { new_count: newCount, previous_count };
}
