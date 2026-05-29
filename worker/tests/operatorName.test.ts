/**
 * Tests for operator-name cleanup (v1.7.2).
 *
 * Enrichment names operators from the page <title>, which is usually SEO cruft like
 * "Houston Roofing Contractor | Advanced Roofing Solutions". This picks the brand segment using
 * the operator's own domain as the signal — surfacing the clean brand name in the table, the
 * brief, and the name-based Bright Data features. Conservative: never invents a name, falls back
 * to the first segment when the domain gives no signal.
 */
import { describe, it, expect } from "vitest";
import { cleanOperatorName } from "../src/agent/operatorName";

describe("cleanOperatorName", () => {
  it("picks the brand segment that matches the domain (brand after the separator)", () => {
    expect(cleanOperatorName("Houston Roofing Contractor | Advanced Roofing Solutions", "https://advancedroofinghouston.com/"))
      .toBe("Advanced Roofing Solutions");
  });

  it("picks the brand segment when it leads", () => {
    expect(cleanOperatorName("Lone Star Roofing - Houston Roofing Company", "https://lone-star-roofing.com/"))
      .toBe("Lone Star Roofing");
    expect(cleanOperatorName("Best Roofing Co - Dallas Roofing Contractor", "https://bestroofingco.com"))
      .toBe("Best Roofing Co");
  });

  it("leaves a clean single-segment name untouched", () => {
    expect(cleanOperatorName("Amstill Roofing", "https://amstillroofing.com")).toBe("Amstill Roofing");
  });

  it("strips Home / platform suffixes", () => {
    expect(cleanOperatorName("Acme HVAC | Home", "https://acmehvac.com")).toBe("Acme HVAC");
    expect(cleanOperatorName("Acme HVAC | LinkedIn", "https://acmehvac.com")).toBe("Acme HVAC");
    expect(cleanOperatorName("Welcome to Acme HVAC", "https://acmehvac.com")).toBe("Acme HVAC");
  });

  it("falls back to the first segment when no domain signal exists (never invents)", () => {
    // domain shares nothing with either segment -> don't guess, return first.
    expect(cleanOperatorName("Roofing Company Houston, TX - Replacements & Repair", "https://roseroofing.com"))
      .toBe("Roofing Company Houston, TX");
  });

  it("handles missing url by returning the first segment", () => {
    expect(cleanOperatorName("Brand Name | Some SEO Tagline")).toBe("Brand Name");
  });

  it("collapses whitespace and truncates very long names", () => {
    expect(cleanOperatorName("   A   B   ", "https://x.com")).toBe("A B");
    expect(cleanOperatorName("x".repeat(200), "https://x.com").length).toBeLessThanOrEqual(80);
  });

  it("is safe on empty / junk input", () => {
    expect(cleanOperatorName("", "https://x.com")).toBe("");
    expect(cleanOperatorName("   ", "https://x.com")).toBe("");
  });
});
