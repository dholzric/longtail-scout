/**
 * Tests for homepage contact extraction (agent/contact.ts).
 *
 * Regression guard for the v1.7.0 live-test finding: a testimonial like "Was very professional …
 * Owner" was mis-captured as contact name "was very". The name extractor must reject common
 * English filler words and only accept plausible person names.
 */
import { describe, it, expect } from "vitest";
import { extractContactInfo } from "../src/agent/contact";

describe("extractContactInfo — person name", () => {
  it("rejects testimonial filler captured next to a role keyword", () => {
    const html = `<div class="review">Was very professional and on time. — a happy customer</div>
                  <p>Owner</p>`;
    expect(extractContactInfo(html).contact).toBeNull();
  });

  it("still extracts a real owner name", () => {
    const html = `<p>Owner: Bob Smith</p>`;
    const c = extractContactInfo(html).contact;
    expect(c).not.toBeNull();
    expect(c!.name).toBe("Bob Smith");
    expect(c!.role).toBe("Owner");
  });

  it("extracts 'Founded by <Name>'", () => {
    const c = extractContactInfo(`<p>Founded by Jane Doe in 1998.</p>`).contact;
    expect(c!.name).toBe("Jane Doe");
  });

  it("rejects a single token and over-long phrases", () => {
    expect(extractContactInfo(`<p>Owner: Bob</p>`).contact).toBeNull();
    expect(extractContactInfo(`<p>Owner: Great Quality Service Today</p>`).contact).toBeNull();
  });

  it("still parses a phone number", () => {
    expect(extractContactInfo(`<a href="tel:+17134307374">call</a>`).phone).toBe("(713) 430-7374");
  });
});
