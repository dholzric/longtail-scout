/**
 * /api/lookalikes?url=<seedUrl> — find operators in our memory layer whose query_history
 * overlaps with the seed operator's. Uses Jaccard similarity on the set of queries each
 * operator has shown up in. Returns top 5 most-similar operators we've seen across all
 * prior LongTail Scout runs.
 *
 * This is the cheapest, most direct lookalike signal we have: operators that appear in
 * the same niche queries are functionally similar customers for the same buyer.
 */
import type { Env } from "../index";
import { cacheKey } from "../cache";

interface RememberedOperator {
  url: string;
  name: string;
  first_seen_ts: number;
  last_seen_ts: number;
  seen_count: number;
  last_query: string;
  query_history: string[];
}

interface LookalikeResult {
  url: string;
  name: string;
  similarity: number;
  shared_queries: string[];
  seen_count: number;
  last_query: string;
}

async function opKey(url: string): Promise<string> {
  return (await cacheKey("memory:op", { url: url.replace(/\/$/, "") })).replace(/^tool:/, "");
}

/** Jaccard similarity over the case-insensitive query history sets. */
function jaccard(a: string[], b: string[]): { score: number; shared: string[] } {
  const A = new Set(a.map(q => q.toLowerCase().trim()));
  const B = new Set(b.map(q => q.toLowerCase().trim()));
  const shared = Array.from(A).filter(q => B.has(q));
  const union = new Set([...A, ...B]);
  return { score: union.size === 0 ? 0 : shared.length / union.size, shared };
}

export async function lookalikesHandler(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const seedUrl = (url.searchParams.get("url") ?? "").trim();
  if (!seedUrl) return Response.json({ error: "missing url" }, { status: 400 });

  // Same auth gate as the rest of /api/* — keep lookalike data behind the demo password.
  if (env.DEMO_PASSWORD) {
    const auth = req.headers.get("authorization") ?? "";
    const keyParam = url.searchParams.get("key") ?? "";
    if (auth !== `Bearer ${env.DEMO_PASSWORD}` && keyParam !== env.DEMO_PASSWORD) {
      return new Response("unauthorized", { status: 401 });
    }
  }

  const seedKey = await opKey(seedUrl);
  const seed = await env.CACHE.get(seedKey, "json") as RememberedOperator | null;
  if (!seed) {
    return Response.json({ seed: null, lookalikes: [], note: "Seed operator not in memory store yet — run a scout that surfaces it first." });
  }
  if (!seed.query_history || seed.query_history.length === 0) {
    return Response.json({ seed, lookalikes: [], note: "Seed has no query_history yet — only one prior surfacing." });
  }

  // Walk the memory namespace. We don't have a registered prefix on KV keys directly, but
  // cacheKey() produces stable prefixes like "memory:op:<hash>". KV list operates over the whole
  // namespace; we cap at 1000 keys per page (hackathon scale, single-page should suffice).
  const candidates: LookalikeResult[] = [];
  let cursor: string | undefined;
  let pages = 0;
  do {
    const listed = await env.CACHE.list({ prefix: "memory:op:", limit: 1000, cursor });
    cursor = listed.list_complete ? undefined : listed.cursor;
    for (const k of listed.keys) {
      if (k.name === seedKey) continue;
      const rec = await env.CACHE.get(k.name, "json") as RememberedOperator | null;
      if (!rec || !rec.query_history || rec.query_history.length === 0) continue;
      const { score, shared } = jaccard(seed.query_history, rec.query_history);
      if (score <= 0) continue;
      candidates.push({
        url: rec.url,
        name: rec.name,
        similarity: Number(score.toFixed(3)),
        shared_queries: shared,
        seen_count: rec.seen_count,
        last_query: rec.last_query
      });
    }
    pages++;
  } while (cursor && pages < 5); // safety cap — we shouldn't have 5000+ operators in KV

  candidates.sort((a, b) => b.similarity - a.similarity || b.seen_count - a.seen_count);
  const top = candidates.slice(0, 5);

  return Response.json({
    seed: { url: seed.url, name: seed.name, query_history: seed.query_history, seen_count: seed.seen_count },
    lookalikes: top,
    candidates_scanned: candidates.length,
    method: "jaccard on query_history"
  });
}
