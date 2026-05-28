/**
 * SSRF guard for the bridge's /render, /screenshot, and /serp paths.
 *
 * The bridge is the component that ACTUALLY performs the outbound fetch against the
 * Bright Data browser, so this guard must be at least as strict as the worker's
 * (worker/src/handlers/screenshot.ts validateTargetUrl). Kept as a standalone, dependency-free
 * module so it can be unit-tested without booting the HTTP server — see
 * worker/tests/bridgeSsrf.test.ts, which imports this file directly to prevent the two
 * SSRF regexes from drifting apart again (they did once: 580d328).
 *
 * IPv6 ranges that resolve to internal/private networks:
 *   - fc00::/7  (unique-local) — first byte fc or fd, any second byte → "fc[0-9a-f]{2}:" / "fd[0-9a-f]{2}:"
 *   - fe80::/10 (link-local)   — first byte fe, second nibble 8-b      → "fe[89ab][0-9a-f]:"
 *   - ::1       (loopback)
 */
export const PRIVATE_HOSTNAME_RE =
  /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.|fc[0-9a-f]{2}:|fd[0-9a-f]{2}:|fe[89ab][0-9a-f]:|::1$|metadata\.google\.internal)/i;

export function validateRenderUrl(input: string): { ok: true; url: string } | { ok: false; error: string } {
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
  // IPv6 hostnames parse back bracketed ("[fe80::1]"). Strip the brackets before the regex,
  // otherwise every fc00::/fd00::/fe80::/::1 pattern silently misses the bracketed form.
  const host = parsed.hostname.replace(/^\[|\]$/g, "");
  if (PRIVATE_HOSTNAME_RE.test(host)) {
    return { ok: false, error: "private/loopback hostnames are not allowed" };
  }
  return { ok: true, url: parsed.toString() };
}
