import { useState, useEffect } from "preact/hooks";
import type { Operator } from "../types";
import { OperatorNotes } from "./OperatorNotes";

const SHOT_KEY = "lts_demo_key";

/**
 * Lazy homepage screenshot via BD Browser API (worker proxies + caches in KV for 30d).
 * Only rendered when the user expands the drill-down, so we never pay per-operator on scout.
 */
function HomepageShot({ url }: { url: string }) {
  const [loaded, setLoaded] = useState<boolean>(false);
  const [errored, setErrored] = useState<boolean>(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setErrored(false);
    const key = (typeof localStorage !== "undefined" ? localStorage.getItem(SHOT_KEY) : null) ?? "";
    if (!key) { setErrored(true); return; }
    const src = `/api/screenshot?url=${encodeURIComponent(url)}&w=1024&h=640&key=${encodeURIComponent(key)}`;
    if (!cancelled) setImageSrc(src);
    return () => { cancelled = true; };
  }, [url]);

  if (errored) return null; // hide silently rather than show error UI in the drill-down
  return (
    <div class="mt-3 overflow-hidden rounded border border-slate-200 bg-slate-100">
      <div class="flex items-center justify-between px-3 py-1.5 text-xs">
        <span class="text-slate-500">Homepage snapshot <span class="text-slate-400">· captured live via Bright Data Browser API</span></span>
        {loaded && <span class="text-slate-400">cached 30d</span>}
        {!loaded && <span class="text-slate-400 animate-pulse">rendering…</span>}
      </div>
      {imageSrc && (
        <img
          src={imageSrc}
          alt={`Homepage screenshot of ${url}`}
          class={`w-full transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          style="aspect-ratio: 1024/640; background:#f1f5f9"
        />
      )}
    </div>
  );
}

function buildOutreachEmail(op: Operator): { subject: string; body: string } {
  const subject = `Quick question for ${op.name}`;
  const lines: string[] = [];
  lines.push(`Hi ${op.name} team,`);
  lines.push("");
  lines.push(op.sales_angle);
  if (op.hiring.count && op.hiring.count > 0) {
    lines.push("");
    lines.push(`Noticed you're hiring ${op.hiring.roles.slice(0, 3).join(", ")} roles right now — feels like a moment where this tool would compound.`);
  }
  lines.push("");
  lines.push("Worth a 15-minute call this week?");
  lines.push("");
  lines.push("Best,");
  lines.push("<your name>");
  return { subject, body: lines.join("\n") };
}

async function copyText(s: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(s); return true; } catch { return false; }
}

export function DrillDown({ op }: { op: Operator }) {
  const [copied, setCopied] = useState<string>("");

  async function flash(label: string, text: string) {
    if (await copyText(text)) {
      setCopied(label);
      setTimeout(() => setCopied(""), 1500);
    }
  }

  const email = buildOutreachEmail(op);

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

      <div class="mt-4 rounded border border-slate-200 bg-white p-3">
        <div class="flex items-center justify-between mb-2">
          <div class="text-xs font-medium uppercase text-slate-500">Outreach kit — draft email</div>
          <div class="flex gap-1">
            <button class="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50" onClick={() => flash("subject", email.subject)}>
              {copied === "subject" ? "✓ Subject" : "Copy subject"}
            </button>
            <button class="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50" onClick={() => flash("body", email.body)}>
              {copied === "body" ? "✓ Body" : "Copy body"}
            </button>
            <a class="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50" href={`mailto:?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`}>
              Open in mail
            </a>
          </div>
        </div>
        <div class="text-xs text-slate-700">
          <div class="font-mono"><strong>Subject:</strong> {email.subject}</div>
          <pre class="mt-1 whitespace-pre-wrap font-sans text-slate-800">{email.body}</pre>
        </div>
      </div>

      {op.memory && op.memory.cross_niche && op.memory.cross_niche.length > 0 && (
        <div class="mt-3 rounded border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
          <div class="text-xs font-medium uppercase text-indigo-700 mb-1">Cross-niche signal</div>
          This operator also appeared under: {op.memory.cross_niche.map((q, i) => (
            <span key={i} class="ml-1 inline-block rounded-full bg-white px-2 py-0.5 text-xs ring-1 ring-indigo-200">{q}</span>
          ))}
          <div class="mt-1 text-xs text-indigo-700/80">Multi-vertical operators are often the highest-LTV accounts — they buy multiple SaaS tools.</div>
        </div>
      )}

      <HomepageShot url={op.url} />

      <OperatorNotes opUrl={op.url} />

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
