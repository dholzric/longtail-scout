import { describe, it, expect } from "vitest";
import { buildDiscoveryPrompt, buildSynthesisPrompt } from "../src/agent/prompts";

describe("buildDiscoveryPrompt", () => {
  it("includes niche and city in user message", () => {
    const out = buildDiscoveryPrompt({ niche: "aerospace", city: "Houston", raw: "aerospace in Houston" });
    expect(out.user).toContain("aerospace");
    expect(out.user).toContain("Houston");
  });
  it("system instructs the model to diversify SERP queries", () => {
    const out = buildDiscoveryPrompt({ niche: "x", city: "y", raw: "..." });
    expect(out.system.toLowerCase()).toContain("serp");
    expect(out.system.toLowerCase()).toContain("diverse");
  });
});

describe("buildSynthesisPrompt", () => {
  it("forbids inventing facts", () => {
    const out = buildSynthesisPrompt({ niche: "x", city: "y", raw: "..." }, []);
    expect(out.system.toLowerCase()).toContain("never invent");
  });
});
