import { describe, it, expect } from "vitest";
import { formatSseEvent } from "../src/stream";

describe("formatSseEvent", () => {
  it("formats event + JSON data with double-newline terminator", () => {
    const out = formatSseEvent("phase", { phase: "discovery" });
    expect(out).toBe('event: phase\ndata: {"phase":"discovery"}\n\n');
  });

  it("escapes newlines inside data values", () => {
    const out = formatSseEvent("progress", { message: "line1\nline2" });
    expect(out.split("\n\n").length).toBe(2);
    expect(out).toContain('"line1\\nline2"');
  });
});
