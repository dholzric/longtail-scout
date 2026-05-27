/**
 * /api/recent-runs — last 10 completed scouts as social-proof for first-time visitors.
 * Stored in KV under the single key "recent_runs" as a fixed-size ring of run summaries.
 */
import type { Env } from "../index";

export interface RecentRun {
  query: string;
  niche: string;
  city: string;
  operator_count: number;
  apollo_thin: number;
  hiring: number;
  total_usd: number;
  ts: number;
  /** Optional permalink to re-run the same query. */
  share_url: string;
}

const KEY = "recent_runs";
const MAX_ITEMS = 10;

export async function recordRecentRun(env: Env, run: RecentRun): Promise<void> {
  try {
    const existing = (await env.CACHE.get(KEY, "json") as RecentRun[] | null) ?? [];
    // De-dupe by query — replace prior entry for the same query rather than letting one query
    // dominate the gallery if it's been re-run a lot.
    const filtered = existing.filter(r => r.query.toLowerCase().trim() !== run.query.toLowerCase().trim());
    const next = [run, ...filtered].slice(0, MAX_ITEMS);
    await env.CACHE.put(KEY, JSON.stringify(next), { expirationTtl: 14 * 86400 });
  } catch { /* best-effort, never fail the scout because of this */ }
}

export async function recentRunsHandler(_req: Request, env: Env): Promise<Response> {
  const runs = (await env.CACHE.get(KEY, "json") as RecentRun[] | null) ?? [];
  return Response.json({ runs, cached: true }, {
    headers: { "cache-control": "public, max-age=60" }
  });
}
