import { useEffect, useState } from "preact/hooks";

interface Props {
  query: string;
}

interface ResearchResponse {
  query: string;
  demand: number;
}

// Strip trailing common qualifier words ("contractors", "firms", "centers", …) so the
// demand probe matches against the core noun ("roofing", "law", "childcare") which is
// how the index is keyworded — and produces the impressive total ("82,200 businesses"
// vs the much narrower "roofing contractors" exact-phrase count).
const TRAILING_QUALIFIERS = /\s+(contractors?|firms?|practices?|services?|centers?|shops?|businesses?|companies?|providers?|specialists?|professionals?|technicians?|installers?|locations?|stores?|studios?|salons?|offices?)$/i;

function parseNiche(q: string): string {
  let inputPart = q.trim();
  const m = inputPart.match(/^\s*(.+?)\s+(?:in|near|around|@)\s+(.+?)\s*$/i);
  if (m && m[1]) inputPart = m[1].trim();
  // Strip trailing qualifier(s) — iteratively in case of multi-word ("law firms" → "law")
  let prev = "";
  while (prev !== inputPart) {
    prev = inputPart;
    inputPart = inputPart.replace(TRAILING_QUALIFIERS, "").trim();
  }
  return inputPart;
}

/**
 * Small live badge under the query form that probes the demand-API for the typed niche
 * and shows the matching business count. Debounced so we don't fire on every keystroke.
 *
 * The point: prove the 7M-record corpus exists and is reachable in <500ms, not as a
 * preprocessed snapshot. Sells the moat — Apollo doesn't have this signal.
 */
export function DemandProbe({ query }: Props) {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errored, setErrored] = useState<boolean>(false);

  useEffect(() => {
    const niche = parseNiche(query);
    if (!niche || niche.length < 3 || niche.length > 80) {
      setCount(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErrored(false);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/demand-research?q=${encodeURIComponent(niche)}`);
        if (!res.ok) { if (!cancelled) setErrored(true); return; }
        const j = await res.json() as ResearchResponse;
        if (!cancelled) setCount(typeof j.demand === "number" ? j.demand : null);
      } catch {
        if (!cancelled) setErrored(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 500); // debounce
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  if (errored) return null;
  if (count === null && !loading) return null;
  return (
    <div class="flex items-center gap-2 rounded border border-cyan-200 bg-cyan-50/50 px-3 py-1.5 text-xs text-cyan-900">
      <span class={`inline-block h-2 w-2 rounded-full bg-cyan-500 ${loading ? "animate-pulse" : ""}`} />
      {loading || count === null ? (
        <span class="text-cyan-700">probing demand index for matching businesses…</span>
      ) : (
        <span>
          <strong>{count.toLocaleString()}</strong> businesses in our private demand index match this niche
          <span class="ml-1 text-cyan-700/60" title="Self-hosted FastAPI on top of a ~7M-record Google Maps scrape — the same backbone that powers the heat-map underlay on the map view.">· 7M-business corpus, lat/lng + rating + reviews</span>
        </span>
      )}
    </div>
  );
}
