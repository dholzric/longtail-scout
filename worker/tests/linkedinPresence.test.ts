/**
 * Tests for the LinkedIn-presence classifier (v1.2.0 — "Apollo-blind verification").
 *
 * The whole thesis of LongTail Scout is "these operators aren't on LinkedIn, which is exactly
 * why Apollo/ZoomInfo/Clay miss them." This classifier turns that claim into evidence: we fire a
 * `site:linkedin.com/company "<name>"` Google query THROUGH Bright Data and decide whether a
 * matching company page actually exists. Pure logic, no network — the handler does the BD call.
 */
import { describe, it, expect } from "vitest";
import { normalizeBizName, isLinkedInCompanyUrl, classifyLinkedInResults } from "../src/agent/linkedinPresence";

describe("normalizeBizName", () => {
  it("lowercases and strips common legal/filler suffixes", () => {
    expect(normalizeBizName("Acme Roofing LLC")).toBe("acme roofing");
    expect(normalizeBizName("The Smith & Sons Co.")).toBe("smith sons");
    expect(normalizeBizName("BrightStar HVAC, Inc.")).toBe("brightstar hvac");
    expect(normalizeBizName("Jones Plumbing Company")).toBe("jones plumbing");
  });
  it("collapses punctuation and whitespace ('group' is a filler token, dropped)", () => {
    expect(normalizeBizName("  A-1   Dental   Group!! ")).toBe("a 1 dental");
  });
  it("handles empty / junk", () => {
    expect(normalizeBizName("")).toBe("");
    expect(normalizeBizName("LLC")).toBe("");
  });
});

describe("isLinkedInCompanyUrl", () => {
  it("matches company pages on any linkedin TLD/subdomain", () => {
    expect(isLinkedInCompanyUrl("https://www.linkedin.com/company/acme-roofing")).toBe(true);
    expect(isLinkedInCompanyUrl("https://linkedin.com/company/123456")).toBe(true);
    expect(isLinkedInCompanyUrl("https://uk.linkedin.com/company/foo")).toBe(true);
  });
  it("rejects personal profiles, posts, and non-linkedin links", () => {
    expect(isLinkedInCompanyUrl("https://www.linkedin.com/in/john-smith")).toBe(false);
    expect(isLinkedInCompanyUrl("https://www.linkedin.com/posts/abc")).toBe(false);
    expect(isLinkedInCompanyUrl("https://acme-roofing.com")).toBe(false);
    expect(isLinkedInCompanyUrl("not a url")).toBe(false);
  });
});

describe("classifyLinkedInResults", () => {
  const li = (slug: string, title: string, snippet = "") =>
    ({ title, link: `https://www.linkedin.com/company/${slug}`, snippet, position: 1 });

  it("flags on_linkedin when a company result matches the operator name", () => {
    const r = classifyLinkedInResults("Acme Roofing LLC", [
      li("acme-roofing", "Acme Roofing | LinkedIn", "Acme Roofing is a Houston-based commercial roofer."),
    ]);
    expect(r.on_linkedin).toBe(true);
    expect(r.evidence_url).toContain("linkedin.com/company/acme-roofing");
    expect(r.match_count).toBe(1);
  });

  it("does NOT flag when the only company results are unrelated businesses", () => {
    const r = classifyLinkedInResults("Acme Roofing", [
      li("globex-corp", "Globex Corporation | LinkedIn", "A multinational conglomerate."),
      { title: "Acme Roofing - Home", link: "https://acme-roofing.com", snippet: "", position: 2 },
    ]);
    expect(r.on_linkedin).toBe(false);
    expect(r.evidence_url).toBeNull();
    expect(r.match_count).toBe(0);
  });

  it("matches on a name token overlap, tolerating the LinkedIn ' | LinkedIn' suffix", () => {
    const r = classifyLinkedInResults("BrightStar HVAC, Inc.", [
      li("brightstar-hvac", "BrightStar HVAC | LinkedIn"),
    ]);
    expect(r.on_linkedin).toBe(true);
  });

  it("returns not-found on an empty result set (the common long-tail case)", () => {
    const r = classifyLinkedInResults("Tiny Local Plumber", []);
    expect(r.on_linkedin).toBe(false);
    expect(r.match_count).toBe(0);
    expect(r.evidence_url).toBeNull();
  });

  it("ignores linkedin personal profiles even if the name matches (we want the COMPANY page)", () => {
    const r = classifyLinkedInResults("John Smith Plumbing", [
      { title: "John Smith | LinkedIn", link: "https://www.linkedin.com/in/john-smith", snippet: "", position: 1 },
    ]);
    expect(r.on_linkedin).toBe(false);
  });
});
