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
  /** Email subscribers — receive a daily digest from the cron when delta > 0.
   *  Never exposed in LIST responses — see redactWatch(). */
  subscribers?: string[];
  /** Optional Slack / Discord-compatible incoming webhook URL — cron POSTs delta payload when > 0.
   *  Never exposed in LIST responses — see redactWatch(). */
  webhook_url?: string;
}

/** Public-facing watch shape — subscribers and webhook URL are PII / sensitive secrets.
 *  Since the demo password is shared with every judge, anyone listing watches must NOT see
 *  other people's email addresses or production Slack/Discord URLs. We expose counts + flags
 *  only. The real values stay server-side and are only ever used by the cron. */
interface RedactedWatch extends Omit<Watch, "subscribers" | "webhook_url"> {
  /** Replaces the `subscribers: string[]` field. We show a count, never the addresses. */
  subscriber_count: number;
  /** Replaces the `webhook_url: string` field. True if one is configured. */
  webhook_configured: boolean;
}

function redactWatch(w: Watch): RedactedWatch {
  const { subscribers, webhook_url, ...rest } = w;
  return {
    ...rest,
    subscriber_count: (subscribers ?? []).length,
    webhook_configured: typeof webhook_url === "string" && webhook_url.length > 0
  };
}

/** Sign a (watch_id, email) tuple with HMAC-SHA256 keyed on DEMO_PASSWORD. The first 16 hex
 *  chars are enough entropy (~64 bits) to make brute-force enumeration impractical while
 *  keeping email URLs short enough to render cleanly. */
async function signUnsub(id: string, email: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${id}|${email.toLowerCase()}`));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

async function verifyUnsub(id: string, email: string, token: string, secret: string): Promise<boolean> {
  if (!token || token.length !== 16) return false;
  const expected = await signUnsub(id, email, secret);
  // Constant-time compare so we don't leak the prefix on mismatch.
  if (expected.length !== token.length) return false;
  let ok = 0;
  for (let i = 0; i < expected.length; i++) ok |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return ok === 0;
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
  const url = new URL(req.url);
  const path = url.pathname; // /api/watchlist or /api/watchlist/:id

  // PUBLIC: GET/POST /api/watchlist/unsubscribe — token-authenticated, no demo password required.
  // CAN-SPAM compliance: the digest email link must work for the recipient without forcing them
  // to know the demo password. HMAC token in the URL proves we sent the email to that address.
  if (/\/api\/watchlist\/unsubscribe\/?$/.test(path)) {
    return handleUnsubscribeByToken(req, env);
  }

  if (!checkAuth(req, env)) {
    return new Response(JSON.stringify({ error: "auth required" }), {
      status: 401,
      headers: { "content-type": "application/json" }
    });
  }

  // LIST: GET /api/watchlist — returns redacted watches (no subscriber emails, no webhook URLs).
  // Demo password is shared with all judges; exposing per-user PII to every authorized visitor
  // would let a malicious user enumerate everyone else's emails / production webhook URLs.
  if (req.method === "GET" && /\/api\/watchlist\/?$/.test(path)) {
    const ids = await readIndex(env.CACHE);
    const watches: RedactedWatch[] = [];
    for (const id of ids) {
      const w = await loadWatch(env.CACHE, id);
      if (w) watches.push(redactWatch(w));
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

  // WEBHOOK: POST /api/watchlist/:id/webhook { url }  (DELETE clears it)
  const webhookMatch = path.match(/\/api\/watchlist\/([^/]+)\/webhook\/?$/);
  if (webhookMatch) {
    const id = decodeURIComponent(webhookMatch[1] ?? "");
    const watch = await loadWatch(env.CACHE, id);
    if (!watch) return new Response("watch not found", { status: 404 });
    if (req.method === "POST") {
      let body: { url?: string };
      try { body = await req.json(); } catch { return new Response("invalid json", { status: 400 }); }
      const webhookUrl = (body.url ?? "").trim();
      // Basic validation — must be https, length-capped, accept Slack/Discord patterns
      if (!/^https:\/\/(hooks\.slack\.com|discord\.com\/api\/webhooks|discordapp\.com\/api\/webhooks)\//i.test(webhookUrl) || webhookUrl.length > 500) {
        return Response.json({ error: "webhook must be a Slack or Discord incoming-webhook https URL" }, { status: 400 });
      }
      watch.webhook_url = webhookUrl;
      await saveWatch(env.CACHE, watch);
      return Response.json({ ok: true, webhook_url: webhookUrl });
    }
    if (req.method === "DELETE") {
      watch.webhook_url = undefined;
      await saveWatch(env.CACHE, watch);
      return Response.json({ ok: true, cleared: true });
    }
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

/** Public unsubscribe endpoint — authorizes via HMAC token in the URL instead of the demo
 *  password, so the unsubscribe link in digest emails works for recipients who don't have
 *  the password. Both GET (followed from email link, returns a friendly HTML page) and POST
 *  (called by the SPA when it detects ?unsub= in the URL) are accepted. */
async function handleUnsubscribeByToken(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const id = (url.searchParams.get("id") ?? "").trim();
  const email = (url.searchParams.get("email") ?? "").trim().toLowerCase();
  const token = (url.searchParams.get("token") ?? "").trim();
  const secret = env.DEMO_PASSWORD ?? "";
  if (!id || !email || !token || !secret) {
    return unsubResponse(req, false, "missing id, email, or token");
  }
  if (!EMAIL_RE.test(email)) return unsubResponse(req, false, "invalid email");
  if (!(await verifyUnsub(id, email, token, secret))) {
    return unsubResponse(req, false, "invalid token (link may be expired or tampered)");
  }
  const watch = await loadWatch(env.CACHE, id);
  if (!watch) return unsubResponse(req, false, "watch not found");
  const subs = new Set(watch.subscribers ?? []);
  const wasSubscribed = subs.has(email);
  subs.delete(email);
  watch.subscribers = Array.from(subs);
  await saveWatch(env.CACHE, watch);
  return unsubResponse(req, true, wasSubscribed ? `unsubscribed ${email} from "${watch.query}"` : `${email} was not subscribed to "${watch.query}"`);
}

function unsubResponse(req: Request, ok: boolean, message: string): Response {
  // GET → friendly HTML page (the user clicked an email link). POST → JSON (the SPA called it).
  const wantsJson = req.method !== "GET" || (req.headers.get("accept") ?? "").includes("application/json");
  if (wantsJson) {
    return Response.json({ ok, message }, { status: ok ? 200 : 400 });
  }
  const safe = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>LongTail Scout — Unsubscribe</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;max-width:520px;margin:60px auto;padding:24px;color:#1a1814}
h1{font-size:22px;margin:0 0 8px}.box{padding:18px;border-radius:8px;${ok ? "background:#dce5cc;border:1px solid #3e6b2c" : "background:#f4e1da;border:1px solid #a8351f"}}
.muted{color:#6b645b;font-size:13px;margin-top:12px}a{color:#1a1814}</style></head><body>
<h1>${ok ? "Unsubscribed ✓" : "Couldn't unsubscribe"}</h1>
<div class="box">${safe}</div>
<p class="muted">You can resubscribe anytime from the watchlist on <a href="https://longtailscout.com">longtailscout.com</a>.</p>
</body></html>`;
  return new Response(html, { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8" } });
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

export async function refreshWatchlistDemand(env: Env, opts: { forceEmail?: boolean } = {}): Promise<{ refreshed: number; failed: number; emails_sent: number; emails_failed: number; webhooks_sent: number; webhooks_failed: number; details: Array<{ id: string; query: string; prev: number | null; current: number | null; delta: number; subscribers: number; emailed: boolean; webhook_sent?: boolean; email_error?: string; webhook_error?: string }> }> {
  const ids = await readIndex(env.CACHE);
  let refreshed = 0;
  let failed = 0;
  let emails_sent = 0;
  let emails_failed = 0;
  let webhooks_sent = 0;
  let webhooks_failed = 0;
  const details: Array<{ id: string; query: string; prev: number | null; current: number | null; delta: number; subscribers: number; emailed: boolean; webhook_sent?: boolean; email_error?: string; webhook_error?: string }> = [];
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
      } else if (!env.DEMO_PASSWORD) {
        email_error = "DEMO_PASSWORD not configured (used as HMAC secret for unsub tokens)";
        emails_failed++;
      } else {
        // Per-recipient render so each subscriber's unsubscribe link only unsubscribes them.
        for (const to of subscribers) {
          const token = await signUnsub(w.id, to, env.DEMO_PASSWORD);
          const { subject, html, text } = buildDigestEmail(w, current, prev, delta, to, token);
          const res = await sendEmail(env.RESEND_API_KEY, {
            from: RESEND_DEFAULT_FROM,
            to,
            subject,
            html,
            text,
            tags: [
              { name: "kind", value: "watchlist-digest" },
              // Resend requires tag values to be [A-Za-z0-9_-]. Strip everything else and cap length.
              { name: "watch_id", value: id.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 50) }
            ]
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
    // Webhook fire — same trigger as email: delta>0 OR forceEmail flag set.
    let webhook_sent: boolean | undefined;
    let webhook_error: string | undefined;
    if (w.webhook_url && (delta > 0 || opts.forceEmail)) {
      try {
        const isDiscord = /discord(app)?\.com/i.test(w.webhook_url);
        const payload = buildWebhookPayload(w, current, prev, delta, isDiscord);
        const r = await fetch(w.webhook_url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (r.ok) { webhooks_sent++; webhook_sent = true; }
        else { webhooks_failed++; webhook_error = `HTTP ${r.status}`; }
      } catch (err) {
        webhooks_failed++;
        webhook_error = (err as Error).message.slice(0, 200);
      }
    }

    details.push({ id, query: w.query, prev, current, delta, subscribers: subscribers.length, emailed, webhook_sent, email_error, webhook_error });
    refreshed++;
  }
  return { refreshed, failed, emails_sent, emails_failed, webhooks_sent, webhooks_failed, details };
}

/** Slack-compatible payload (attachments). Discord accepts the same `text` field and ignores the rest, so this works for both. */
function buildWebhookPayload(watch: Watch, current: number, prev: number | null, delta: number, _isDiscord: boolean) {
  const deltaText = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "no change";
  const runUrl = `https://longtailscout.com/?q=${encodeURIComponent(watch.query)}&run=1`;
  const headline = delta > 0
    ? `:chart_with_upwards_trend: LongTail Scout · *+${delta}* new businesses in "${watch.query}"`
    : `:bar_chart: LongTail Scout · "${watch.query}" daily refresh (${deltaText})`;
  const summary = prev !== null
    ? `Today: *${current.toLocaleString()}* · Yesterday: *${prev.toLocaleString()}* (${deltaText})`
    : `First measurement — ${current.toLocaleString()} businesses match.`;
  return {
    text: `${headline}\n${summary}\n<${runUrl}|Run a fresh scout →>`,
    // Slack: rich attachment for clients that render it; Discord renders the `text` only.
    attachments: [
      {
        color: delta > 0 ? "#10b981" : "#94a3b8",
        fields: [
          { title: "Watch", value: watch.query, short: false },
          { title: "Δ since yesterday", value: deltaText, short: true },
          { title: "Today's count", value: current.toLocaleString(), short: true }
        ],
        actions: [{ type: "button", text: "Run fresh scout", url: runUrl }]
      }
    ]
  };
}

function buildDigestEmail(watch: Watch, current: number, prev: number | null, delta: number, recipientEmail: string, unsubToken: string): { subject: string; html: string; text: string } {
  const niche = watch.query;
  const deltaText = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "no change";
  const subject = delta > 0
    ? `LongTail Scout: +${delta} new businesses in "${niche}" since yesterday`
    : `LongTail Scout: ${niche} — daily refresh (${deltaText})`;
  const runUrl = `https://longtailscout.com/?q=${encodeURIComponent(niche)}&run=1`;
  // Authenticated unsubscribe — the SPA reads the same params on page load and POSTs to
  // /api/watchlist/unsubscribe. Hitting the URL directly (GET) returns a friendly confirmation page.
  const unsubUrl = `https://longtailscout.com/api/watchlist/unsubscribe?id=${encodeURIComponent(watch.id)}&email=${encodeURIComponent(recipientEmail)}&token=${unsubToken}`;

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
