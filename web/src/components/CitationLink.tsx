import type { Citation } from "../types";

export function CitationLink({ citations, field }: { citations: Citation[]; field: string }) {
  const match = citations.find(c => c.field === field);
  if (!match) return null;
  return (
    <a class="ml-1 text-slate-400 hover:text-slate-700" href={match.url} target="_blank" title={`source: ${match.tool}`}>
      ⁽ⁱ⁾
    </a>
  );
}
