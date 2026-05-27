import { useEffect, useRef, useMemo } from "preact/hooks";
import { SectionHeader } from "./SectionHeader";

export interface TraceEntry {
  event: string;
  data: unknown;
  ts: number;
}

interface Props {
  entries: TraceEntry[];
  running: boolean;
}

type Phase = "discovery" | "enrichment" | "synthesis";
const PHASE_ORDER: Phase[] = ["discovery", "enrichment", "synthesis"];
const PHASE_LABEL: Record<Phase, string> = {
  discovery: "Discovery",
  enrichment: "Enrichment",
  synthesis: "Synthesis"
};
const PHASE_BLURB: Record<Phase, string> = {
  discovery: "Bright Data SERPs — 3-4 parallel queries",
  enrichment: "Per-candidate homepage + careers + news",
  synthesis: "Rank + ICP fit + sales angle, with citations"
};
/** Color top-stripe per phase, matching the editorial palette. */
const PHASE_STRIPE: Record<Phase, string> = {
  discovery: "var(--ochre-dk)",
  enrichment: "var(--rust)",
  synthesis: "var(--moss)"
};

function summarize(entry: TraceEntry): string {
  const d = entry.data as Record<string, unknown>;
  switch (entry.event) {
    case "phase": return `▶ ${d.phase} — phase begins`;
    case "progress": return `· ${d.message}`;
    case "tool": return `→ bridge.${d.tool}(${JSON.stringify(d.args).slice(0, 80)})`;
    case "candidate": return `+ candidate: ${d.name}`;
    case "enrich": return `  ${d.status === "ok" ? "✓" : "✗"} ${d.name} — ${d.field}${d.pattern ? ` [${d.pattern}]` : ""}`;
    case "operator": return `  ranked: ${(d as { name?: string }).name ?? "—"}`;
    case "cost": return `· cost — BD $${((d as any).bd_usd ?? 0).toFixed(4)} · LLM $${((d as any).llm_usd ?? 0).toFixed(4)} · total $${((d as any).total_usd ?? 0).toFixed(4)}`;
    case "done": return `✓ complete — stream closed`;
    case "error": return `✗ error — ${(d as { message?: string }).message ?? "unknown"}`;
    default: return `[${entry.event}] ${JSON.stringify(d).slice(0, 100)}`;
  }
}

/** Color the trace line by event type — matches the new design's terminal styling. */
function lineColor(ev: string): string {
  switch (ev) {
    case "phase": return "var(--ochre-bright)";
    case "tool": return "color-mix(in oklab, var(--paper) 90%, transparent)";
    case "enrich": return "var(--moss-bright)";
    case "operator": return "var(--moss-bright)";
    case "done": return "var(--moss-bright)";
    case "error": return "var(--rust-bright)";
    case "cost": return "color-mix(in oklab, var(--paper) 70%, transparent)";
    default: return "color-mix(in oklab, var(--paper) 55%, transparent)";
  }
}

export function AgentTrace({ entries, running }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [entries.length]);

  const currentPhase: Phase | null = useMemo(() => {
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i]?.event === "phase") {
        const p = (entries[i]?.data as { phase?: string } | undefined)?.phase;
        if (p === "discovery" || p === "enrichment" || p === "synthesis") return p;
      }
    }
    return null;
  }, [entries]);

  // Approx elapsed seconds from first entry ts to last (or "live" if running)
  const elapsed = entries.length > 1
    ? ((entries[entries.length - 1]!.ts - entries[0]!.ts) / 1000).toFixed(1)
    : null;

  return (
    <section>
      <SectionHeader
        number="02"
        kicker="agent trace, live"
        title="What the scout actually did — step by step."
        lede="Three phases, streamed via SSE. Discovery proposes; enrichment renders & extracts; synthesis ranks. Every tool call costs real money; the meter at the top of the page tallies it."
        action={
          <div class="font-mono text-[11px] text-ink-60 flex items-center gap-1.5">
            <span>⚡</span>
            <span>{entries.length} events{elapsed ? ` · ${elapsed}s` : ""}</span>
          </div>
        }
      />

      {/* Phase strip — colored top-stripes */}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        {PHASE_ORDER.map((p, i) => {
          const phaseIdx = currentPhase ? PHASE_ORDER.indexOf(currentPhase) : -1;
          const isDone = phaseIdx > i || (phaseIdx === i && !running);
          const isActive = currentPhase === p && running;
          return (
            <div key={p} class="border border-ink-20 bg-paper-2 px-4 py-3 relative overflow-hidden">
              <span class="absolute top-0 left-0 h-[3px] w-full" style={{ background: PHASE_STRIPE[p] }} />
              <div class="flex items-baseline justify-between mb-1.5">
                <div class="flex items-center gap-2">
                  <span class="font-mono text-[10px] font-bold" style={{ color: PHASE_STRIPE[p] }}>0{i + 1}</span>
                  <span class="font-serif text-base font-semibold text-ink">{PHASE_LABEL[p]}</span>
                </div>
                <span class={`inline-flex items-center px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${isDone ? "bg-moss-tint text-moss-dk" : isActive ? "bg-ochre-tint text-ochre-dk animate-pulse" : "bg-paper-3 text-ink-50"}`}>
                  {isDone ? "complete ✓" : isActive ? "live" : "queued"}
                </span>
              </div>
              <div class="text-xs text-ink-60 leading-snug">{PHASE_BLURB[p]}</div>
            </div>
          );
        })}
      </div>

      {/* Trace terminal */}
      <div class="border border-ink-20 font-mono text-xs" style={{ background: "var(--ink-deep)", color: "var(--paper)" }}>
        <div class="flex items-center justify-between px-4 py-2.5 border-b font-mono text-[10px] uppercase tracking-[0.14em]" style={{ borderColor: "color-mix(in oklab, var(--paper) 12%, transparent)", color: "color-mix(in oklab, var(--paper) 50%, transparent)" }}>
          <span>POST /api/scout — server-sent events</span>
          <span class="inline-flex items-center gap-1.5">
            <span class="inline-block h-1.5 w-1.5 rounded-full" style={{ background: running ? "var(--ochre-bright)" : "var(--moss-bright)", boxShadow: `0 0 8px ${running ? "var(--ochre-bright)" : "var(--moss-bright)"}` }} />
            {running ? "streaming" : "stream complete"}
          </span>
        </div>
        <div ref={ref} class="px-4 py-3 overflow-auto" style={{ maxHeight: 320, lineHeight: 1.7 }}>
          {entries.length === 0 && (
            <div style={{ color: "color-mix(in oklab, var(--paper) 40%, transparent)" }}>waiting for stream…</div>
          )}
          {entries.map((e, i) => {
            const ts = entries[0] ? `${((e.ts - entries[0]!.ts) / 1000).toFixed(1).padStart(5, "0")}s` : "0.0s";
            return (
              <div key={i} class="flex gap-3.5" style={{ color: lineColor(e.event) }}>
                <span class="shrink-0" style={{ color: "color-mix(in oklab, var(--paper) 30%, transparent)" }}>{ts}</span>
                <span class="whitespace-pre-wrap">{summarize(e)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
