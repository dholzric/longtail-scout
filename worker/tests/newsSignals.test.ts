/**
 * Tests for the signal-radar news classifier (v1.6.0).
 *
 * The "Act first" feed scores buying signals from data scraped during the run. Signal Radar goes
 * further: a live `"<name>" (funding OR expansion OR award …)` search THROUGH Bright Data surfaces
 * fresh THIRD-PARTY news (funding, new locations, leadership changes, awards) — the timeliest
 * possible buying trigger, with a citation. This pure logic classifies the SERP results.
 */
import { describe, it, expect } from "vitest";
import { classifyNewsResults } from "../src/agent/newsSignals";

const r = (title: string, link: string, snippet = "") => ({ title, link, snippet, position: 1 });

describe("classifyNewsResults", () => {
  it("categorizes a funding headline and keeps the citation", () => {
    const sigs = classifyNewsResults("Amstill Roofing", [
      r("Amstill Roofing raises $5M Series A", "https://bizjournal.com/amstill-funding", "The Houston roofer raised growth capital."),
    ]);
    expect(sigs).toHaveLength(1);
    expect(sigs[0]!.category).toBe("funding");
    expect(sigs[0]!.url).toContain("bizjournal.com");
    expect(sigs[0]!.source_host).toBe("bizjournal.com");
  });

  it("detects expansion, leadership, award, and launch categories", () => {
    const sigs = classifyNewsResults("Acme HVAC", [
      r("Acme HVAC opens new Dallas location", "https://news1.com/a"),
      r("Acme HVAC names Jane Doe as new CEO", "https://news2.com/b"),
      r("Acme HVAC wins Best of Dallas 2026 award", "https://news3.com/c"),
      r("Acme HVAC launches new maintenance plan", "https://news4.com/d"),
    ]);
    const cats = sigs.map(s => s.category);
    expect(cats).toContain("expansion");
    expect(cats).toContain("leadership");
    expect(cats).toContain("award");
    expect(cats).toContain("launch");
  });

  it("drops results that don't mention the operator", () => {
    const sigs = classifyNewsResults("Acme HVAC", [
      r("Globex Industries raises $20M", "https://news.com/globex", "Unrelated company."),
    ]);
    expect(sigs).toHaveLength(0);
  });

  it("excludes the operator's own domain (we want third-party validation)", () => {
    const sigs = classifyNewsResults("Acme HVAC", [
      r("Acme HVAC announces expansion", "https://acmehvac.com/news", ""),
      r("Acme HVAC announces expansion", "https://dallasnews.com/acme", ""),
    ], "acmehvac.com");
    expect(sigs).toHaveLength(1);
    expect(sigs[0]!.source_host).toBe("dallasnews.com");
  });

  it("excludes social/aggregator hosts", () => {
    const sigs = classifyNewsResults("Acme HVAC", [
      r("Acme HVAC expands to Austin", "https://facebook.com/acme", ""),
      r("Acme HVAC expands to Austin", "https://yelp.com/biz/acme", ""),
    ]);
    expect(sigs).toHaveLength(0);
  });

  it("dedupes near-identical headlines and caps the count", () => {
    const many = Array.from({ length: 20 }, (_, i) => r("Acme HVAC opens new location", `https://news${i}.com/x`));
    const sigs = classifyNewsResults("Acme HVAC", many);
    expect(sigs.length).toBeLessThanOrEqual(8);
    expect(sigs.length).toBeGreaterThanOrEqual(1);
  });

  it("falls back to 'press' for a name-matched headline with no category keyword", () => {
    const sigs = classifyNewsResults("Acme HVAC", [r("Acme HVAC featured in local spotlight", "https://news.com/x")]);
    expect(sigs[0]!.category).toBe("press");
  });
});
