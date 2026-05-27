import type { Operator } from "../types";

interface Props {
  operators: Operator[];
}

/**
 * Bar chart of operators-per-city. Only renders when the result set actually
 * spans multiple cities (the worker tags each operator with `op.city` when a
 * state-level query was expanded into multiple metros). For single-city queries
 * this returns null — no point showing a one-bar chart.
 */
export function CityBreakdown({ operators }: Props) {
  const counts = new Map<string, number>();
  for (const op of operators) {
    const c = op.city;
    if (!c) continue;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  if (counts.size < 2) return null; // single-city — let the WedgeSummary tell the story

  const rows = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const max = rows.length === 0 ? 1 : (rows[0]?.[1] ?? 1);

  return (
    <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div class="mb-3 flex items-baseline justify-between gap-2">
        <h3 class="text-sm font-semibold text-slate-900">Operators by city <span class="ml-1 text-xs font-normal text-slate-500">· state-level query expanded into {rows.length} metros</span></h3>
        <span class="text-xs text-slate-500">{operators.length} operators total</span>
      </div>
      <div class="space-y-1.5">
        {rows.map(([city, n]) => {
          const pct = (n / max) * 100;
          return (
            <div key={city} class="flex items-center gap-3 text-xs">
              <span class="w-24 shrink-0 truncate text-slate-700" title={city}>{city}</span>
              <div class="relative h-5 flex-1 rounded bg-slate-100">
                <div
                  class="absolute inset-y-0 left-0 rounded bg-gradient-to-r from-emerald-400 to-teal-500"
                  style={`width:${pct}%`}
                />
                <span class="absolute inset-y-0 right-2 flex items-center text-[11px] font-medium text-slate-700 mix-blend-multiply">{n}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
