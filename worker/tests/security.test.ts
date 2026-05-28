/**
 * Tests for security-critical helpers — these guard real consequences (SSRF, PII leak,
 * unsubscribe token forgery). Pure functions, no KV needed.
 *
 * Maps to Codex external-review finding "Low #10: tests have not grown with feature surface."
 */
import { describe, it, expect } from "vitest";
import { validateTargetUrl } from "../src/handlers/screenshot";
import { redactWatch, signUnsub, verifyUnsub } from "../src/handlers/watchlist";
import { isOwnDomain } from "../src/handlers/nicheRecon";

// ─── SSRF guard ────────────────────────────────────────────────────────────────
describe("validateTargetUrl (SSRF guard for /api/screenshot)", () => {
  it("accepts public http(s) URLs", () => {
    expect(validateTargetUrl("https://example.com")).toBe(true);
    expect(validateTargetUrl("http://example.com/path?q=1")).toBe(true);
    expect(validateTargetUrl("https://sub.domain.co.uk/")).toBe(true);
  });

  it("rejects non-http schemes (file:, ftp:, gopher:, javascript:, data:)", () => {
    expect(validateTargetUrl("file:///etc/passwd")).toBe(false);
    expect(validateTargetUrl("ftp://example.com/x")).toBe(false);
    expect(validateTargetUrl("gopher://example.com/")).toBe(false);
    expect(validateTargetUrl("javascript:alert(1)")).toBe(false);
    expect(validateTargetUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("rejects loopback addresses", () => {
    expect(validateTargetUrl("http://localhost/")).toBe(false);
    expect(validateTargetUrl("http://127.0.0.1/")).toBe(false);
    expect(validateTargetUrl("http://127.5.5.5/")).toBe(false);
    expect(validateTargetUrl("http://[::1]/")).toBe(false);
  });

  it("rejects RFC1918 private networks", () => {
    expect(validateTargetUrl("http://10.0.0.1/")).toBe(false);
    expect(validateTargetUrl("http://192.168.1.29/")).toBe(false); // our own demand server
    expect(validateTargetUrl("http://172.16.0.1/")).toBe(false);
    expect(validateTargetUrl("http://172.31.255.255/")).toBe(false);
  });

  it("rejects link-local + cloud metadata", () => {
    expect(validateTargetUrl("http://169.254.169.254/")).toBe(false); // AWS metadata
    expect(validateTargetUrl("http://metadata.google.internal/")).toBe(false);
  });

  it("rejects IPv6 unique-local + link-local", () => {
    expect(validateTargetUrl("http://[fe80::1]/")).toBe(false);
    expect(validateTargetUrl("http://[fc00::1]/")).toBe(false);
    expect(validateTargetUrl("http://[fd12:3456::1]/")).toBe(false);
  });

  it("rejects malformed / over-long / empty input", () => {
    expect(validateTargetUrl("")).toBe(false);
    expect(validateTargetUrl("not a url")).toBe(false);
    expect(validateTargetUrl("https://" + "a".repeat(2100))).toBe(false);
  });

  it("regression: 0.0.0.0 is rejected", () => {
    // 0.0.0.0 routes to localhost on most Linux kernels — a known SSRF bypass on naive filters.
    expect(validateTargetUrl("http://0.0.0.0/")).toBe(false);
  });
});

// ─── Watchlist PII redaction ──────────────────────────────────────────────────
describe("redactWatch (PII strip on /api/watchlist GET)", () => {
  const FULL_WATCH = {
    id: "watch-abc",
    query: "roofing in Houston",
    created_at: 1700000000000,
    last_run_at: 1700001000000,
    last_count: 12,
    last_op_urls: ["https://a.com", "https://b.com"],
    last_demand_count: 82200,
    previous_demand_count: 82100,
    last_demand_check_at: 1700002000000,
    subscribers: ["alice@example.com", "bob@example.com", "secret@me.org"],
    webhook_url: "https://hooks.slack.com/services/T00/B00/SUPER_SECRET_TOKEN"
  };

  it("strips subscribers array entirely", () => {
    const r = redactWatch(FULL_WATCH) as unknown as Record<string, unknown>;
    expect(r.subscribers).toBeUndefined();
    expect("subscribers" in r).toBe(false);
  });

  it("strips webhook_url entirely (Slack/Discord URLs are production secrets)", () => {
    const r = redactWatch(FULL_WATCH) as unknown as Record<string, unknown>;
    expect(r.webhook_url).toBeUndefined();
    expect("webhook_url" in r).toBe(false);
    // Belt-and-suspenders: make sure the token literal never appears anywhere in the output.
    expect(JSON.stringify(r)).not.toContain("SUPER_SECRET_TOKEN");
    expect(JSON.stringify(r)).not.toContain("hooks.slack.com");
  });

  it("replaces with subscriber_count (number) and webhook_configured (bool)", () => {
    const r = redactWatch(FULL_WATCH);
    expect(r.subscriber_count).toBe(3);
    expect(r.webhook_configured).toBe(true);
  });

  it("never leaks subscriber email content even via toString / nested fields", () => {
    const r = redactWatch(FULL_WATCH);
    const blob = JSON.stringify(r);
    expect(blob).not.toContain("alice@example.com");
    expect(blob).not.toContain("bob@example.com");
    expect(blob).not.toContain("secret@me.org");
  });

  it("handles empty / missing fields gracefully", () => {
    const empty = {
      id: "w", query: "x", created_at: 1, last_run_at: null, last_count: null,
      last_op_urls: []
    } as Parameters<typeof redactWatch>[0];
    const r = redactWatch(empty);
    expect(r.subscriber_count).toBe(0);
    expect(r.webhook_configured).toBe(false);
  });

  it("preserves the non-PII fields verbatim", () => {
    const r = redactWatch(FULL_WATCH);
    expect(r.id).toBe("watch-abc");
    expect(r.query).toBe("roofing in Houston");
    expect(r.last_count).toBe(12);
    expect(r.last_op_urls).toEqual(["https://a.com", "https://b.com"]);
    expect(r.last_demand_count).toBe(82200);
  });
});

// ─── HMAC unsubscribe tokens ──────────────────────────────────────────────────
describe("signUnsub / verifyUnsub (CAN-SPAM email-link auth)", () => {
  const SECRET = "test-secret-not-real";

  it("a freshly-signed token verifies", async () => {
    const t = await signUnsub("watch-1", "alice@example.com", SECRET);
    expect(t).toHaveLength(16);
    expect(t).toMatch(/^[0-9a-f]{16}$/);
    expect(await verifyUnsub("watch-1", "alice@example.com", t, SECRET)).toBe(true);
  });

  it("verification is case-insensitive on email (we lowercase before HMAC)", async () => {
    const t = await signUnsub("watch-1", "alice@example.com", SECRET);
    expect(await verifyUnsub("watch-1", "Alice@Example.com", t, SECRET)).toBe(true);
    expect(await verifyUnsub("watch-1", "ALICE@EXAMPLE.COM", t, SECRET)).toBe(true);
  });

  it("rejects a token signed for a different email", async () => {
    const t = await signUnsub("watch-1", "alice@example.com", SECRET);
    expect(await verifyUnsub("watch-1", "bob@example.com", t, SECRET)).toBe(false);
  });

  it("rejects a token signed for a different watch ID", async () => {
    const t = await signUnsub("watch-1", "alice@example.com", SECRET);
    expect(await verifyUnsub("watch-2", "alice@example.com", t, SECRET)).toBe(false);
  });

  it("rejects a token signed with a different secret", async () => {
    const t = await signUnsub("watch-1", "alice@example.com", SECRET);
    expect(await verifyUnsub("watch-1", "alice@example.com", t, "wrong-secret")).toBe(false);
  });

  it("rejects empty / malformed tokens (wrong length, missing, non-hex)", async () => {
    expect(await verifyUnsub("watch-1", "alice@example.com", "", SECRET)).toBe(false);
    expect(await verifyUnsub("watch-1", "alice@example.com", "short", SECRET)).toBe(false);
    expect(await verifyUnsub("watch-1", "alice@example.com", "z".repeat(16), SECRET)).toBe(false);
    expect(await verifyUnsub("watch-1", "alice@example.com", "a".repeat(15), SECRET)).toBe(false);
    expect(await verifyUnsub("watch-1", "alice@example.com", "a".repeat(17), SECRET)).toBe(false);
  });

  it("two different signings of the same input are deterministic", async () => {
    const t1 = await signUnsub("watch-1", "alice@example.com", SECRET);
    const t2 = await signUnsub("watch-1", "alice@example.com", SECRET);
    expect(t1).toBe(t2);
  });

  it("different (id, email) pairs produce different tokens", async () => {
    const a = await signUnsub("watch-1", "a@x.com", SECRET);
    const b = await signUnsub("watch-2", "a@x.com", SECRET);
    const c = await signUnsub("watch-1", "b@x.com", SECRET);
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(b).not.toBe(c);
  });
});

// ─── Niche-recon platform-host detection ──────────────────────────────────────
describe("isOwnDomain (Apollo-thinness signal for Niche Recon)", () => {
  it("returns true for a business's own domain", () => {
    expect(isOwnDomain("https://example.com")).toBe(true);
    expect(isOwnDomain("https://www.acme-roofing.com/services")).toBe(true);
    expect(isOwnDomain("http://my-dental-clinic.co/about")).toBe(true);
  });

  it("returns false for booking platforms (the Apollo-blind signal)", () => {
    // The whole point of Niche Recon — a salon listed only on Booksy has no domain Apollo can match.
    expect(isOwnDomain("https://booksy.com/en-us/abc-salon")).toBe(false);
    expect(isOwnDomain("https://book.servicetitan.com/g1y9ouq85ga4z3qgvu8z")).toBe(false);
    expect(isOwnDomain("https://dashboard.boulevard.io/booking/businesses/abc")).toBe(false);
    expect(isOwnDomain("https://getsquire.com/discover/barbershop/abc")).toBe(false);
    expect(isOwnDomain("https://vagaro.com/x")).toBe(false);
    expect(isOwnDomain("https://www.mindbodyonline.com/explore")).toBe(false);
    expect(isOwnDomain("https://styleseat.com/m/v/x")).toBe(false);
  });

  it("returns false for social profiles (Apollo-blind too)", () => {
    expect(isOwnDomain("https://facebook.com/abc-pizza")).toBe(false);
    expect(isOwnDomain("https://www.instagram.com/some_salon")).toBe(false);
    expect(isOwnDomain("https://linkedin.com/company/x")).toBe(false);
    expect(isOwnDomain("https://linktr.ee/x")).toBe(false);
    expect(isOwnDomain("https://tiktok.com/@x")).toBe(false);
  });

  it("returns false for aggregators / directories", () => {
    expect(isOwnDomain("https://yelp.com/biz/x")).toBe(false);
    expect(isOwnDomain("https://thumbtack.com/x")).toBe(false);
    expect(isOwnDomain("https://yellowpages.com/x")).toBe(false);
    expect(isOwnDomain("https://angi.com/x")).toBe(false);
    expect(isOwnDomain("https://bbb.org/x")).toBe(false);
  });

  it("returns false for Google profile URLs (very common in our index)", () => {
    expect(isOwnDomain("https://g.page/x")).toBe(false);
    expect(isOwnDomain("https://maps.google.com/x")).toBe(false);
    expect(isOwnDomain("https://business.google.com/x")).toBe(false);
    expect(isOwnDomain("https://sites.google.com/x")).toBe(false);
  });

  it("strips leading subdomain when matching platform hosts (clients.mindbodyonline.com)", () => {
    expect(isOwnDomain("https://clients.mindbodyonline.com/foo")).toBe(false);
    expect(isOwnDomain("https://book.broccoli.com/widget/x")).toBe(true); // not in blocklist by host
  });

  it("returns false for malformed / empty / non-URL inputs", () => {
    expect(isOwnDomain("")).toBe(false);
    expect(isOwnDomain(null)).toBe(false);
    expect(isOwnDomain(undefined)).toBe(false);
    expect(isOwnDomain("not a url")).toBe(false);
    expect(isOwnDomain("abc")).toBe(false);
  });

  it("regression: ServiceTitan booking subdomain (the Codex live-run example)", () => {
    // From the actual demand-index data for "electrical" — every operator had a
    // book.servicetitan.com URL. The killer thinness signal.
    expect(isOwnDomain("https://book.servicetitan.com/qyxkyang6c6zt4xe8hsz0203?rwg_token=AFd1xnE4lp4")).toBe(false);
  });
});
