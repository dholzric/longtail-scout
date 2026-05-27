import { useEffect, useState } from "preact/hooks";

interface Watch {
  id: string;
  query: string;
  created_at: number;
  last_run_at: number | null;
  last_count: number | null;
  last_op_urls: string[];
}

interface Props {
  demoKey: string;
  currentQuery: string;
  onPickQuery: (q: string) => void;
}

function fmtRelative(ts: number | null): string {
  if (!ts) return "never";
  const secs = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export function Watchlist({ demoKey, currentQuery, onPickQuery }: Props) {
  const [watches, setWatches] = useState<Watch[]>([]);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    if (!demoKey) return;
    setLoading(true);
    try {
      const res = await fetch("/api/watchlist", {
        headers: { authorization: `Bearer ${demoKey}` }
      });
      if (res.ok) {
        const data = await res.json() as { watches: Watch[] };
        setWatches(data.watches);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [demoKey]);
  // Periodic refresh — picks up last_run_at updates after scout completions.
  useEffect(() => {
    if (!demoKey) return;
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoKey]);

  async function addCurrent() {
    if (!currentQuery.trim() || !demoKey) return;
    const res = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${demoKey}` },
      body: JSON.stringify({ query: currentQuery.trim() })
    });
    if (res.ok) await refresh();
  }

  async function removeWatch(id: string) {
    if (!demoKey) return;
    await fetch(`/api/watchlist/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${demoKey}` }
    });
    await refresh();
  }

  if (!demoKey) return null;

  return (
    <details class="rounded-lg border border-slate-200 bg-white shadow-sm">
      <summary class="cursor-pointer px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
        📌 Watchlist ({watches.length}) — saved queries with new-vs-seen tracking
      </summary>
      <div class="border-t border-slate-200 px-6 py-3 space-y-2">
        <div class="flex items-center gap-2 text-xs">
          <button
            class="rounded border border-slate-300 px-3 py-1 hover:bg-slate-50 disabled:opacity-50"
            onClick={addCurrent}
            disabled={!currentQuery.trim()}
            title="Save current query to the watchlist"
          >
            + Watch "{currentQuery.slice(0, 40)}{currentQuery.length > 40 ? "…" : ""}"
          </button>
          <button class="text-slate-400 hover:text-slate-700" onClick={refresh} disabled={loading}>
            {loading ? "refreshing…" : "refresh"}
          </button>
        </div>
        {watches.length === 0 && <div class="text-xs text-slate-500 italic">No watches yet — save the current query above to start tracking.</div>}
        {watches.map(w => (
          <div key={w.id} class="flex items-center justify-between gap-2 rounded border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50">
            <button class="text-left flex-1 min-w-0 truncate text-blue-700 hover:underline" onClick={() => onPickQuery(w.query)} title="Load this query into the form">
              {w.query}
            </button>
            <span class="text-xs text-slate-500 whitespace-nowrap">last run {fmtRelative(w.last_run_at)}{w.last_count !== null && <> · {w.last_count} ops</>}</span>
            <button class="rounded px-2 py-0.5 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => removeWatch(w.id)} title="Remove">×</button>
          </div>
        ))}
      </div>
    </details>
  );
}
