/**
 * Tests for the contact-discovery email extractor (v1.3.0).
 *
 * Homepage enrichment already pulls phone + an owner name (agent/contact.ts). This adds the
 * missing piece an SDR actually needs: a real email address, harvested from the contact/about
 * pages via Bright Data. The handler does the BD fetches; this pure logic decides which strings
 * are real, usable business emails vs. tracking/placeholder noise.
 */
import { describe, it, expect } from "vitest";
import { extractEmails } from "../src/agent/contactDiscovery";
import { contactPageCandidates } from "../src/handlers/contactDiscovery";

describe("contactPageCandidates", () => {
  it("puts the homepage first, then contact paths, capped at 3", () => {
    const c = contactPageCandidates("https://acme-roofing.com/");
    expect(c[0]).toBe("https://acme-roofing.com/");
    expect(c).toHaveLength(3);
    expect(c[1]).toBe("https://acme-roofing.com/contact");
  });
  it("derives paths from the origin even when given a deep page", () => {
    const c = contactPageCandidates("https://acme-roofing.com/services/commercial");
    expect(c).toContain("https://acme-roofing.com/contact");
  });
  it("returns [] for a non-URL", () => {
    expect(contactPageCandidates("not a url")).toEqual([]);
  });
});

describe("extractEmails", () => {
  it("pulls mailto: and plain-text emails, deduped + lowercased", () => {
    const html = `<a href="mailto:Info@Acme-Roofing.com">email us</a> or reach Bob at bob@acme-roofing.com. Info@acme-roofing.com`;
    const emails = extractEmails(html, "acme-roofing.com").map(e => e.email);
    expect(emails).toContain("info@acme-roofing.com");
    expect(emails).toContain("bob@acme-roofing.com");
    expect(emails.filter(e => e === "info@acme-roofing.com")).toHaveLength(1); // deduped
  });

  it("ranks same-domain emails ahead of off-domain ones", () => {
    const html = `contractor@gmail.com sales@acme-roofing.com`;
    const emails = extractEmails(html, "acme-roofing.com");
    expect(emails[0]!.email).toBe("sales@acme-roofing.com");
    expect(emails[0]!.same_domain).toBe(true);
    expect(emails.find(e => e.email === "contractor@gmail.com")!.same_domain).toBe(false);
  });

  it("drops asset/tracking/placeholder junk", () => {
    const html = `
      sprite@2x.png logo@2x.jpg
      hello@sentry.io u@wixpress.com
      you@example.com youremail@domain.com name@yourcompany.com
      real@acme-roofing.com`;
    const emails = extractEmails(html, "acme-roofing.com").map(e => e.email);
    expect(emails).toEqual(["real@acme-roofing.com"]);
  });

  it("handles www. prefix on the site hostname when judging same-domain", () => {
    const emails = extractEmails("x@acme-roofing.com", "www.acme-roofing.com");
    expect(emails[0]!.same_domain).toBe(true);
  });

  it("returns [] for html with no emails", () => {
    expect(extractEmails("<p>no contact here</p>", "acme.com")).toEqual([]);
  });

  it("caps the number of returned emails (avoid dumping a harvested list)", () => {
    const many = Array.from({ length: 50 }, (_, i) => `user${i}@acme-roofing.com`).join(" ");
    expect(extractEmails(many, "acme-roofing.com").length).toBeLessThanOrEqual(10);
  });
});
