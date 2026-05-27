import http from "node:http";
import { chromium, type Browser } from "playwright-core";

const BD_WS = process.env.BRIGHTDATA_BROWSER_WSS;
const PORT = Number(process.env.BRIDGE_PORT ?? 8081);
const AUTH = process.env.BRIDGE_AUTH_TOKEN ?? "";

if (!BD_WS) {
  console.error("Missing BRIGHTDATA_BROWSER_WSS env var");
  process.exit(1);
}

let sharedBrowser: Browser | null = null;
let connectingPromise: Promise<Browser> | null = null;

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

async function renderPage(url: string, opts: { waitMs?: number; selector?: string } = {}): Promise<RenderResult> {
  const start = Date.now();
  const browser = await getBrowser();
  const context = await browser.newContext({ userAgent: undefined });
  const page = await context.newPage();
  try {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    if (opts.selector) {
      try {
        await page.waitForSelector(opts.selector, { timeout: 10_000 });
      } catch {
        // selector didn't appear; continue anyway
      }
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

interface SerpResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

async function serpSearch(query: string, num = 15): Promise<{ query: string; results: SerpResult[]; duration_ms: number }> {
  const start = Date.now();
  const u = new URL("https://www.google.com/search");
  u.searchParams.set("q", query);
  u.searchParams.set("num", String(num));
  u.searchParams.set("hl", "en");
  const rendered = await renderPage(u.toString(), { selector: "div#search" });

  const results: SerpResult[] = [];
  const html = rendered.html;
  const linkRe = /<a[^>]*href="(https?:\/\/[^"#]+)"[^>]*>(?:[^<]|<(?!a\s))*?<h3[^>]*>([^<]+)<\/h3>/gi;
  const seen = new Set<string>();
  let position = 0;
  for (const m of html.matchAll(linkRe)) {
    if (results.length >= num) break;
    const link = m[1] ?? "";
    const title = (m[2] ?? "").trim();
    if (!link || !title) continue;
    if (/google\.com\/(search|imgres|maps)|googleusercontent|webcache\.googleusercontent/.test(link)) continue;
    if (seen.has(link)) continue;
    seen.add(link);
    position++;
    results.push({ title, link, snippet: "", position });
  }
  return { query, results, duration_ms: Date.now() - start };
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = "";
    req.on("data", c => (buf += c));
    req.on("end", () => resolve(buf));
    req.on("error", reject);
  });
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
      const result = await renderPage(body.url, { waitMs: body.waitMs, selector: body.selector });
      return send(res, 200, result);
    }

    if (req.method === "POST" && url.pathname === "/serp") {
      const body = JSON.parse(await readBody(req)) as { query?: string; num?: number };
      if (!body.query) return send(res, 400, { error: "missing query" });
      const result = await serpSearch(body.query, body.num ?? 15);
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
