import { useState, useEffect } from "preact/hooks";
import type { Operator } from "../types";

/**
 * "Act first" trigger-event feed (v1.5.0). Once a run completes, posts the operators to
 * /api/triggers and renders them re-ranked by buying-signal strength — open roles (esp.
 * growth/ops hires), recent expansion/funding/award headlines weighted by recency, and
 * multi-vertical presence. Answers the SDR's real question: who do I call first?
 */
interface TriggerResult {
  url: string;
  name: string;
  trigger_score: number;
  reasons: string[];
  primary_reason: string;
}

export function TriggerFeed({ operators, ready, demoKey }: { operators: Operator[]; ready: boolean; demoKey: string }) {
  const [triggers, setTriggers] = useState<TriggerResult[] | null>(null);
  const [loading, setLoading] = useState(false);

  const sig = operators.map((o) => o.url).join("|");
  useEffect(() => {
    if (!ready || operators.length === 0) return;
    let cancelled = false;
    setLoading(true);
    fetch("/api/triggers", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${demoKey}` },
      body: JSON.stringify({ operators })
    })
      .then((r) => r.json())
      .then((j: { triggers: TriggerResult[] }) => { if (!cancelled) setTriggers(j.triggers ?? []); })
      .catch(() => { if (!cancelled) setTriggers([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sig, ready]);

  if (!ready) return null;
  if (loading && !triggers) {
    return <div class="border border-ink-15 bg-paper-3 px-4 py-3 font-mono text-[11px] text-ink-50 animate-pulse">ranking trigger events…</div>;
  }
  if (!triggers || triggers.length === 0) return null;

  const top = triggers.slice(0, 5);
  return (
    <div class="border border-ink-20 bg-paper" data-section="trigger-feed">
      <div class="border-b border-ink-15 px-4 py-2.5 flex items-baseline justify-between gap-3 flex-wrap">
        <div class="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-70">⚡ Act first · trigger events</div>
        <div class="font-mono text-[10px] text-ink-50">{triggers.length} operator{triggers.length === 1 ? "" : "s"} with a live buying signal</div>
      </div>
      <ol class="m-0 p-0 list-none">
        {top.map((t, i) => (
          <li key={t.url} class={`px-4 py-2.5 ${i > 0 ? "border-t border-dashed border-ink-15" : ""}`}>
            <div class="flex items-center gap-3">
              <span class="font-serif text-lg font-semibold text-ink w-5 shrink-0">{i + 1}</span>
              <div class="flex-1 min-w-0">
                <a class="text-sm font-semibold text-ink hover:text-rust truncate" href={t.url} target="_blank" rel="noreferrer">{t.name}</a>
                <div class="text-xs text-ink-70 leading-snug">{t.primary_reason}</div>
              </div>
              <div class="shrink-0 w-28 text-right">
                <div class="font-mono text-[10px] text-ink-50 mb-0.5">signal {t.trigger_score}</div>
                <div class="h-1.5 bg-ink-10 rounded overflow-hidden">
                  <div class="h-full bg-rust" style={{ width: `${t.trigger_score}%` }} />
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <div class="border-t border-ink-15 px-4 py-2 font-mono text-[10px] text-ink-50">
        Scored from signals already scraped via Bright Data — open roles, recent activity, multi-vertical presence. No extra API spend.
      </div>
    </div>
  );
}
