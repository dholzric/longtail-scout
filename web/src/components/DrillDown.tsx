import type { Operator } from "../types";

export function DrillDown({ op }: { op: Operator }) {
  return (
    <div class="rounded border border-slate-200 bg-slate-50 p-4">
      <h3 class="text-lg font-semibold">{op.name}</h3>
      <p class="text-sm text-slate-600">{op.about ?? "—"}</p>
      {op.icp_fit_reason && (
        <p class="mt-2 text-sm"><span class="text-xs font-medium uppercase text-slate-500">ICP fit:</span> {op.icp_fit_reason}</p>
      )}
      <div class="mt-3 grid grid-cols-2 gap-4 text-sm">
        <div>
          <div class="text-xs font-medium uppercase text-slate-500">Hiring</div>
          {op.hiring.source ? (
            <a class="text-blue-700 underline" href={op.hiring.source} target="_blank">
              {op.hiring.count ?? 0} role-signals: {op.hiring.roles.join(", ") || "—"}
            </a>
          ) : <span class="text-slate-400">No signal</span>}
        </div>
        <div>
          <div class="text-xs font-medium uppercase text-slate-500">Location</div>
          {op.geo ? <span>{op.geo.lat.toFixed(4)}, {op.geo.lng.toFixed(4)}{op.geo.display_name ? ` · ${op.geo.display_name.slice(0, 60)}` : ""}</span> : <span class="text-slate-400">—</span>}
        </div>
      </div>
      <div class="mt-3">
        <div class="text-xs font-medium uppercase text-slate-500">Recent activity</div>
        <ul class="mt-1 space-y-1 text-sm">
          {op.recent_activity.length === 0 && <li class="text-slate-400">—</li>}
          {op.recent_activity.map((a, i) => (
            <li key={i}><a class="text-blue-700 underline" href={a.source} target="_blank">{a.headline}</a></li>
          ))}
        </ul>
      </div>
      <div class="mt-3">
        <div class="text-xs font-medium uppercase text-slate-500">Sources used</div>
        <ul class="mt-1 space-y-1 text-xs text-slate-600">
          {op.sources.map((s, i) => (
            <li key={i}>
              <span class="inline-block w-32 text-slate-500">{s.field}</span>
              <a class="text-blue-700 underline" href={s.url} target="_blank">{s.tool}</a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
