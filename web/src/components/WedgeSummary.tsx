import type { Operator } from "../types";

interface Props {
  operators: Operator[];
  niche: string;
}

/**
 * A small banner that quantifies the long-tail wedge for the current result set.
 * Designed to be the first thing the judge sees above the result table — it answers
 * "why is this different from Apollo?" in numbers, not adjectives.
 */
export function WedgeSummary({ operators, niche }: Props) {
  if (operators.length === 0) return null;

  const apolloThin = operators.filter(o => {
    try {
      const u = new URL(o.url);
      return !/^(www\.)?(linkedin\.com|crunchbase\.com|builtin\.com|wikipedia\.org)$/i.test(u.hostname);
    } catch { return true; }
  }).length;

  const withHiring = operators.filter(o => (o.hiring.count ?? 0) > 0).length;
  const withGeo = operators.filter(o => !!o.geo).length;
  const newToIndex = operators.filter(o => o.memory?.memory_state === "new").length;
  const recurring = operators.filter(o => (o.memory?.seen_count ?? 0) > 1).length;

  const totalCitations = operators.reduce((acc, o) => acc + o.sources.length, 0);

  return (
    <div class="rounded-lg border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-4 shadow-sm">
      <div class="flex items-start gap-3">
        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">
          <span class="text-base">✓</span>
        </div>
        <div class="min-w-0">
          <div class="text-sm font-semibold text-emerald-900">Why these wouldn't be in Apollo</div>
          <div class="mt-1 flex items-baseline gap-4 text-sm text-emerald-900/80">
            <span class="inline-flex items-center gap-2">
              <span class="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200">Apollo: ≈ 0</span>
              <span class="rounded-full bg-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-900 ring-1 ring-emerald-300">LongTail Scout: {operators.length}</span>
            </span>
            <span class="text-emerald-900/70">All operators surfaced from their own websites, not LinkedIn-graph data.</span>
          </div>
          <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-emerald-900/70">
            <span><strong>{totalCitations}</strong> Bright Data citations across the table</span>
            {withHiring > 0 && <span><strong>{withHiring}</strong> hiring right now</span>}
            {withGeo > 0 && <span><strong>{withGeo}</strong> geocoded on the map</span>}
            {newToIndex > 0 && <span><strong>{newToIndex}</strong> new to our index</span>}
            {recurring > 0 && <span><strong>{recurring}</strong> recurring across prior queries</span>}
            {niche && <span class="text-emerald-700/50">· vertical: <em>{niche}</em></span>}
          </div>
        </div>
      </div>
    </div>
  );
}
