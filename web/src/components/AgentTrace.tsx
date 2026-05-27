import { useEffect, useRef, useMemo } from "preact/hooks";

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
  discovery: "LLM proposes candidate operators via Bright Data SERPs",
  enrichment: "Per-candidate homepage renders → hiring signals + geocode",
  synthesis: "LLM ranks + writes ICP fit / sales angle, applies cross-niche memory"
};

function summarize(entry: TraceEntry): string {
  const d = entry.data as Record<string, unknown>;
  switch (entry.event) {
    case "phase": return `▶ Phase: ${d.phase}`;
    case "progress": return `· ${d.message}`;
    case "tool": return `→ Tool: ${d.tool}(${JSON.stringify(d.args).slice(0, 80)})`;
    case "candidate": return `+ Candidate: ${d.name}`;
    case "enrich": return `  ${d.status === "ok" ? "✓" : "✗"} ${d.name} — ${d.field}`;
    default: return `[${entry.event}] ${JSON.stringify(d).slice(0, 100)}`;
  }
}

export function AgentTrace({ entries, running }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [entries.length]);

  // Track the most recent phase event from the SSE stream.
  const currentPhase: Phase | null = useMemo(() => {
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i]?.event === "phase") {
        const p = (entries[i]?.data as { phase?: string } | undefined)?.phase;
        if (p === "discovery" || p === "enrichment" || p === "synthesis") return p;
      }
    }
    return null;
  }, [entries]);

  return (
    <div class="rounded-lg border border-slate-200 bg-slate-900 text-slate-100 shadow-sm">
      <div class="flex items-center justify-between border-b border-slate-700 px-4 py-2">
        <span class="text-xs font-medium uppercase tracking-wider text-slate-300">
          Agent trace {running && <span class="ml-2 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />}
        </span>
        <span class="text-xs text-slate-400">{entries.length} events</span>
      </div>
      <div class="flex flex-wrap items-stretch gap-2 border-b border-slate-700 px-4 py-3">
        {PHASE_ORDER.map((p, i) => {
          const phaseIdx = currentPhase ? PHASE_ORDER.indexOf(currentPhase) : -1;
          const isDone = phaseIdx > i;
          const isActive = currentPhase === p && running;
          const isPending = phaseIdx < i;
          return (
            <div key={p} class={`flex-1 min-w-[12rem] rounded border px-3 py-2 transition ${
              isActive ? "border-emerald-400 bg-emerald-500/10" :
              isDone ? "border-slate-600 bg-slate-800/60 text-slate-400" :
              "border-slate-700 bg-slate-800/30 text-slate-500"
            }`}>
              <div class="flex items-center gap-2 text-xs font-medium">
                <span class={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                  isActive ? "bg-emerald-500 text-white" :
                  isDone ? "bg-slate-700 text-slate-300" :
                  "bg-slate-700 text-slate-500"
                }`}>{isDone ? "✓" : i + 1}</span>
                <span class={isActive ? "text-emerald-300" : isDone ? "text-slate-300" : ""}>{PHASE_LABEL[p]}</span>
                {isActive && <span class="ml-auto text-[10px] uppercase text-emerald-400 animate-pulse">live</span>}
                {isPending && !isActive && <span class="ml-auto text-[10px] uppercase text-slate-600">queued</span>}
              </div>
              <div class="mt-1 text-[10px] leading-snug text-slate-500">{PHASE_BLURB[p]}</div>
            </div>
          );
        })}
      </div>
      <div ref={ref} class="h-72 overflow-auto px-4 py-2 font-mono text-xs">
        {entries.map((e, i) => (
          <div key={i} class="whitespace-pre-wrap">{summarize(e)}</div>
        ))}
      </div>
    </div>
  );
}
