import { useState, useEffect } from "preact/hooks";
import type { Operator } from "../types";
import { DrillDown } from "./DrillDown";
import { SectionHeader } from "./SectionHeader";

/**
 * Short, stable, URL-safe identifier for an operator. We hash the homepage URL via DJB2
 * (no crypto needed for non-security use) and base36-encode it. Used in the permalink
 * `?op=<id>` so a judge can share a deep-link to a specific row.
 */
function operatorPermalinkId(opUrl: string): string {
  let h = 5381;
  const s = opUrl.trim().toLowerCase().replace(/\/$/, "");
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

async function copyShareLink(op: Operator, query: string): Promise<boolean> {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("q", query);
    url.searchParams.set("run", "1");
    url.searchParams.set("op", operatorPermalinkId(op.url));
    url.searchParams.delete("key");
    await navigator.clipboard.writeText(url.toString());
    return true;
  } catch { return false; }
}

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

/** HubSpot Company import CSV — column names match HubSpot's expected import-wizard headers
 * exactly so the user can map them 1:1 without editing. */
function operatorsToHubspotCsv(ops: Operator[]): string {
  const headers = ["Company name", "Company domain name", "Website URL", "Description", "Number of employees", "Company owner", "Lifecycle stage", "Notes"];
  const lines = [headers.join(",")];
  for (const op of ops) {
    let domain = "";
    try { domain = new URL(op.url).hostname.replace(/^www\./, ""); } catch { /* skip */ }
    const employees = op.size_estimate === "1-10" ? "5" : op.size_estimate === "11-50" ? "30" : op.size_estimate === "51-100" ? "75" : op.size_estimate === "100+" ? "150" : "";
    const notes = [
      op.icp_fit_reason && `ICP fit: ${op.icp_fit_reason}`,
      op.sales_angle && `Angle: ${op.sales_angle}`,
      (op.hiring.count ?? 0) > 0 && `Hiring: ${op.hiring.roles.join(", ")} (${op.hiring.count})`,
      `Discovered via LongTail Scout · confidence ${op.confidence}/100 · rank ${op.rank}`
    ].filter(Boolean).join(" | ");
    lines.push([
      op.name,
      domain,
      op.url,
      op.about ?? "",
      employees,
      "",
      "lead",
      notes
    ].map(escapeCsv).join(","));
  }
  return lines.join("\n");
}

/** Salesforce Account import CSV — column names mirror Salesforce's Data Import Wizard
 * default Account import template. */
function operatorsToSalesforceCsv(ops: Operator[]): string {
  const headers = ["Name", "Website", "Description", "NumberOfEmployees", "Industry", "Type", "Rating", "Description__c"];
  const lines = [headers.join(",")];
  for (const op of ops) {
    const employees = op.size_estimate === "1-10" ? 5 : op.size_estimate === "11-50" ? 30 : op.size_estimate === "51-100" ? 75 : op.size_estimate === "100+" ? 150 : "";
    const rating = op.confidence >= 80 ? "Hot" : op.confidence >= 60 ? "Warm" : "Cold";
    const longDesc = [
      op.about,
      op.icp_fit_reason && `ICP: ${op.icp_fit_reason}`,
      op.sales_angle && `Angle: ${op.sales_angle}`,
      (op.hiring.count ?? 0) > 0 && `Hiring ${op.hiring.count} roles (${op.hiring.roles.join(", ")})`
    ].filter(Boolean).join(" || ");
    lines.push([
      op.name,
      op.url,
      op.about ?? "",
      employees,
      "Other",
      "Prospect",
      rating,
      longDesc
    ].map(escapeCsv).join(","));
  }
  return lines.join("\n");
}

function downloadCsv(ops: Operator[], filename: string) {
  downloadStringAsFile(operatorsToCsv(ops), filename);
}

function downloadStringAsFile(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
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

interface ResultTableProps {
  operators: Operator[];
  /** Permalink ID from `?op=` — auto-opens the matching row's drill-down on mount. */
  initialOpenId?: string | null;
  /** Current query (used to build per-row copy-link URLs). */
  query?: string;
}

export function ResultTable({ operators, initialOpenId, query }: ResultTableProps) {
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [linkCopiedUrl, setLinkCopiedUrl] = useState<string | null>(null);
  const [minConfidence, setMinConfidence] = useState(0);
  const [hiringOnly, setHiringOnly] = useState(false);
  const [smallOnly, setSmallOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // When operators stream in, match the URL ?op=<id> hash and auto-open that row.
  useEffect(() => {
    if (!initialOpenId || open) return;
    const match = operators.find(o => operatorPermalinkId(o.url) === initialOpenId);
    if (match) {
      setOpen(match.url);
      // Smooth-scroll to the row after layout settles.
      requestAnimationFrame(() => {
        const el = document.querySelector(`tr[data-op-id="${initialOpenId}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }, [operators, initialOpenId, open]);

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
    <section>
      <SectionHeader
        number="04"
        kicker="operators, ranked"
        title={`${visible.length === operators.length ? `${operators.length} specimens` : `${visible.length} of ${operators.length}`}. Each citation-linked.`}
        lede="Rank = fit for query. Confidence = how much we trust the row, derived from citation count + data depth + hostname-name match. Click any row to open the field card."
        action={
          <div class="flex flex-wrap gap-2 font-mono text-[11px]">
            <button
              class="border border-ink-25 bg-paper-2 px-3 py-1.5 uppercase tracking-wider text-ink-70 hover:bg-paper-3"
              onClick={async () => {
                const ok = await copyCsv(visible);
                if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1500); }
              }}
              title="Copy filtered CSV"
            >
              {copied ? "✓ copied" : "copy CSV"}
            </button>
            <button
              class="border border-ink-25 bg-paper-2 px-3 py-1.5 uppercase tracking-wider text-ink-70 hover:bg-paper-3"
              onClick={() => downloadStringAsFile(operatorsToHubspotCsv(visible), "longtail-scout-hubspot.csv")}
              title="Download in HubSpot Company import format — drop straight into HubSpot's import wizard"
            >
              HubSpot ↓
            </button>
            <button
              class="border border-ink-25 bg-paper-2 px-3 py-1.5 uppercase tracking-wider text-ink-70 hover:bg-paper-3"
              onClick={() => downloadStringAsFile(operatorsToSalesforceCsv(visible), "longtail-scout-salesforce.csv")}
              title="Download in Salesforce Account import format — Data Import Wizard friendly"
            >
              Salesforce ↓
            </button>
            <button
              class="bg-ink text-paper px-3 py-1.5 uppercase tracking-wider hover:bg-ink-90 inline-flex items-center gap-1.5"
              onClick={() => downloadCsv(visible, "longtail-scout-export.csv")}
              title="Download generic filtered CSV"
            >
              export CSV <span aria-hidden="true">→</span>
            </button>
          </div>
        }
      />

      {/* Filter strip */}
      <div class="flex flex-wrap items-center gap-5 mb-4 font-mono text-[11px] text-ink-70">
        <span class="uppercase tracking-[0.14em] text-ink-50">filters:</span>
        <label class="inline-flex items-center gap-2" title="Confidence is derived from citation count, data depth, and hostname-name match">
          <span>min conf</span>
          <input type="range" min={0} max={100} step={5} value={minConfidence} onInput={(e) => setMinConfidence(parseInt((e.target as HTMLInputElement).value, 10))} class="w-20" />
          <span class="w-7 text-right text-ink">{minConfidence}</span>
        </label>
        <label class="inline-flex items-center gap-1.5">
          <input type="checkbox" checked={hiringOnly} onChange={(e) => setHiringOnly((e.target as HTMLInputElement).checked)} />
          <span>hiring only</span>
        </label>
        <label class="inline-flex items-center gap-1.5" title="Hide operators marked 51-100 or 100+ employees">
          <input type="checkbox" checked={smallOnly} onChange={(e) => setSmallOnly((e.target as HTMLInputElement).checked)} />
          <span>long-tail (≤50 emp)</span>
        </label>
        <span class="ml-auto text-ink-50">showing {visible.length} of {operators.length}</span>
      </div>

      {/* Sort bar */}
      <div class="flex items-center gap-3 mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50">
        <span>sort:</span>
        {(["rank", "confidence", "name", "hiring"] as const).map((k) => (
          <button
            key={k}
            class={`px-2 py-0.5 ${sortKey === k ? "bg-ink text-paper" : "hover:text-ink"}`}
            onClick={() => toggleSort(k)}
          >
            {k}{arrow(k)}
          </button>
        ))}
      </div>

      {/* Magazine grid table */}
      <div class="border border-ink-20 bg-paper">
        {/* Header row — collapses to 2 cols (# + operator) on mobile; mobile stacks everything else inside the operator cell */}
        <div class="grid md:grid-cols-[60px_minmax(0,1fr)_200px_160px_minmax(0,1.3fr)_80px] grid-cols-[40px_minmax(0,1fr)] gap-0 border-b border-ink-20 bg-paper-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50 py-2.5">
          <div class="px-4">#</div>
          <div>operator · domain</div>
          <div class="hidden md:block">confidence</div>
          <div class="hidden md:block">hiring</div>
          <div class="hidden md:block">icp fit & sales angle</div>
          <div class="hidden md:block px-4 text-right">cites</div>
        </div>

        {visible.map((op, idx) => {
          const isOpen = open === op.url;
          const apolloThin = operatorIsWebFirst(op);
          const isNew = op.memory?.memory_state === "new";
          return (
            <div key={op.url} data-op-id={operatorPermalinkId(op.url)}>
              <div
                onClick={() => setOpen(isOpen ? null : op.url)}
                class={`grid md:grid-cols-[60px_minmax(0,1fr)_200px_160px_minmax(0,1.3fr)_80px] grid-cols-[40px_minmax(0,1fr)] gap-0 py-4 border-b border-ink-10 cursor-pointer transition-colors ${isOpen ? "bg-paper-3" : "hover:bg-paper-2"}`}
              >
                {/* # column */}
                <div class="px-4">
                  <div class="font-serif text-2xl font-semibold text-ink leading-none">{String(idx + 1).padStart(2, "0")}</div>
                  {isNew && (
                    <div class="mt-1 inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-rust">
                      <span class="inline-block h-1.5 w-1.5 rounded-full bg-rust" />new
                    </div>
                  )}
                </div>

                {/* Operator · domain */}
                <div class="min-w-0 pr-4">
                  <div class="flex flex-wrap items-baseline gap-2 mb-1">
                    <img
                      src={(() => { try { return `https://icons.duckduckgo.com/ip3/${new URL(op.url).hostname}.ico`; } catch { return ""; } })()}
                      alt=""
                      class="h-4 w-4 rounded-sm shrink-0 ring-1 ring-ink-15 self-center"
                      onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }}
                      loading="lazy"
                    />
                    <span class="font-serif text-base font-bold text-ink">{op.name}</span>
                    <a class="font-mono text-[11px] text-ink-50 hover:text-ink underline decoration-dotted" href={op.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{(() => { try { return new URL(op.url).hostname.replace(/^www\./, ""); } catch { return op.url; } })()}</a>
                    {apolloThin && (
                      <span class="inline-flex items-center bg-rust-tint text-rust-dk px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider" title="Apollo-thin: primary signal is operator's own website, not LinkedIn">
                        apollo-thin
                      </span>
                    )}
                    {isNew && (
                      <span class="inline-flex items-center bg-ochre-tint text-ochre-dk px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider" title="First time this URL has appeared in any LongTail Scout query">
                        new to index
                      </span>
                    )}
                    {op.memory && op.memory.seen_count > 1 && (
                      <span class="inline-flex items-center bg-paper-3 text-ink-60 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider" title={`Seen across ${op.memory.seen_count} prior queries`}>
                        seen ×{op.memory.seen_count}
                      </span>
                    )}
                    {op.city && (
                      <span class="inline-flex items-center bg-sky-tint text-ink-70 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider" title="City from multi-city expansion">
                        {op.city}
                      </span>
                    )}
                  </div>
                  {op.tech_stack && op.tech_stack.length > 0 && (
                    <div class="flex flex-wrap gap-1 mt-1.5">
                      {op.tech_stack.slice(0, 5).map((t) => (
                        <span key={t} class="inline-flex items-center bg-paper-3 text-ink-70 px-1.5 py-0.5 font-mono text-[10px] tracking-wider" title={`Detected on homepage: ${t}`}>
                          {t}
                        </span>
                      ))}
                      {op.tech_stack.length > 5 && (
                        <span class="inline-flex items-center text-ink-40 font-mono text-[10px]">+{op.tech_stack.length - 5} more</span>
                      )}
                    </div>
                  )}
                  {/* Mobile-only compact summary — the desktop columns are hidden on narrow viewports */}
                  <div class="md:hidden mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span class="font-mono"><span class="text-ink-50">conf</span> <span class={op.confidence >= 80 ? "text-moss-dk font-semibold" : op.confidence >= 60 ? "text-ochre-dk font-semibold" : "text-ink-60"}>{op.confidence}</span></span>
                    <span class="font-mono">
                      <span class="text-ink-50">hire</span>{" "}
                      {op.hiring.count ? <span class="text-moss-dk font-semibold">{op.hiring.count}</span> : <span class="text-ink-40">—</span>}
                    </span>
                    <span class="font-mono"><span class="text-ink-50">cites</span> <span class="text-ink">{op.sources.length}</span></span>
                  </div>
                  {op.icp_fit_reason && (
                    <div class="md:hidden mt-2 text-xs text-ink-80 leading-snug">
                      <span class="font-mono text-[9px] uppercase tracking-wider text-rust">icp fit · </span>{op.icp_fit_reason}
                    </div>
                  )}
                  {op.sales_angle && (
                    <div class="md:hidden mt-1 text-xs text-ink-80 leading-snug italic">"{op.sales_angle}"</div>
                  )}
                  <div class="font-mono text-[10px] uppercase tracking-wider text-ink-50 mt-2">
                    {op.size_estimate && <span>{op.size_estimate} emp · </span>}
                    rank #{op.rank}
                    <button
                      class="ml-2 text-ink-40 hover:text-ink underline decoration-dotted normal-case tracking-normal"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (await copyShareLink(op, query ?? "")) {
                          setLinkCopiedUrl(op.url);
                          setTimeout(() => setLinkCopiedUrl(null), 1500);
                        }
                      }}
                      title="Copy a share URL that opens this operator's drill-down"
                      type="button"
                    >
                      {linkCopiedUrl === op.url ? "✓ link copied" : "🔗 link"}
                    </button>
                  </div>
                </div>

                {/* Confidence — hidden on mobile, condensed inside operator cell below md */}
                <div class="hidden md:block pr-4">
                  <ConfidenceBar value={op.confidence} op={op} />
                </div>

                {/* Hiring */}
                <div class="hidden md:block pr-4">
                  {op.hiring.count ? (
                    <>
                      <div class="font-serif text-lg font-semibold text-ink">{op.hiring.count} <span class="text-sm font-normal text-ink-60">role{op.hiring.count > 1 ? "s" : ""}</span></div>
                      {op.hiring.roles.length > 0 && (
                        <div class="text-xs text-ink-60 truncate" title={op.hiring.roles.join(", ")}>{op.hiring.roles.slice(0, 3).join(", ")}</div>
                      )}
                      {op.hiring.source && (
                        <div class="font-mono text-[9px] uppercase tracking-wider text-ink-50 mt-0.5">via {hiringTool(op)}</div>
                      )}
                    </>
                  ) : (
                    <span class="text-ink-30">—</span>
                  )}
                </div>

                {/* ICP fit & sales angle */}
                <div class="hidden md:block pr-4 space-y-1.5">
                  <div>
                    <div class="font-mono text-[9px] uppercase tracking-wider text-rust">icp fit</div>
                    <div class="text-xs text-ink-80 leading-snug">{op.icp_fit_reason || "—"}</div>
                  </div>
                  {op.sales_angle && (
                    <div>
                      <div class="font-mono text-[9px] uppercase tracking-wider text-rust">draft outreach</div>
                      <div class="text-xs text-ink-80 leading-snug italic">"{op.sales_angle}"</div>
                    </div>
                  )}
                </div>

                {/* Cites */}
                <div class="hidden md:block px-4 text-right">
                  <div class="font-serif text-2xl font-semibold text-ink leading-none">{op.sources.length}</div>
                  <div class="font-mono text-[9px] uppercase tracking-wider text-ink-50 mt-1">fetches</div>
                </div>
              </div>
              {isOpen && (
                <div class="bg-paper-2 border-b border-ink-15 px-4 py-5">
                  <DrillDown op={op} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Vertical-tick confidence bar — 20 segments, color-graded by score, hover-explainer breakdown. */
function ConfidenceBar({ value, op }: { value: number; op: Operator }) {
  const ticks = 20;
  const filled = Math.round((value / 100) * ticks);
  const color = value >= 80 ? "var(--moss)" : value >= 60 ? "var(--ochre-dk)" : "var(--rust)";
  const explain = explainConfidence(op);
  return (
    <div class="flex items-center gap-2 group relative cursor-help" title={explain.text}>
      <div class="flex gap-[1.5px]">
        {Array.from({ length: ticks }).map((_, i) => (
          <span key={i} class="inline-block w-[3px] h-[14px]" style={{ background: i < filled ? color : "var(--ink-10)" }} />
        ))}
      </div>
      <span class="font-mono text-[11px] text-ink-70 font-semibold tabular-nums">{value}</span>
    </div>
  );
}

/** Mirror of worker/src/agent/confidence.ts — derives the breakdown from the operator data we have client-side.
 * Lets us show a "why 88?" tooltip without a worker round-trip. */
function explainConfidence(op: Operator): { text: string; total: number } {
  const parts: string[] = [];
  let total = 0;
  if (op.about && op.about.length > 30) { parts.push("+30 about scraped"); total += 30; }
  if (op.size_estimate) { parts.push(`+15 size (${op.size_estimate})`); total += 15; }
  if (op.hiring?.source) {
    parts.push("+20 hiring source URL");
    total += 20;
    const roleBoost = Math.min(op.hiring.roles?.length ?? 0, 2) * 5;
    if (roleBoost > 0) { parts.push(`+${roleBoost} hiring roles (${op.hiring.roles.length})`); total += roleBoost; }
  }
  if ((op.recent_activity?.length ?? 0) >= 1) { parts.push(`+10 recent activity (${op.recent_activity.length})`); total += 10; }
  if ((op.sources?.length ?? 0) >= 3) { parts.push(`+10 ≥3 citations (${op.sources.length})`); total += 10; }
  if (op.geo) { parts.push("+10 geocoded"); total += 10; }

  try {
    const host = new URL(op.url).hostname.toLowerCase().replace(/^www\./, "");
    const nameWords = op.name.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/)
      .filter(w => w.length >= 4 && !/^(the|inc|llc|company|corp|group|services|service|solutions)$/.test(w));
    if (nameWords.some(w => host.includes(w))) { parts.push("+15 hostname matches name"); total += 15; }
  } catch { /* skip */ }

  if (op.url.includes("#:~:text=")) { parts.push("−25 URL fragment"); total -= 25; }
  if (/\/list\/|\/top-\d+|\/articles?\//.test(op.url)) { parts.push("−25 aggregator path"); total -= 25; }

  const clamped = Math.max(0, Math.min(100, total));
  return {
    text: `Confidence ${clamped}/100 — derived from citation count, data depth, and hostname/name match:\n${parts.join("\n")}\n${total !== clamped ? `(raw ${total} clamped to ${clamped})` : ""}`.trim(),
    total: clamped
  };
}

/** Derive a short "via Greenhouse" / "via Lever" / "heuristic" caption from the hiring citation. */
function hiringTool(op: Operator): string {
  const cite = op.sources.find(s => s.field === "hiring");
  if (!cite) return "homepage";
  const t = cite.tool;
  if (t.startsWith("careers_page:")) return t.slice("careers_page:".length);
  if (t === "homepage_keyword_heuristic") return "heuristic";
  return t;
}
