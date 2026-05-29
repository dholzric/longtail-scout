/**
 * Tests for the decision-maker classifier (v1.7.0).
 *
 * Completes the loop: find the company → prove it's Apollo-blind → find the inbox → find the
 * PERSON. A `"<company>" (owner OR founder …) site:linkedin.com/in` search through Bright Data
 * surfaces the operator's decision-maker + their LinkedIn profile. This pure logic parses the
 * /in/ results, validates they belong to THIS company, and ranks owner/founder roles first.
 */
import { describe, it, expect } from "vitest";
import { isLinkedInPersonUrl, parseLinkedInPersonTitle, classifyPeopleResults } from "../src/agent/decisionMaker";

const r = (title: string, link: string, snippet = "") => ({ title, link, snippet, position: 1 });

describe("isLinkedInPersonUrl", () => {
  it("matches /in/ profiles only", () => {
    expect(isLinkedInPersonUrl("https://www.linkedin.com/in/bob-smith-12345")).toBe(true);
    expect(isLinkedInPersonUrl("https://uk.linkedin.com/in/jane")).toBe(true);
    expect(isLinkedInPersonUrl("https://www.linkedin.com/company/acme")).toBe(false);
    expect(isLinkedInPersonUrl("https://acme.com/team")).toBe(false);
    expect(isLinkedInPersonUrl("nope")).toBe(false);
  });
});

describe("parseLinkedInPersonTitle", () => {
  it("splits 'Name - Role - Company | LinkedIn'", () => {
    expect(parseLinkedInPersonTitle("Bob Smith - Owner - Acme Roofing | LinkedIn"))
      .toEqual({ name: "Bob Smith", role: "Owner" });
  });
  it("handles en/em dashes and a missing role", () => {
    expect(parseLinkedInPersonTitle("Jane Doe – Founder & CEO – Acme | LinkedIn").role).toMatch(/Founder/);
    expect(parseLinkedInPersonTitle("Sam Lee | LinkedIn")).toEqual({ name: "Sam Lee", role: null });
  });
});

describe("classifyPeopleResults", () => {
  it("returns a person with their profile URL when the company matches", () => {
    const people = classifyPeopleResults("Acme Roofing", [
      r("Bob Smith - Owner - Acme Roofing | LinkedIn", "https://www.linkedin.com/in/bob-smith", "Owner at Acme Roofing in Houston."),
    ]);
    expect(people).toHaveLength(1);
    expect(people[0]!.name).toBe("Bob Smith");
    expect(people[0]!.title).toMatch(/Owner/);
    expect(people[0]!.profile_url).toContain("linkedin.com/in/bob-smith");
  });

  it("ranks decision-maker roles (Owner/Founder/CEO) ahead of rank-and-file", () => {
    const people = classifyPeopleResults("Acme Roofing", [
      r("Tom Junior - Sales Rep - Acme Roofing | LinkedIn", "https://www.linkedin.com/in/tom"),
      r("Bob Smith - Founder - Acme Roofing | LinkedIn", "https://www.linkedin.com/in/bob"),
    ]);
    expect(people[0]!.name).toBe("Bob Smith");
  });

  it("drops /in/ profiles that don't reference the company (random namesakes)", () => {
    const people = classifyPeopleResults("Acme Roofing", [
      r("Bob Smith - Dentist - Smile Co | LinkedIn", "https://www.linkedin.com/in/bob-dds", "Dentist."),
    ]);
    expect(people).toHaveLength(0);
  });

  it("matches via a known contact name even if the company isn't in the title", () => {
    const people = classifyPeopleResults("Acme Roofing", [
      r("Bob Smith - General Manager | LinkedIn", "https://www.linkedin.com/in/bob", "Houston."),
    ], "Bob Smith");
    expect(people).toHaveLength(1);
    expect(people[0]!.name).toBe("Bob Smith");
  });

  it("ignores company pages and non-person results", () => {
    const people = classifyPeopleResults("Acme Roofing", [
      r("Acme Roofing | LinkedIn", "https://www.linkedin.com/company/acme-roofing"),
      r("Acme Roofing - Home", "https://acmeroofing.com"),
    ]);
    expect(people).toHaveLength(0);
  });

  it("dedupes the same person and caps the list", () => {
    const dupes = Array.from({ length: 12 }, (_, i) => r("Bob Smith - Owner - Acme Roofing | LinkedIn", `https://www.linkedin.com/in/bob-${i}`, "Acme Roofing"));
    const people = classifyPeopleResults("Acme Roofing", dupes);
    expect(people).toHaveLength(1);
  });

  it("rejects titles that aren't plausible person names", () => {
    const people = classifyPeopleResults("Acme Roofing", [
      r("acme roofing houston tx - Acme Roofing | LinkedIn", "https://www.linkedin.com/in/acme"),
    ]);
    expect(people).toHaveLength(0);
  });
});
