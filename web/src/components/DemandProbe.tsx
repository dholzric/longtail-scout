import { useEffect, useState } from "preact/hooks";

interface Props {
  query: string;
  /** Optional callback fired with the resolved count (or null on miss/error). Lets the Hero
   * surface the same number as a stamp without doing its own fetch. */
  onCount?: (count: number | null) => void;
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
export function DemandProbe({ query, onCount }: Props) {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errored, setErrored] = useState<boolean>(false);

  useEffect(() => {
    const niche = parseNiche(query);
    if (!niche || niche.length < 3 || niche.length > 80) {
      setCount(null);
      onCount?.(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErrored(false);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/demand-research?q=${encodeURIComponent(niche)}`);
        if (!res.ok) { if (!cancelled) { setErrored(true); onCount?.(null); } return; }
        const j = await res.json() as ResearchResponse;
        const c = typeof j.demand === "number" ? j.demand : null;
        if (!cancelled) { setCount(c); onCount?.(c); }
      } catch {
        if (!cancelled) { setErrored(true); onCount?.(null); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 500); // debounce
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  if (errored) return null;
  if (count === null && !loading) return null;
  return (
    <div class="flex items-center gap-2 px-3 py-1.5 font-mono text-[11px] text-ink-70">
      <span class={`inline-block h-2 w-2 rounded-full bg-moss ${loading ? "animate-pulse" : ""}`} />
      {loading || count === null ? (
        <span class="text-ink-50">probing demand index for matching businesses…</span>
      ) : (
        <span>
          <span class="font-semibold text-ink">{count.toLocaleString()}</span>
          <span class="text-ink-50 ml-1.5">businesses in our private 7M-record demand index match this niche</span>
        </span>
      )}
    </div>
  );
}
