/**
 * /api/screenshot?url=<encoded>&w=1024&h=640
 *
 * Returns a PNG screenshot of the operator's homepage, rendered via the BD Browser API.
 * Cached for 30 days in KV (one capture per URL+viewport, ever). Lazy-loaded from the
 * drill-down UI — we never auto-capture during the scout pass (would balloon BD cost).
 */
import type { Env } from "../index";
import { cacheKey } from "../cache";

interface BridgeScreenshotResp {
  url: string;
  final_url: string;
  status: number;
  title: string | null;
  image_base64: string;
  width: number;
  height: number;
  fetched_at: string;
  duration_ms: number;
}

const PRIVATE_HOSTNAME_RE = /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.|fe80:|fc00:|fd00:|::1$|metadata\.google\.internal)/i;

function validateTargetUrl(s: string): boolean {
  if (!s || s.length > 2048) return false;
  let u: URL;
  try { u = new URL(s); } catch { return false; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (PRIVATE_HOSTNAME_RE.test(u.hostname)) return false;
  return true;
}

function authorized(req: Request, env: Env): boolean {
  if (!env.DEMO_PASSWORD) return true;
  const h = req.headers.get("authorization") ?? "";
  // Accept either Bearer header OR ?key= query param (drill-down image tag can't send headers)
  if (h === `Bearer ${env.DEMO_PASSWORD}`) return true;
  const url = new URL(req.url);
  if (url.searchParams.get("key") === env.DEMO_PASSWORD) return true;
  return false;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function screenshotHandler(req: Request, env: Env): Promise<Response> {
  if (!authorized(req, env)) return new Response("unauthorized", { status: 401 });
  const url = new URL(req.url);
  const target = url.searchParams.get("url") ?? "";
  if (!validateTargetUrl(target)) {
    return Response.json({ error: "invalid url" }, { status: 400 });
  }
  const w = clampInt(url.searchParams.get("w"), 320, 1920, 1024);
  const h = clampInt(url.searchParams.get("h"), 240, 1080, 640);

  const key = (await cacheKey("shot", { target, w, h })).replace(/^tool:/, "");
  // KV holds the base64 (stream output binary directly to client).
  const cached = await env.CACHE.get(key);
  if (cached) {
    return new Response(base64ToBytes(cached).buffer as ArrayBuffer, {
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=86400",
        "x-shot-cache": "hit"
      }
    });
  }

  // Call the bridge
  const bridgeUrl = `${env.BRIDGE_BASE.replace(/\/$/, "")}/screenshot`;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (env.BRIDGE_AUTH_TOKEN) headers["authorization"] = `Bearer ${env.BRIDGE_AUTH_TOKEN}`;
  let bridgeResp: Response;
  try {
    bridgeResp = await fetch(bridgeUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ url: target, width: w, height: h, waitMs: 2000 })
    });
  } catch (err) {
    return Response.json({ error: "bridge unreachable", detail: (err as Error).message }, { status: 502 });
  }
  if (!bridgeResp.ok) {
    return Response.json({ error: "bridge error", status: bridgeResp.status }, { status: 502 });
  }
  const data = await bridgeResp.json() as BridgeScreenshotResp;
  if (!data.image_base64) {
    return Response.json({ error: "no image in bridge response" }, { status: 502 });
  }
  // 30-day cache — homepages don't change visually often enough to matter for the demo.
  await env.CACHE.put(key, data.image_base64, { expirationTtl: 30 * 86400 });
  return new Response(base64ToBytes(data.image_base64).buffer as ArrayBuffer, {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=86400",
      "x-shot-cache": "miss",
      "x-shot-duration-ms": String(data.duration_ms)
    }
  });
}

function clampInt(raw: string | null, min: number, max: number, fallback: number): number {
  const n = parseInt(raw ?? "", 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
