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
  const headers = ["rank", "name", "url", "size_estimate", "hiring_count", "hiring_roles", "icp_fit_reason", "draft_outreach_angle", "recent_activity"];
  const lines = [headers.join(",")];
  for (const op of ops) {
    lines.push([
      op.rank,
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

export function ResultTable({ operators }: { operators: Operator[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  return (
    <div class="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div class="flex items-center justify-between border-b border-slate-200 px-6 py-3">
        <h2 class="text-base font-semibold">Results — {operators.length} operators</h2>
        <div class="flex gap-2">
          <button
            class="rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50"
            onClick={async () => {
              const ok = await copyCsv(operators);
              if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1500); }
            }}
            title="Copy CSV to clipboard (paste into Apollo, HubSpot, Salesforce import)"
          >
            {copied ? "Copied ✓" : "Copy CSV"}
          </button>
          <button
            class="rounded border border-slate-300 bg-slate-900 px-3 py-1 text-xs text-white hover:bg-slate-700"
            onClick={() => downloadCsv(operators, "longtail-scout-export.csv")}
            title="Download as CSV"
          >
            Export CSV
          </button>
        </div>
      </div>
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th class="px-4 py-2 text-left">#</th>
            <th class="px-4 py-2 text-left">Operator</th>
            <th class="px-4 py-2 text-left">ICP fit</th>
            <th class="px-4 py-2 text-left">Hiring</th>
            <th class="px-4 py-2 text-left">Draft outreach angle</th>
          </tr>
        </thead>
        <tbody>
          {operators.map(op => (
            <>
              <tr key={op.url} class="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => setOpen(open === op.url ? null : op.url)}>
                <td class="px-4 py-3 align-top text-slate-500">{op.rank}</td>
                <td class="px-4 py-3 align-top">
                  <div class="flex items-center gap-2">
                    <span class="font-medium">{op.name}</span>
                    {operatorIsWebFirst(op) && (
                      <span class="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200" title="Apollo-thin: primary signal is operator's own website, not LinkedIn">
                        Apollo-thin
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
