import http from "node:http";
import { chromium, type Browser } from "playwright-core";
import * as cheerio from "cheerio";

const BD_WS = process.env.BRIGHTDATA_BROWSER_WSS;
const PORT = Number(process.env.BRIDGE_PORT ?? 8081);
const AUTH = process.env.BRIDGE_AUTH_TOKEN ?? "";

if (!BD_WS) {
  console.error("Missing BRIGHTDATA_BROWSER_WSS env var");
  process.exit(1);
}

let sharedBrowser: Browser | null = null;
let connectingPromise: Promise<Browser> | null = null;
let navCount = 0;
const NAV_RECYCLE = 6; // recycle the session every N navigations

// Simple FIFO mutex — serialize all renders to one-at-a-time.
// Bright Data Browser API throttles concurrent contexts; serialization sidesteps that.
let renderChain: Promise<unknown> = Promise.resolve();
function withMutex<T>(fn: () => Promise<T>): Promise<T> {
  const next = renderChain.then(fn, fn);
  renderChain = next.catch(() => undefined);
  return next;
}

async function getBrowser(): Promise<Browser> {
  if (sharedBrowser && sharedBrowser.isConnected()) return sharedBrowser;
  if (connectingPromise) return connectingPromise;
  connectingPromise = (async () => {
    console.log("[bridge] connecting to Bright Data Browser API…");
    const b = await chromium.connectOverCDP(BD_WS as string, { timeout: 60_000 });
    b.on("disconnected", () => {
      console.log("[bridge] browser disconnected — will reconnect on next request");
      if (sharedBrowser === b) sharedBrowser = null;
    });
    sharedBrowser = b;
    connectingPromise = null;
    console.log("[bridge] connected");
    return b;
  })();
  try {
    return await connectingPromise;
  } finally {
    connectingPromise = null;
  }
}

interface RenderResult {
  url: string;
  final_url: string;
  status: number;
  html: string;
  title: string | null;
  fetched_at: string;
  duration_ms: number;
}

async function renderOnce(url: string, opts: { waitMs?: number; selector?: string }): Promise<RenderResult> {
  const start = Date.now();
  // Proactively recycle the browser session every NAV_RECYCLE navigations to avoid hitting BD's per-session limit.
  if (navCount >= NAV_RECYCLE && sharedBrowser) {
    console.log(`[bridge] recycling browser after ${navCount} navs`);
    try { await sharedBrowser.close(); } catch { /* ignore */ }
    sharedBrowser = null;
    navCount = 0;
    await new Promise(r => setTimeout(r, 1500));
  }
  const browser = await getBrowser();
  navCount++;
  const context = await browser.newContext({ userAgent: undefined });
  const page = await context.newPage();
  try {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    if (opts.selector) {
      try { await page.waitForSelector(opts.selector, { timeout: 10_000 }); } catch { /* continue */ }
    }
    if (opts.waitMs && opts.waitMs > 0) {
      await page.waitForTimeout(Math.min(opts.waitMs, 15_000));
    }
    const html = await page.content();
    const title = await page.title().catch(() => null);
    return {
      url,
      final_url: page.url(),
      status: resp?.status() ?? 0,
      html,
      title,
      fetched_at: new Date().toISOString(),
      duration_ms: Date.now() - start
    };
  } finally {
    await context.close().catch(() => {});
  }
}

async function renderPage(url: string, opts: { waitMs?: number; selector?: string } = {}): Promise<RenderResult> {
  return withMutex(async () => {
    // Retry once on Bright Data session-level errors (domain-limit, disconnected, etc.)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await renderOnce(url, opts);
      } catch (err) {
        const msg = (err as Error).message ?? "";
        const isSessionFault = /domain limit reached|disconnected|Target page, context or browser has been closed|Browser has been closed|Protocol error|Missing Credentials/i.test(msg);
        if (isSessionFault && attempt === 0) {
          console.warn(`[bridge] session fault on ${url} — recycling browser:`, msg.slice(0, 200));
          try { await sharedBrowser?.close(); } catch { /* ignore */ }
          sharedBrowser = null;
          navCount = 0;
          // longer backoff before reconnect to let BD release the session
          await new Promise(r => setTimeout(r, 5000));
          continue;
        }
        throw err;
      }
    }
    throw new Error("renderPage: exhausted retries");
  });
}

interface SerpResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

const BLOCKED_LINK_RE = /google\.com\/(search|imgres|maps|aclk|url|finance|shopping|preferences|policies)|googleusercontent|webcache\.googleusercontent|accounts\.google\.com|support\.google\.com|youtube\.com\/watch/i;

async function serpSearch(query: string, num = 15): Promise<{ query: string; results: SerpResult[]; duration_ms: number }> {
  const start = Date.now();
  const u = new URL("https://www.google.com/search");
  u.searchParams.set("q", query);
  u.searchParams.set("num", String(num));
  u.searchParams.set("hl", "en");
  const rendered = await renderPage(u.toString(), { selector: "h3" });

  const $ = cheerio.load(rendered.html);
  const results: SerpResult[] = [];
  const seen = new Set<string>();

  $("h3").each((_, h3) => {
    if (results.length >= num) return;
    const title = $(h3).text().trim();
    if (!title) return;
    // Climb to nearest ancestor <a href="http(s)://...">
    const anchor = $(h3).closest("a[href^='http']");
    let link = anchor.attr("href") ?? "";
    if (!link) {
      // fallback: nearest sibling a in the result block
      const block = $(h3).closest("div");
      link = block.find("a[href^='http']").first().attr("href") ?? "";
    }
    if (!link.startsWith("http")) return;
    if (BLOCKED_LINK_RE.test(link)) return;
    if (seen.has(link)) return;
    seen.add(link);
    // Snippet — adjacent description span/div
    let snippet = "";
    const block = $(h3).closest("div");
    const cand = block.parent().find("div[data-sncf], div[style*='-webkit-line-clamp'], span.aCOpRe, span.st").first();
    if (cand.length) snippet = cand.text().trim().slice(0, 280);
    results.push({ title, link, snippet, position: results.length + 1 });
  });

  return { query, results, duration_ms: Date.now() - start };
}

const MAX_BODY_BYTES = 32 * 1024; // 32 KB — way more than we need for a render or serp request

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = "";
    let bytes = 0;
    let aborted = false;
    req.on("data", (c: Buffer | string) => {
      if (aborted) return;
      bytes += typeof c === "string" ? Buffer.byteLength(c) : c.length;
      if (bytes > MAX_BODY_BYTES) {
        aborted = true;
        reject(new Error(`request body exceeds ${MAX_BODY_BYTES} bytes`));
        req.destroy();
        return;
      }
      buf += c;
    });
    req.on("end", () => { if (!aborted) resolve(buf); });
    req.on("error", reject);
  });
}

const PRIVATE_HOSTNAME_RE = /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.|fe80:|fc00:|fd00:|::1$|metadata\.google\.internal)/i;

function validateRenderUrl(input: string): { ok: true; url: string } | { ok: false; error: string } {
  if (typeof input !== "string") return { ok: false, error: "url must be a string" };
  if (input.length > 4096) return { ok: false, error: "url too long" };
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return { ok: false, error: "url is not a valid URL" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "url must be http or https" };
  }
  if (PRIVATE_HOSTNAME_RE.test(parsed.hostname)) {
    return { ok: false, error: "private/loopback hostnames are not allowed" };
  }
  return { ok: true, url: parsed.toString() };
}

function clampWaitMs(v: unknown): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return undefined;
  return Math.min(Math.floor(v), 15_000);
}

function checkAuth(req: http.IncomingMessage): boolean {
  if (!AUTH) return true;
  const h = req.headers.authorization ?? "";
  return h === `Bearer ${AUTH}`;
}

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (req.method === "GET" && url.pathname === "/health") {
      return send(res, 200, { ok: true, ts: Date.now(), browser_connected: sharedBrowser?.isConnected() ?? false });
    }

    if (!checkAuth(req)) return send(res, 401, { error: "unauthorized" });

    if (req.method === "POST" && url.pathname === "/render") {
      const body = JSON.parse(await readBody(req)) as { url?: string; waitMs?: number; selector?: string };
      if (!body.url) return send(res, 400, { error: "missing url" });
      const validated = validateRenderUrl(body.url);
      if (!validated.ok) return send(res, 400, { error: validated.error });
      const selector = typeof body.selector === "string" && body.selector.length <= 256 ? body.selector : undefined;
      const result = await renderPage(validated.url, { waitMs: clampWaitMs(body.waitMs), selector });
      return send(res, 200, result);
    }

    if (req.method === "POST" && url.pathname === "/serp") {
      const body = JSON.parse(await readBody(req)) as { query?: string; num?: number };
      if (!body.query || typeof body.query !== "string") return send(res, 400, { error: "missing query" });
      if (body.query.length > 512) return send(res, 400, { error: "query too long" });
      const num = typeof body.num === "number" && body.num >= 1 ? Math.min(body.num, 30) : 15;
      const result = await serpSearch(body.query, num);
      return send(res, 200, result);
    }

    return send(res, 404, { error: "not found" });
  } catch (err) {
    console.error("[bridge] error:", err);
    return send(res, 500, { error: (err as Error).message });
  }
});

server.listen(PORT, () => {
  console.log(`[bridge] listening on :${PORT}`);
});
