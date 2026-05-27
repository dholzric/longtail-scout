import { useState } from "preact/hooks";
import type { Operator } from "../types";
import { CitationLink } from "./CitationLink";
import { DrillDown } from "./DrillDown";

export function ResultTable({ operators }: { operators: Operator[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div class="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div class="border-b border-slate-200 px-6 py-3">
        <h2 class="text-base font-semibold">Results — {operators.length} operators</h2>
      </div>
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th class="px-4 py-2 text-left">#</th>
            <th class="px-4 py-2 text-left">Operator</th>
            <th class="px-4 py-2 text-left">Size</th>
            <th class="px-4 py-2 text-left">Hiring</th>
            <th class="px-4 py-2 text-left">Sales angle</th>
          </tr>
        </thead>
        <tbody>
          {operators.map(op => (
            <>
              <tr key={op.url} class="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => setOpen(open === op.url ? null : op.url)}>
                <td class="px-4 py-3 align-top text-slate-500">{op.rank}</td>
                <td class="px-4 py-3 align-top">
                  <div class="font-medium">{op.name}</div>
                  <a class="text-xs text-blue-700 underline" href={op.url} target="_blank" onClick={(e) => e.stopPropagation()}>{op.url}</a>
                </td>
                <td class="px-4 py-3 align-top text-slate-700">{op.size_estimate ?? "—"}<CitationLink citations={op.sources} field="about" /></td>
                <td class="px-4 py-3 align-top text-slate-700">
                  {op.hiring.count ? <>{op.hiring.count} roles<CitationLink citations={op.sources} field="hiring" /></> : <span class="text-slate-400">—</span>}
                </td>
                <td class="px-4 py-3 align-top text-slate-800">{op.sales_angle}</td>
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
