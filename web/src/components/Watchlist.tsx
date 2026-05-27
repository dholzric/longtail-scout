import { useEffect, useState } from "preact/hooks";

interface Watch {
  id: string;
  query: string;
  created_at: number;
  last_run_at: number | null;
  last_count: number | null;
  last_op_urls: string[];
  last_demand_count?: number | null;
  previous_demand_count?: number | null;
  last_demand_check_at?: number | null;
  subscribers?: string[];
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
  const [subForm, setSubForm] = useState<{ watchId: string; email: string } | null>(null);
  const [subFeedback, setSubFeedback] = useState<{ watchId: string; msg: string; kind: "ok" | "err" } | null>(null);

  async function subscribe(watchId: string, email: string) {
    if (!demoKey) return;
    const res = await fetch(`/api/watchlist/${encodeURIComponent(watchId)}/subscribe`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${demoKey}` },
      body: JSON.stringify({ email })
    });
    if (res.ok) {
      setSubFeedback({ watchId, msg: `subscribed ${email}`, kind: "ok" });
      setSubForm(null);
      await refresh();
    } else {
      const txt = await res.text().catch(() => `HTTP ${res.status}`);
      setSubFeedback({ watchId, msg: `error: ${txt.slice(0, 60)}`, kind: "err" });
    }
    setTimeout(() => setSubFeedback(null), 3000);
  }

  async function unsubscribe(watchId: string, email: string) {
    if (!demoKey) return;
    await fetch(`/api/watchlist/${encodeURIComponent(watchId)}/subscribe?email=${encodeURIComponent(email)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${demoKey}` }
    });
    await refresh();
  }

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
        {watches.map(w => {
          const delta = (w.last_demand_count ?? null) !== null && (w.previous_demand_count ?? null) !== null
            ? (w.last_demand_count as number) - (w.previous_demand_count as number)
            : null;
          const subs = w.subscribers ?? [];
          const isOpen = subForm?.watchId === w.id;
          return (
            <div key={w.id} class="rounded border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50">
              <div class="flex items-center justify-between gap-2">
                <button class="text-left flex-1 min-w-0 truncate text-blue-700 hover:underline" onClick={() => onPickQuery(w.query)} title="Load this query into the form">
                  {w.query}
                </button>
                <div class="flex items-center gap-2 text-xs text-slate-500 whitespace-nowrap">
                  {delta !== null && delta > 0 && (
                    <span class="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 ring-1 ring-emerald-200" title={`Demand-API count rose by ${delta} since the previous daily cron refresh`}>
                      +{delta} new
                    </span>
                  )}
                  {delta !== null && delta === 0 && (
                    <span class="text-slate-400" title="No change in demand-API count since the previous daily refresh">flat</span>
                  )}
                  <span>last run {fmtRelative(w.last_run_at)}{w.last_count !== null && <> · {w.last_count} ops</>}</span>
                  {(w.last_demand_check_at ?? null) !== null && (
                    <span class="text-slate-400" title="Last time the daily cron refreshed the demand-API count for this watch">· demand checked {fmtRelative(w.last_demand_check_at ?? null)}</span>
                  )}
                  <button
                    class="rounded border border-sky-300 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-800 hover:bg-sky-100"
                    onClick={() => setSubForm(isOpen ? null : { watchId: w.id, email: "" })}
                    title="Subscribe to daily email digests when this watch has +N new operators"
                    type="button"
                  >
                    📧 {subs.length > 0 ? `${subs.length} subscribed` : "subscribe"}
                  </button>
                </div>
                <button class="rounded px-2 py-0.5 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => removeWatch(w.id)} title="Remove">×</button>
              </div>
              {isOpen && (
                <div class="mt-2 rounded bg-sky-50/50 border border-sky-200 px-3 py-2 text-xs space-y-2">
                  <div class="text-sky-900">Daily 13:00 UTC cron sends an email when this watch has new businesses in our index. Add an address:</div>
                  <form onSubmit={(e) => { e.preventDefault(); if (subForm) subscribe(w.id, subForm.email.trim().toLowerCase()); }} class="flex gap-2">
                    <input
                      type="email"
                      class="flex-1 rounded border border-sky-300 px-2 py-1 text-xs focus:outline-none focus:border-sky-500"
                      placeholder="you@example.com"
                      value={subForm?.email ?? ""}
                      onInput={(e) => setSubForm({ watchId: w.id, email: (e.target as HTMLInputElement).value })}
                      autoFocus
                    />
                    <button class="rounded bg-sky-700 px-3 py-1 text-xs text-white hover:bg-sky-800" type="submit">Add</button>
                  </form>
                  {subs.length > 0 && (
                    <div class="space-y-1">
                      <div class="text-sky-900/70 text-[10px] uppercase tracking-wide">Current subscribers</div>
                      {subs.map((email) => (
                        <div class="flex items-center gap-2">
                          <span class="text-slate-700">{email}</span>
                          <button class="text-rose-600 hover:underline text-[11px]" onClick={() => unsubscribe(w.id, email)} type="button">remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {subFeedback?.watchId === w.id && (
                    <div class={subFeedback.kind === "ok" ? "text-emerald-700" : "text-rose-700"}>{subFeedback.msg}</div>
                  )}
                  <div class="text-[10px] text-sky-900/60">Sent from <code>longtailscout@quiltmap.com</code> (display name "LongTail Scout"). Replace your existing watch's email here anytime — we don't double-send.</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </details>
  );
}
