import { describe, it, expect } from "vitest";
import { dedupeCandidates, extractDomain } from "../src/agent/dedupe";

describe("extractDomain", () => {
  it("strips protocol, www, and trailing slash", () => {
    expect(extractDomain("https://www.foo.com/about")).toBe("foo.com");
    expect(extractDomain("http://Foo.com")).toBe("foo.com");
    expect(extractDomain("https://bar.foo.com/")).toBe("bar.foo.com");
  });
  it("returns lowercased input on parse failure", () => {
    expect(extractDomain("not a url")).toBe("not a url");
  });
});

describe("dedupeCandidates", () => {
  it("merges candidates that share a registrable domain", () => {
    const input = [
      { name: "Foo Aerospace", url: "https://www.fooaero.com/about", origin_query: "q1" },
      { name: "Foo Aerospace Inc", url: "https://fooaero.com/contact", origin_query: "q2" },
      { name: "Bar Avionics", url: "https://baravionics.com", origin_query: "q1" }
    ];
    const out = dedupeCandidates(input);
    expect(out).toHaveLength(2);
    expect(out.map(c => c.name).sort()).toEqual(["Bar Avionics", "Foo Aerospace"]);
  });
  it("filters out social media + aggregator domains", () => {
    const input = [
      { name: "Some LinkedIn page", url: "https://linkedin.com/in/somebody", origin_query: "q" },
      { name: "Crunchbase listing", url: "https://crunchbase.com/organization/x", origin_query: "q" },
      { name: "Real Co", url: "https://realco.com", origin_query: "q" }
    ];
    const out = dedupeCandidates(input);
    expect(out).toHaveLength(1);
    expect(out[0]?.name).toBe("Real Co");
  });
});
