/**
 * Regression guard for the BRIDGE's SSRF validator.
 *
 * The bridge (bridge/server.ts) is the component that actually performs the outbound fetch
 * against the Bright Data browser, so its URL guard must be at least as strict as the worker's
 * (tests/security.test.ts covers the worker copy). These two guards drifted once — the worker
 * was hardened against bracketed IPv6 in 580d328 but the bridge kept the old regex, leaving
 * [::1] / [fd12::1] / [fe80::1] exploitable on the actual fetch executor.
 *
 * We import the bridge's pure validateUrl module directly (it has no runtime deps) so this lives
 * in the worker's existing vitest run and fails CI the moment the two guards diverge again.
 */
import { describe, it, expect } from "vitest";
import { validateRenderUrl } from "../../bridge/validateUrl";

const ok = (s: string) => validateRenderUrl(s).ok === true;

describe("bridge validateRenderUrl (SSRF guard on /render, /screenshot, /serp)", () => {
  it("accepts public http(s) URLs", () => {
    expect(ok("https://example.com")).toBe(true);
    expect(ok("http://acme-roofing.com/careers?x=1")).toBe(true);
    expect(ok("https://sub.domain.co.uk/")).toBe(true);
  });

  it("rejects non-http schemes", () => {
    expect(ok("file:///etc/passwd")).toBe(false);
    expect(ok("ftp://example.com/x")).toBe(false);
    expect(ok("gopher://example.com/")).toBe(false);
    expect(ok("javascript:alert(1)")).toBe(false);
    expect(ok("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("rejects loopback (incl. 0.0.0.0)", () => {
    expect(ok("http://localhost/")).toBe(false);
    expect(ok("http://127.0.0.1/")).toBe(false);
    expect(ok("http://127.5.5.5/")).toBe(false);
    expect(ok("http://0.0.0.0/")).toBe(false);
  });

  it("rejects RFC1918 private networks", () => {
    expect(ok("http://10.0.0.1/")).toBe(false);
    expect(ok("http://192.168.1.29/")).toBe(false); // our own demand server
    expect(ok("http://172.16.0.1/")).toBe(false);
    expect(ok("http://172.31.255.255/")).toBe(false);
  });

  it("rejects link-local + cloud metadata", () => {
    expect(ok("http://169.254.169.254/")).toBe(false); // AWS metadata
    expect(ok("http://metadata.google.internal/")).toBe(false);
  });

  it("regression: bracketed IPv6 loopback / unique-local / link-local are rejected", () => {
    // These are exactly the forms the pre-580d326 bridge regex let through.
    expect(ok("http://[::1]/")).toBe(false);
    expect(ok("http://[fc00::1]/")).toBe(false);
    expect(ok("http://[fd12:3456::1]/")).toBe(false);
    expect(ok("http://[fe80::1]/")).toBe(false);
  });

  it("rejects malformed / over-long / empty input", () => {
    expect(ok("")).toBe(false);
    expect(ok("not a url")).toBe(false);
    expect(ok("https://" + "a".repeat(4100))).toBe(false);
  });
});
