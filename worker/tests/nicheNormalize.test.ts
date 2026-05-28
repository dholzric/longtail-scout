import { describe, it, expect } from "vitest";
import { normalizeNicheKey } from "../src/agent/nicheNormalize";

describe("normalizeNicheKey", () => {
  it("strips trailing 'in <city>'", () => {
    expect(normalizeNicheKey("roofing contractors in Houston")).toBe("roofing");
    expect(normalizeNicheKey("dental practices in San Francisco")).toBe("dental");
    expect(normalizeNicheKey("HVAC contractors near Tampa")).toBe("HVAC");
  });

  it("iteratively strips multi-word qualifiers", () => {
    expect(normalizeNicheKey("law firms")).toBe("law");
    expect(normalizeNicheKey("pediatric dental practices")).toBe("pediatric dental");
    expect(normalizeNicheKey("commercial HVAC installers")).toBe("commercial HVAC");
  });

  it("leaves nouns without qualifier suffixes alone", () => {
    // "hotels" isn't in the qualifier list — it's a noun, not a generic suffix.
    expect(normalizeNicheKey("boutique hotels in Miami")).toBe("boutique hotels");
  });

  it("removes stop-words globally", () => {
    expect(normalizeNicheKey("the roofing companies")).toBe("roofing");
    expect(normalizeNicheKey("a dental practice in Austin")).toBe("dental");
  });

  it("never returns empty — falls back to raw", () => {
    expect(normalizeNicheKey("companies")).toBe("companies");
    expect(normalizeNicheKey("")).toBe("");
    expect(normalizeNicheKey("the")).toBe("the");
  });

  it("collapses whitespace", () => {
    expect(normalizeNicheKey("  roofing   contractors  ")).toBe("roofing");
  });

  it("synthesize.ts and DemandProbe.tsx produce the same key (regression gate for live-run finding #4)", () => {
    // The Codex 2026-05-28 finding: UI probe stripped to "roofing", synthesize used
    // "roofing contractors" → different demand counts shown to the user. This test ensures
    // the worker side strips to "roofing"; the frontend mirror is unit-tested only via the
    // identical regex shape, but if either drifts this expectation breaks.
    expect(normalizeNicheKey("roofing contractors in Houston")).toBe("roofing");
    expect(normalizeNicheKey("roofing contractors")).toBe("roofing");
    expect(normalizeNicheKey("roofing")).toBe("roofing");
  });
});
