/**
 * Tests for the account-brief Markdown builder (v1.4.0).
 *
 * One-click takeaway artifact: a clean Markdown one-pager an SDR can paste into Notion / a CRM
 * note / an email. Bundles the operator's evidence, signals, the latest discovered contacts +
 * LinkedIn verdict, and a draft email — every claim still traceable to its Bright Data source.
 */
import { describe, it, expect } from "vitest";
import { buildAccountBrief } from "../src/agent/accountBrief";
import type { Operator } from "../src/types";

const OP: Operator = {
  name: "Acme Roofing LLC",
  url: "https://acme-roofing.com",
  sources: [
    { field: "homepage", tool: "bright_data_render", url: "https://acme-roofing.com" },
    { field: "hiring", tool: "careers_page:greenhouse", url: "https://acme-roofing.com/careers" }
  ],
  about: "Houston commercial roofing contractor since 1998.",
  size_estimate: "11-50",
  hiring: { count: 3, roles: ["Foreman", "Estimator"], source: "https://acme-roofing.com/careers" },
  recent_activity: [{ headline: "Acme wins downtown contract", date: "2026-05-01", source: "https://news.example.com/acme" }],
  demand_signal: null,
  icp_fit_reason: "Mid-size roofer with an ATS — a fit for AccuLynx.",
  sales_angle: "You're hiring estimators — AccuLynx cuts quote turnaround in half.",
  rank: 1,
  geo: null,
  memory: null,
  confidence: 82,
  city: "Houston",
  tech_stack: ["Greenhouse ATS", "WordPress"]
};

describe("buildAccountBrief", () => {
  it("produces a Markdown doc with the operator name as the H1 and the key sections", () => {
    const md = buildAccountBrief(OP);
    expect(md).toMatch(/^# Acme Roofing LLC/m);
    expect(md).toContain("acme-roofing.com");
    expect(md).toContain("## Why they fit");
    expect(md).toContain("Mid-size roofer");
    expect(md).toContain("## Outreach angle");
    expect(md).toContain("## Signals");
    expect(md).toContain("## Sources");
  });

  it("renders hiring + recent-activity + tech-stack signals with sources", () => {
    const md = buildAccountBrief(OP);
    expect(md).toContain("3 open role");
    expect(md).toContain("Foreman");
    expect(md).toContain("Acme wins downtown contract");
    expect(md).toContain("Greenhouse ATS");
    expect(md).toContain("acme-roofing.com/careers");
  });

  it("includes the LinkedIn-absence verdict when provided", () => {
    const md = buildAccountBrief(OP, { linkedin: { on_linkedin: false, evidence_url: null } });
    expect(md).toMatch(/Not on LinkedIn.*Bright Data/i);
  });

  it("notes a present LinkedIn page (and its URL) honestly", () => {
    const md = buildAccountBrief(OP, { linkedin: { on_linkedin: true, evidence_url: "https://linkedin.com/company/acme" } });
    expect(md).toMatch(/on LinkedIn/i);
    expect(md).toContain("linkedin.com/company/acme");
  });

  it("renders discovered contacts (email/phone/person) when provided", () => {
    const md = buildAccountBrief(OP, {
      contacts: { emails: [{ email: "sales@acme-roofing.com", same_domain: true }], phone: "(713) 555-0100", contact: { name: "Bob Smith", role: "Owner" } }
    });
    expect(md).toContain("sales@acme-roofing.com");
    expect(md).toContain("(713) 555-0100");
    expect(md).toContain("Bob Smith");
  });

  it("includes a draft email section when provided", () => {
    const md = buildAccountBrief(OP, { email: { subject: "Quick question on estimators", body: "Hi Acme team,\n\n..." } });
    expect(md).toContain("## Draft email");
    expect(md).toContain("Quick question on estimators");
  });

  it("is robust to a sparse operator (no hiring/activity/tech)", () => {
    const sparse: Operator = { ...OP, hiring: { count: null, roles: [], source: null }, recent_activity: [], tech_stack: [], about: null };
    const md = buildAccountBrief(sparse);
    expect(md).toContain("# Acme Roofing LLC");
    expect(md).not.toContain("undefined");
  });
});
