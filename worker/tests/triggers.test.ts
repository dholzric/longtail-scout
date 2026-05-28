/**
 * Tests for the trigger-event scorer (v1.5.0).
 *
 * "Who should an SDR call FIRST?" Rank a run's operators by buying-signal strength using the
 * evidence we already scraped: open roles (esp. growth/ops hires), recent expansion/funding/
 * award headlines (weighted by recency), and multi-vertical presence. Pure + deterministic
 * (recency uses an injected `now`), so the live feed and the MCP tool share one implementation.
 */
import { describe, it, expect } from "vitest";
import { scoreTriggers } from "../src/agent/triggers";
import type { Operator } from "../src/types";

const NOW = 1_716_000_000_000; // fixed clock for deterministic recency
const recentDate = new Date(NOW - 10 * 86400_000).toISOString().slice(0, 10); // ~10 days ago
const oldDate = new Date(NOW - 400 * 86400_000).toISOString().slice(0, 10); // >1y ago

function op(over: Partial<Operator>): Operator {
  return {
    name: "Op", url: "https://op.example.com", sources: [], about: null, size_estimate: null,
    hiring: { count: null, roles: [], source: null }, recent_activity: [], demand_signal: null,
    icp_fit_reason: "", sales_angle: "", rank: 1, geo: null, memory: null, confidence: 50,
    ...over
  };
}

describe("scoreTriggers", () => {
  it("ranks a hiring + recent-expansion operator above a quiet one", () => {
    const hot = op({ name: "Hot", url: "https://hot.com", hiring: { count: 3, roles: ["Estimator", "Operations Manager"], source: "https://hot.com/careers" },
      recent_activity: [{ headline: "Hot Roofing opens new Dallas location", date: recentDate, source: "https://news.com/hot" }] });
    const quiet = op({ name: "Quiet", url: "https://quiet.com" });
    const ranked = scoreTriggers([quiet, hot], NOW);
    expect(ranked[0]!.name).toBe("Hot");
    expect(ranked[0]!.trigger_score).toBeGreaterThan(0);
  });

  it("excludes operators with no signal at all", () => {
    const ranked = scoreTriggers([op({ name: "Quiet", url: "https://quiet.com" })], NOW);
    expect(ranked.find(r => r.name === "Quiet")).toBeUndefined();
  });

  it("surfaces an expansion headline as the primary reason", () => {
    const ranked = scoreTriggers([op({ url: "https://x.com",
      recent_activity: [{ headline: "Acme acquires rival, expands to three states", date: recentDate, source: "https://n.com/a" }] })], NOW);
    expect(ranked[0]!.primary_reason.toLowerCase()).toMatch(/expan|acqui|growth|recent/);
  });

  it("weights a growth-role hire (Estimator) into the reasons", () => {
    const ranked = scoreTriggers([op({ url: "https://y.com", hiring: { count: 2, roles: ["Estimator"], source: null } })], NOW);
    expect(ranked[0]!.reasons.join(" ")).toMatch(/role|hir/i);
    expect(ranked[0]!.trigger_score).toBeGreaterThan(0);
  });

  it("discounts a stale headline vs a fresh one", () => {
    const fresh = op({ name: "Fresh", url: "https://fresh.com", recent_activity: [{ headline: "Launches new service line", date: recentDate, source: "https://n/1" }] });
    const stale = op({ name: "Stale", url: "https://stale.com", recent_activity: [{ headline: "Launches new service line", date: oldDate, source: "https://n/2" }] });
    const ranked = scoreTriggers([stale, fresh], NOW);
    const f = ranked.find(r => r.name === "Fresh")!;
    const s = ranked.find(r => r.name === "Stale");
    expect(f).toBeDefined();
    // Stale may still register but must rank strictly below fresh.
    if (s) expect(f.trigger_score).toBeGreaterThan(s.trigger_score);
  });

  it("clamps the score to 0-100", () => {
    const monster = op({ url: "https://m.com",
      hiring: { count: 20, roles: ["Estimator", "Operations Manager", "Director of Sales", "Recruiter"], source: "x" },
      recent_activity: Array.from({ length: 6 }, (_, i) => ({ headline: `Raised Series B, expands, wins award #${i}`, date: recentDate, source: `https://n/${i}` })),
      memory: { memory_state: "new", first_seen_ts: NOW, seen_count: 1, cross_niche: ["a", "b", "c"] } });
    expect(scoreTriggers([monster], NOW)[0]!.trigger_score).toBeLessThanOrEqual(100);
  });
});
