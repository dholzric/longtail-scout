import type { Env } from "../index";
import { cacheKey } from "../cache";
import { sendEmail, RESEND_DEFAULT_FROM } from "../lib/resend";

interface Watch {
  id: string;
  query: string;
  created_at: number;
  last_run_at: number | null;
  last_count: number | null;
  last_op_urls: string[]; // for diffing "new since last run"
  /** Demand-API business count at the last cron refresh — used to surface "+N businesses since yesterday" deltas without running a full scout. */
  last_demand_count?: number | null;
  /** Demand-API count from the cron run BEFORE the latest one, so we can show the most recent delta. */
  previous_demand_count?: number | null;
  last_demand_check_at?: number | null;
  /** Email subscribers — receive a daily digest from the cron when delta > 0. */
  subscribers?: string[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  if (req.method === "DELETE" && /\/api\/watchlist\/[^/]+\/?$/.test(path) && !path.endsWith("/subscribe")) {
    const id = decodeURIComponent(path.split("/").pop() ?? "");
    await env.CACHE.delete(id);
    const ids = await readIndex(env.CACHE);
    await writeIndex(env.CACHE, ids.filter(x => x !== id));
    return Response.json({ deleted: true });
  }

  // SUBSCRIBE: POST /api/watchlist/:id/subscribe { email }
  // UNSUBSCRIBE: DELETE /api/watchlist/:id/subscribe?email=<addr> OR POST {action:"unsubscribe", email}
  const subscribeMatch = path.match(/\/api\/watchlist\/([^/]+)\/subscribe\/?$/);
  if (subscribeMatch) {
    const id = decodeURIComponent(subscribeMatch[1] ?? "");
    const watch = await loadWatch(env.CACHE, id);
    if (!watch) return new Response("watch not found", { status: 404 });

    if (req.method === "POST") {
      let body: { email?: string; action?: string };
      try { body = await req.json(); } catch { return new Response("invalid json", { status: 400 }); }
      const email = (body.email ?? "").trim().toLowerCase();
      if (!EMAIL_RE.test(email) || email.length > 200) return new Response("invalid email", { status: 400 });
      const subs = new Set(watch.subscribers ?? []);
      if (body.action === "unsubscribe") {
        subs.delete(email);
      } else {
        subs.add(email);
      }
      watch.subscribers = Array.from(subs).slice(0, 20); // cap at 20 per watch
      await saveWatch(env.CACHE, watch);
      return Response.json({ ok: true, subscribers: watch.subscribers, action: body.action === "unsubscribe" ? "unsubscribed" : "subscribed" });
    }
    if (req.method === "DELETE") {
      const email = (url.searchParams.get("email") ?? "").trim().toLowerCase();
      if (!EMAIL_RE.test(email)) return new Response("invalid email", { status: 400 });
      const subs = new Set(watch.subscribers ?? []);
      subs.delete(email);
      watch.subscribers = Array.from(subs);
      await saveWatch(env.CACHE, watch);
      return Response.json({ ok: true, subscribers: watch.subscribers, action: "unsubscribed" });
    }
  }

  return new Response("Not found", { status: 404 });
}

/**
 * Daily cron-triggered demand-signal refresh. For each watch, pings the demand-API for
 * the niche+city and stores the business count + delta. The watchlist UI surfaces this
 * as "+N businesses since yesterday" without us having to run a full scout (which would
 * cost real BD + LLM dollars per watch per day).
 *
 * Heuristics: parse "<niche> [filler] in <city>" and call /api/businesses?q=<niche>&city=<city>.
 */
function parseWatchQuery(q: string): { niche: string; city: string | null } {
  const m = q.match(/^\s*(.+?)\s+(?:in|near|around|@)\s+(.+?)\s*$/i);
  if (m && m[1] && m[2]) return { niche: m[1].trim(), city: m[2].trim() };
  return { niche: q.trim(), city: null };
}

export async function refreshWatchlistDemand(env: Env, opts: { forceEmail?: boolean } = {}): Promise<{ refreshed: number; failed: number; emails_sent: number; emails_failed: number; details: Array<{ id: string; query: string; prev: number | null; current: number | null; delta: number; subscribers: number; emailed: boolean; email_error?: string }> }> {
  const ids = await readIndex(env.CACHE);
  let refreshed = 0;
  let failed = 0;
  let emails_sent = 0;
  let emails_failed = 0;
  const details: Array<{ id: string; query: string; prev: number | null; current: number | null; delta: number; subscribers: number; emailed: boolean; email_error?: string }> = [];
  for (const id of ids) {
    const w = await loadWatch(env.CACHE, id);
    if (!w) continue;
    const { niche, city } = parseWatchQuery(w.query);
    if (!niche) { failed++; continue; }
    const upstream = new URL("/api/businesses", env.DEMAND_API_BASE);
    upstream.searchParams.set("q", niche);
    if (city) upstream.searchParams.set("city", city);
    upstream.searchParams.set("limit", "200");
    let current: number | null = null;
    try {
      const r = await fetch(upstream.toString(), { headers: { "user-agent": "longtailscout-cron/1.0" } });
      if (r.ok) {
        const j = await r.json() as { count?: number };
        if (typeof j.count === "number") current = j.count;
      }
    } catch { /* swallow — leave current null */ }
    if (current === null) { failed++; continue; }
    const prev = w.last_demand_count ?? null;
    const delta = prev !== null ? current - prev : 0;
    w.previous_demand_count = prev;
    w.last_demand_count = current;
    w.last_demand_check_at = Date.now();
    await saveWatch(env.CACHE, w);

    // Decide whether to email: subscribers exist AND (delta > 0 OR forceEmail flag set).
    // The forceEmail path is for the manual cron trigger so we can demo digests on-demand.
    const subscribers = (w.subscribers ?? []).filter(e => typeof e === "string" && e.includes("@"));
    let emailed = false;
    let email_error: string | undefined;
    if (subscribers.length > 0 && (delta > 0 || opts.forceEmail)) {
      if (!env.RESEND_API_KEY) {
        email_error = "RESEND_API_KEY not configured";
        emails_failed++;
      } else {
        const { subject, html, text } = buildDigestEmail(w, current, prev, delta);
        for (const to of subscribers) {
          const res = await sendEmail(env.RESEND_API_KEY, {
            from: RESEND_DEFAULT_FROM,
            to,
            subject,
            html,
            text,
            tags: [{ name: "kind", value: "watchlist-digest" }, { name: "watch_id", value: id.slice(0, 50) }]
          });
          if (res.ok) {
            emails_sent++;
            emailed = true;
          } else {
            emails_failed++;
            email_error = res.error?.slice(0, 200);
          }
        }
      }
    }
    details.push({ id, query: w.query, prev, current, delta, subscribers: subscribers.length, emailed, email_error });
    refreshed++;
  }
  return { refreshed, failed, emails_sent, emails_failed, details };
}

function buildDigestEmail(watch: Watch, current: number, prev: number | null, delta: number): { subject: string; html: string; text: string } {
  const niche = watch.query;
  const deltaText = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "no change";
  const subject = delta > 0
    ? `LongTail Scout: +${delta} new businesses in "${niche}" since yesterday`
    : `LongTail Scout: ${niche} — daily refresh (${deltaText})`;
  const runUrl = `https://longtailscout.com/?q=${encodeURIComponent(niche)}&run=1`;
  const unsubUrl = `https://longtailscout.com/?unsub=${encodeURIComponent(watch.id)}`;

  const text = [
    `LongTail Scout — daily watchlist digest`,
    ``,
    `Watch: ${niche}`,
    `Today's demand-index count: ${current.toLocaleString()}`,
    prev !== null ? `Yesterday's count: ${prev.toLocaleString()} (${deltaText})` : `(first measurement — no previous count to compare)`,
    ``,
    delta > 0
      ? `Run a fresh scout to see the new operators that have landed in this niche:`
      : `Run a scout anytime to refresh the long-tail operator list:`,
    runUrl,
    ``,
    `--`,
    `Unsubscribe: ${unsubUrl}`
  ].join("\n");

  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
  <h1 style="font-size:20px;margin:0 0 4px">LongTail Scout — daily digest</h1>
  <p style="color:#64748b;font-size:13px;margin:0 0 20px">Watchlist refresh ran a few minutes ago.</p>

  <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;background:#f8fafc">
    <div style="font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">Watch</div>
    <div style="font-size:16px;font-weight:600">${escapeHtml(niche)}</div>
  </div>

  <div style="margin:16px 0;padding:16px;border-radius:8px;${delta > 0 ? "background:#ecfdf5;border:1px solid #10b981" : "background:#f1f5f9;border:1px solid #cbd5e1"}">
    <div style="display:flex;align-items:baseline;gap:12px">
      <span style="font-size:32px;font-weight:600;${delta > 0 ? "color:#047857" : "color:#475569"}">${deltaText}</span>
      <span style="color:#475569;font-size:13px">businesses since yesterday's refresh</span>
    </div>
    <div style="font-size:12px;color:#64748b;margin-top:8px">
      Today: <strong>${current.toLocaleString()}</strong>
      ${prev !== null ? ` · Yesterday: <strong>${prev.toLocaleString()}</strong>` : ` · No previous measurement to compare`}
    </div>
  </div>

  <p style="font-size:14px;line-height:1.5">
    ${delta > 0
      ? "New businesses have landed in our 7M-record demand index for this niche — likely fresh long-tail operators worth a scout pass."
      : "No new businesses indexed since yesterday. Saved you a scout run — the demand surface is stable."}
  </p>

  <p style="margin:20px 0">
    <a href="${runUrl}" style="display:inline-block;background:#0f172a;color:white;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:14px">
      Run a fresh scout →
    </a>
  </p>

  <p style="color:#94a3b8;font-size:11px;margin-top:32px;border-top:1px solid #e2e8f0;padding-top:16px">
    You're getting this because you subscribed to digests for "${escapeHtml(niche)}" on longtailscout.com.<br>
    <a href="${unsubUrl}" style="color:#64748b">Unsubscribe</a>
  </p>
</body></html>`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
