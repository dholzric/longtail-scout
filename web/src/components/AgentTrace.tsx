import { useEffect, useRef } from "preact/hooks";

export interface TraceEntry {
  event: string;
  data: unknown;
  ts: number;
}

interface Props {
  entries: TraceEntry[];
  running: boolean;
}

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

  return (
    <div class="rounded-lg border border-slate-200 bg-slate-900 text-slate-100 shadow-sm">
      <div class="flex items-center justify-between border-b border-slate-700 px-4 py-2">
        <span class="text-xs font-medium uppercase tracking-wider text-slate-300">
          Agent trace {running && <span class="ml-2 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />}
        </span>
        <span class="text-xs text-slate-400">{entries.length} events</span>
      </div>
      <div ref={ref} class="h-72 overflow-auto px-4 py-2 font-mono text-xs">
        {entries.map((e, i) => (
          <div key={i} class="whitespace-pre-wrap">{summarize(e)}</div>
        ))}
      </div>
    </div>
  );
}
