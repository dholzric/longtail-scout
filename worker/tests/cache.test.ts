import { describe, it, expect } from "vitest";
import { cacheKey } from "../src/cache";

describe("cacheKey", () => {
  it("produces a stable hex hash for the same args", async () => {
    const a = await cacheKey("serp", { q: "aerospace Houston", num: 10 });
    const b = await cacheKey("serp", { q: "aerospace Houston", num: 10 });
    expect(a).toBe(b);
    expect(a).toMatch(/^tool:serp:[0-9a-f]{64}$/);
  });

  it("differs for different args", async () => {
    const a = await cacheKey("serp", { q: "aerospace Houston" });
    const b = await cacheKey("serp", { q: "aerospace Dallas" });
    expect(a).not.toBe(b);
  });

  it("normalizes object key order", async () => {
    const a = await cacheKey("serp", { q: "x", num: 5 });
    const b = await cacheKey("serp", { num: 5, q: "x" });
    expect(a).toBe(b);
  });
});
