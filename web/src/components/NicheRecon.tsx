import { useState } from "preact/hooks";

interface NicheRow {
  niche: string;
  demand_count: number;
  saturated?: boolean;
  thinness_pct: number;
  sample_cities: { city: string; count: number }[];
  sample_operators: { name: string; city: string | null; website: string | null }[];
  suggested_query: string;
  score: number;
}

interface Props {
  demoKey: string;
  disabled?: boolean;
  /** Called with the suggested query when the user clicks "scout this" — wires into App's run(). */
  onPickQuery: (q: string) => void;
}

const STORAGE_KEY = "lts_niche_recon_desc";

/** Reverse-niche finder: paste your product description, get the top 5 long-tail verticals to hunt.
 *  This is the demo moment Apollo physically can't pull off — they don't have a 7M-record demand
 *  index keyed by niche, so they can't tell you which adjacent verticals share your ICP shape. */
export function NicheRecon({ demoKey, disabled, onPickQuery }: Props) {
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState<string>(() => {
    try { return localStorage.getItem(STORAGE_KEY) ?? ""; } catch { return ""; }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<NicheRow[] | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);

  async function run() {
    const d = desc.trim();
    if (d.length < 10) { setError("describe your product (10+ chars)"); return; }
    try { localStorage.setItem(STORAGE_KEY, d); } catch { /* ignore */ }
    setLoading(true);
    setError(null);
    setResults(null);
    setElapsed(null);
    const t0 = performance.now();
    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (demoKey) headers.authorization = `Bearer ${demoKey}`;
      const r = await fetch("/api/niche-recon", {
        method: "POST",
        headers,
        body: JSON.stringify({ product_description: d })
      });
      if (r.status === 401) {
        setError("demo password required — set it in the main query box first.");
        return;
      }
      if (!r.ok) {
        setError(`HTTP ${r.status}`);
        return;
      }
      const j = await r.json() as { niches?: NicheRow[]; error?: string };
      if (j.error) { setError(j.error); return; }
      setResults(j.niches ?? []);
      setElapsed(performance.now() - t0);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <div class="flex items-center justify-between gap-3 flex-wrap font-mono text-[11px] text-ink-60">
        <button
          type="button"
          class="inline-flex items-center gap-2 border border-ink-20 bg-paper-2 px-3 py-1.5 hover:bg-ink hover:text-paper hover:border-ink transition"
          onClick={() => setOpen(true)}
          title="Reverse the funnel: paste what you sell, get the niches your demand-index says you should be hunting in."
        >
          <span class="text-ochre-dk">🧭</span>
          <span class="uppercase tracking-[0.12em]">don't know your niche?</span>
          <span class="text-ink-80 normal-case tracking-normal">get recon</span>
          <span aria-hidden="true">→</span>
        </button>
        <span class="text-ink-40 hidden sm:inline">paste your product → top 5 long-tail verticals ranked by Apollo-thinness</span>
      </div>
    );
  }

  return (
    <div class="border border-ochre/40 bg-paper p-5">
      <div class="flex items-start justify-between gap-3 mb-3">
        <div>
          <div class="font-mono text-[10px] uppercase tracking-[0.14em] text-ochre-dk">recon · reverse niche finder</div>
          <h2 class="font-serif text-xl font-semibold text-ink leading-tight mt-0.5">Describe your product. Get the top long-tail niches to hunt.</h2>
        </div>
        <button class="font-mono text-[10px] text-ink-50 hover:text-ink" onClick={() => setOpen(false)} type="button" aria-label="Close recon">close ✕</button>
      </div>
      <p class="text-xs text-ink-70 mb-3 max-w-2xl">
        An LLM maps your product onto ~10 candidate verticals, then we cross-reference each against the 7M-business demand index. We rank by <em>density × Apollo-thinness</em> — niches with high business counts AND low website coverage are the long-tail you can own before Apollo catches up.
      </p>
      <div class="flex items-stretch gap-2 flex-col md:flex-row">
        <textarea
          class="flex-1 border border-ink-25 bg-paper-2 px-3 py-2 font-sans text-sm text-ink focus:border-ochre-dk focus:outline-none resize-none"
          rows={2}
          placeholder="e.g. 'I sell field-service scheduling software to contractor crews — quotes, dispatch, mobile job sheets, QuickBooks sync.'"
          value={desc}
          onInput={(e) => setDesc((e.target as HTMLTextAreaElement).value)}
          disabled={loading || disabled}
        />
        <button
          type="button"
          class="bg-ink text-paper border-0 px-5 py-3 font-mono text-xs font-semibold uppercase tracking-[0.12em] cursor-pointer disabled:bg-ink-40 whitespace-nowrap"
          onClick={run}
          disabled={loading || disabled}
        >
          {loading ? "thinking…" : "find niches →"}
        </button>
      </div>
      {error && <div class="mt-3 text-xs text-rust-dk font-mono">⚠ {error}</div>}
      {!error && results && results.length === 0 && !loading && (
        <div class="mt-3 text-xs text-ink-60 font-mono">no strong matches — try a more specific product description.</div>
      )}
      {results && results.length > 0 && (
        <div class="mt-5">
          <div class="flex items-baseline justify-between gap-2 mb-2">
            <div class="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50">top {results.length} niches · ranked by long-tail density × Apollo-thinness</div>
            {elapsed != null && <div class="font-mono text-[10px] text-ink-40">{(elapsed / 1000).toFixed(1)}s</div>}
          </div>
          <div class="space-y-2">
            {results.map((r, i) => (
              <div class="border border-ink-15 bg-paper-2 p-3 flex items-start gap-4">
                <div class="font-serif text-2xl font-semibold text-rust w-8 text-right tabular-nums">{i + 1}</div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-3 flex-wrap">
                    <span class="font-serif text-base font-semibold text-ink">{r.niche}</span>
                    <span class="font-mono text-[11px] text-ink-60">
                      {r.demand_count.toLocaleString()}{r.saturated ? "+" : ""} businesses
                    </span>
                    <span
                      class="font-mono text-[11px] text-moss-dk"
                      title="Share of sampled businesses without a usable website. Apollo enriches via domain match — no domain ≈ Apollo can't see them."
                    >
                      {Math.round(r.thinness_pct * 100)}% Apollo-thin
                    </span>
                  </div>
                  {r.sample_cities.length > 0 && (
                    <div class="font-mono text-[10px] text-ink-50 mt-1">
                      top cities: {r.sample_cities.map(c => `${c.city} (${c.count})`).join(" · ")}
                    </div>
                  )}
                  {r.sample_operators.length > 0 && (
                    <div class="text-xs text-ink-70 mt-1.5 truncate" title={r.sample_operators.map(o => o.name).join(", ")}>
                      sample: {r.sample_operators.map(o => o.name).filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  class="bg-paper border border-ink-25 text-ink-80 hover:bg-ink hover:text-paper hover:border-ink px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] whitespace-nowrap transition"
                  onClick={() => { onPickQuery(r.suggested_query); setOpen(false); }}
                  title={`Pre-fill the scout query with "${r.suggested_query}"`}
                >
                  scout this →
                </button>
              </div>
            ))}
          </div>
          <div class="mt-3 font-mono text-[10px] text-ink-40">
            scoring: log₁₀(business_count) × thinness_pct × long-tail multiplier (penalizes &gt;100k mainstream verticals)
          </div>
        </div>
      )}
    </div>
  );
}
