import { useState } from "preact/hooks";
import type { Operator } from "../types";
import { CitationLink } from "./CitationLink";
import { DrillDown } from "./DrillDown";

function operatorIsWebFirst(op: Operator): boolean {
  // Heuristic: rank-eligible operators we surfaced from their own website are the ones Apollo's LinkedIn-graph misses.
  // We mark them "web-first" — i.e. their primary signal is their own site, not LinkedIn.
  try {
    const u = new URL(op.url);
    if (/^(www\.)?linkedin\.com|crunchbase\.com|builtin\.com|wikipedia\.org$/i.test(u.hostname)) return false;
  } catch { /* fall through */ }
  return true;
}

function escapeCsv(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function operatorsToCsv(ops: Operator[]): string {
  const headers = ["rank", "confidence", "name", "url", "size_estimate", "hiring_count", "hiring_roles", "icp_fit_reason", "draft_outreach_angle", "recent_activity"];
  const lines = [headers.join(",")];
  for (const op of ops) {
    lines.push([
      op.rank,
      op.confidence,
      op.name,
      op.url,
      op.size_estimate ?? "",
      op.hiring.count ?? "",
      op.hiring.roles.join("; "),
      op.icp_fit_reason,
      op.sales_angle,
      op.recent_activity.map(r => r.headline).join(" | ")
    ].map(escapeCsv).join(","));
  }
  return lines.join("\n");
}

function downloadCsv(ops: Operator[], filename: string) {
  const blob = new Blob([operatorsToCsv(ops)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function copyCsv(ops: Operator[]) {
  try {
    await navigator.clipboard.writeText(operatorsToCsv(ops));
    return true;
  } catch { return false; }
}

type SortKey = "rank" | "confidence" | "name" | "hiring";

export function ResultTable({ operators }: { operators: Operator[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [minConfidence, setMinConfidence] = useState(0);
  const [hiringOnly, setHiringOnly] = useState(false);
  const [smallOnly, setSmallOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "rank" || key === "name" ? "asc" : "desc"); }
  }

  const filtered = operators.filter(op => {
    if (op.confidence < minConfidence) return false;
    if (hiringOnly && !(op.hiring.count && op.hiring.count > 0)) return false;
    if (smallOnly && (op.size_estimate === "100+" || op.size_estimate === "51-100")) return false;
    return true;
  });
  const visible = [...filtered].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "rank": return (a.rank - b.rank) * dir;
      case "confidence": return (a.confidence - b.confidence) * dir;
      case "name": return a.name.localeCompare(b.name) * dir;
      case "hiring": return ((a.hiring.count ?? 0) - (b.hiring.count ?? 0)) * dir;
    }
  });
  const arrow = (k: SortKey) => sortKey === k ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  return (
    <div class="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-3">
        <h2 class="text-base font-semibold">Results — {visible.length} of {operators.length} operators</h2>
        <div class="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <label class="flex items-center gap-2" title="Confidence is derived from citation count, data depth, and hostname-name match">
            <span class="text-slate-500">Min confidence:</span>
            <input type="range" min="0" max="100" step="5" value={minConfidence} onInput={(e) => setMinConfidence(parseInt((e.target as HTMLInputElement).value, 10))} class="w-24" />
            <span class="font-mono w-8 text-right">{minConfidence}</span>
          </label>
          <label class="flex items-center gap-1">
            <input type="checkbox" checked={hiringOnly} onChange={(e) => setHiringOnly((e.target as HTMLInputElement).checked)} />
            <span>Hiring only</span>
          </label>
          <label class="flex items-center gap-1" title="Hide operators marked 51-100 or 100+ employees">
            <input type="checkbox" checked={smallOnly} onChange={(e) => setSmallOnly((e.target as HTMLInputElement).checked)} />
            <span>Long-tail only</span>
          </label>
          <button
            class="rounded border border-slate-300 px-3 py-1 hover:bg-slate-50"
            onClick={async () => {
              const ok = await copyCsv(visible);
              if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1500); }
            }}
            title="Copy filtered CSV"
          >
            {copied ? "Copied ✓" : "Copy CSV"}
          </button>
          <button
            class="rounded border border-slate-300 bg-slate-900 px-3 py-1 text-white hover:bg-slate-700"
            onClick={() => downloadCsv(visible, "longtail-scout-export.csv")}
            title="Download filtered CSV"
          >
            Export CSV
          </button>
        </div>
      </div>
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase text-slate-500 select-none">
          <tr>
            <th class="px-4 py-2 text-left cursor-pointer hover:text-slate-900" onClick={() => toggleSort("rank")}>#{arrow("rank")}<span class="ml-1 text-[10px] normal-case opacity-50">conf{arrow("confidence")}</span></th>
            <th class="px-4 py-2 text-left cursor-pointer hover:text-slate-900" onClick={() => toggleSort("name")}>Operator{arrow("name")}</th>
            <th class="px-4 py-2 text-left">ICP fit</th>
            <th class="px-4 py-2 text-left cursor-pointer hover:text-slate-900" onClick={() => toggleSort("hiring")}>Hiring{arrow("hiring")}</th>
            <th class="px-4 py-2 text-left">Draft outreach angle</th>
          </tr>
        </thead>
        <tbody>
          {visible.map(op => (
            <>
              <tr key={op.url} class="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => setOpen(open === op.url ? null : op.url)}>
                <td class="px-4 py-3 align-top text-slate-500">
                  <div>{op.rank}</div>
                  <div class={`mt-1 text-[10px] font-medium ${op.confidence >= 70 ? "text-emerald-700" : op.confidence >= 40 ? "text-amber-700" : "text-slate-400"}`} title={`Confidence: ${op.confidence}/100 — derived from citation count, data depth, and hostname-name match. Not rank — rank is fit-for-query.`}>
                    {op.confidence}%
                  </div>
                </td>
                <td class="px-4 py-3 align-top">
                  <div class="flex items-center gap-2">
                    <span class="font-medium">{op.name}</span>
                    {operatorIsWebFirst(op) && (
                      <span class="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200" title="Apollo-thin: primary signal is operator's own website, not LinkedIn">
                        Apollo-thin
                      </span>
                    )}
                    {op.memory?.memory_state === "new" && (
                      <span class="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-blue-200" title="First time this URL has appeared in any LongTail Scout query">
                        New
                      </span>
                    )}
                    {op.memory && op.memory.seen_count > 1 && (
                      <span class="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200" title={`Seen across ${op.memory.seen_count} prior queries; first seen ${new Date(op.memory.first_seen_ts).toLocaleDateString()}`}>
                        Seen ×{op.memory.seen_count}
                      </span>
                    )}
                    {op.city && (
                      <span class="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-violet-200" title="City from multi-city expansion">
                        {op.city}
                      </span>
                    )}
                  </div>
                  <a class="text-xs text-blue-700 underline" href={op.url} target="_blank" onClick={(e) => e.stopPropagation()}>{op.url}</a>
                  {op.size_estimate && <span class="ml-2 text-xs text-slate-500">· {op.size_estimate}<CitationLink citations={op.sources} field="about" /></span>}
                </td>
                <td class="px-4 py-3 align-top text-slate-700 max-w-[16rem]">{op.icp_fit_reason || <span class="text-slate-400">—</span>}</td>
                <td class="px-4 py-3 align-top text-slate-700">
                  {op.hiring.count ? <>{op.hiring.count} signals<CitationLink citations={op.sources} field="hiring" /></> : <span class="text-slate-400">—</span>}
                </td>
                <td class="px-4 py-3 align-top text-slate-800">
                  <div class="text-xs text-slate-400 mb-1 uppercase tracking-wide">Draft — edit before sending</div>
                  {op.sales_angle}
                </td>
              </tr>
              {open === op.url && (
                <tr><td colSpan={5} class="px-4 pb-4"><DrillDown op={op} /></td></tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
