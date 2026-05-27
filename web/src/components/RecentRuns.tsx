import { useEffect, useState } from "preact/hooks";

interface RecentRun {
  query: string;
  niche: string;
  city: string;
  operator_count: number;
  apollo_thin: number;
  hiring: number;
  total_usd: number;
  ts: number;
  share_url: string;
}

/**
 * Compact strip under the Hero showing the last ~10 completed scouts as social-proof.
 * Click a card → loads that query with auto-run. Hides itself when there are no runs yet.
 */
export function RecentRuns({ onPickQuery }: { onPickQuery: (q: string) => void }) {
  const [runs, setRuns] = useState<RecentRun[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/recent-runs")
      .then(r => r.ok ? r.json() : null)
      .then((j: { runs?: RecentRun[] } | null) => {
        if (cancelled || !j?.runs) return;
        setRuns(j.runs);
      })
      .catch(() => { /* hide silently */ });
    return () => { cancelled = true; };
  }, []);

  if (runs.length === 0) return null;

  return (
    <section>
      <div class="flex items-center justify-between mb-3">
        <div class="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-60">
          recent runs · last {runs.length}
        </div>
        <span class="font-mono text-[10px] uppercase tracking-wider text-ink-50">
          click to re-run
        </span>
      </div>
      <div class="flex gap-2 overflow-x-auto pb-2">
        {runs.map((r) => (
          <button
            key={`${r.query}-${r.ts}`}
            class="shrink-0 border border-ink-15 bg-paper-2 hover:bg-paper-3 hover:border-ink-25 transition px-3 py-2 text-left min-w-[200px]"
            onClick={() => onPickQuery(r.query)}
            title={`Last run ${fmtRelative(r.ts)} · $${r.total_usd.toFixed(4)} total cost`}
            type="button"
          >
            <div class="font-serif text-sm font-semibold text-ink truncate" title={r.query}>{r.query}</div>
            <div class="mt-1.5 flex items-baseline gap-2 font-mono text-[10px] uppercase tracking-wider">
              <span class="text-moss-dk">{r.operator_count} ops</span>
              {r.hiring > 0 && <span class="text-ink-50">· {r.hiring} hiring</span>}
              <span class="text-ink-40 ml-auto">{fmtRelative(r.ts)}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function fmtRelative(ts: number): string {
  const secs = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}
