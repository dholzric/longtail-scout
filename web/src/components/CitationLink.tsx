import type { Citation } from "../types";

/**
 * Small superscript "⁽ⁱ⁾" anchor linking to a citation source. Hover renders the snippet
 * (when present) in the browser's native title tooltip — quick and good-enough proof that the
 * upstream fact came from a real fetched page, not the LLM's imagination.
 */
export function CitationLink({ citations, field }: { citations: Citation[]; field: string }) {
  const match = citations.find(c => c.field === field);
  if (!match) return null;
  const title = match.snippet
    ? `${match.tool}\n\n"${match.snippet}"`
    : `source: ${match.tool}`;
  return (
    <a class="ml-1 text-ink-50 hover:text-rust" href={match.url} target="_blank" rel="noreferrer" title={title}>
      ⁽ⁱ⁾
    </a>
  );
}
