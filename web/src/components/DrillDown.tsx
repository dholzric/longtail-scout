import { useState, useEffect } from "preact/hooks";
import type { Operator } from "../types";
import { OperatorNotes } from "./OperatorNotes";

const SHOT_KEY = "lts_demo_key";

/**
 * Lazy homepage screenshot via BD Browser API (worker proxies + caches in KV for 30d).
 * Only rendered when the user expands the drill-down, so we never pay per-operator on scout.
 */
/** Tiny visual that conveys how many distinct niches an operator has shown up in.
 *  Eight dots, the first N filled, color stepping from ink-25 to moss-bright across the run.
 *  Designed to evoke a sparkline / wedge of presence over time. */
function CrossNicheSparkline({ count, seen }: { count: number; seen: number }) {
  const dots = 8;
  const filled = Math.min(count, dots);
  return (
    <div class="flex items-center gap-1.5" title={`Appeared in ${count} niches · ${seen} total surfacings across queries`}>
      <div class="flex gap-[2px] items-center">
        {Array.from({ length: dots }).map((_, i) => {
          const on = i < filled;
          const intensity = (i + 1) / dots;
          const bg = on
            ? `color-mix(in oklab, var(--moss-bright) ${Math.round(40 + intensity * 60)}%, var(--paper))`
            : "var(--ink-15)";
          return <span key={i} class="inline-block w-[6px] h-[6px] rounded-full" style={{ background: bg }} />;
        })}
      </div>
      <span class="font-mono text-[10px] text-ink-50">×{seen}</span>
    </div>
  );
}

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

  if (errored) return null;
  return (
    <div class="overflow-hidden border border-ink-15 bg-paper-3">
      <div class="flex items-center justify-between px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider">
        <span class="text-ink-50">Homepage snapshot <span class="text-ink-40">· captured live via Bright Data Browser API</span></span>
        {loaded && <span class="text-ink-40">cached 30d</span>}
        {!loaded && <span class="text-ink-40 animate-pulse">rendering…</span>}
      </div>
      {imageSrc && (
        <img
          src={imageSrc}
          alt={`Homepage screenshot of ${url}`}
          class={`w-full transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          style="aspect-ratio: 1024/640; background: var(--paper-3)"
        />
      )}
    </div>
  );
}

interface LinkedInVerdict {
  checked: boolean;
  on_linkedin: boolean;
  evidence_url: string | null;
  match_count: number;
  serp_query: string;
  error?: string;
}

/**
 * Apollo-blind verification (v1.2.0). On drill-down open, fires a `site:linkedin.com/company`
 * search THROUGH Bright Data and renders the verdict. A confirmed *absence* is the money shot:
 * hard evidence the operator is invisible to LinkedIn-graph tools like Apollo/ZoomInfo/Clay.
 * Cached 30d server-side, so re-opening an operator costs no additional Bright Data calls.
 */
function LinkedInVerification({ name, city, opUrl, onVerdict }: { name: string; city?: string; opUrl: string; onVerdict?: (v: LinkedInVerdict) => void }) {
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [verdict, setVerdict] = useState<LinkedInVerdict | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setVerdict(null);
    const key = (typeof localStorage !== "undefined" ? localStorage.getItem(SHOT_KEY) : null) ?? "";
    const params = new URLSearchParams({ name, url: opUrl, key });
    if (city) params.set("city", city);
    fetch(`/api/linkedin-check?${params.toString()}`)
      .then((r) => r.json())
      .then((j: LinkedInVerdict) => {
        if (cancelled) return;
        setVerdict(j);
        setState(j.checked ? "done" : "error");
        if (j.checked && onVerdict) onVerdict(j);
      })
      .catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, [name, city, opUrl]);

  if (state === "loading") {
    return (
      <div class="border border-ink-15 bg-paper-3 px-3 py-2 font-mono text-[11px] text-ink-50 animate-pulse">
        verifying on LinkedIn via Bright Data…
      </div>
    );
  }
  if (state === "error" || !verdict) {
    return (
      <div class="border border-ink-15 bg-paper-3 px-3 py-2 font-mono text-[11px] text-ink-40">
        LinkedIn check unavailable right now{verdict?.error ? ` · ${verdict.error}` : ""}
      </div>
    );
  }

  if (!verdict.on_linkedin) {
    // The thesis, proven.
    return (
      <div class="border-2 border-rust bg-rust-tint/40 px-4 py-3">
        <div class="flex items-center gap-2">
          <span class="font-mono text-[10px] uppercase tracking-[0.16em] text-rust font-bold">✓ Not on LinkedIn — confirmed via Bright Data</span>
        </div>
        <div class="mt-1.5 text-sm text-ink-80 leading-snug">
          No LinkedIn company page found for <strong class="text-ink">{name}</strong>. This is exactly why Apollo, ZoomInfo, and Clay can't see them — their data graph starts at LinkedIn. We found this operator on their own website instead.
        </div>
        <div class="mt-2 font-mono text-[10px] text-ink-50 break-all" title="The exact query we ran through the Bright Data Scraping Browser">
          query: {verdict.serp_query}
        </div>
      </div>
    );
  }

  return (
    <div class="border border-ink-20 bg-paper-3 px-4 py-3">
      <div class="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-60">Has a LinkedIn company page · checked via Bright Data</div>
      <div class="mt-1.5 text-sm text-ink-70 leading-snug">
        This operator <em>is</em> on LinkedIn, so Apollo can likely enrich it — a weaker long-tail signal. We surface it honestly rather than overclaim.
      </div>
      {verdict.evidence_url && (
        <a class="mt-2 inline-block font-mono text-[11px] text-ink-60 hover:text-ink underline decoration-dotted break-all" href={verdict.evidence_url} target="_blank" rel="noreferrer">
          {verdict.evidence_url}
        </a>
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

interface AiDraft {
  subject: string;
  body: string;
  provider: string;
  cost: number;
}

interface Lookalike {
  url: string;
  name: string;
  similarity: number;
  shared_queries: string[];
  seen_count: number;
  last_query: string;
}

interface ContactDiscovery {
  emails: { email: string; same_domain: boolean }[];
  phone: string | null;
  contact: { name: string; role: string } | null;
  sources: { field: string; tool: string; url: string }[];
  pages_fetched: number;
  error?: string;
}

export function DrillDown({ op }: { op: Operator }) {
  const [copied, setCopied] = useState<string>("");
  const [ai, setAi] = useState<AiDraft | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [lookalikes, setLookalikes] = useState<Lookalike[] | null>(null);
  const [lookalikesLoading, setLookalikesLoading] = useState<boolean>(false);
  const [lookalikesNote, setLookalikesNote] = useState<string | null>(null);
  const [contacts, setContacts] = useState<ContactDiscovery | null>(null);
  const [contactsLoading, setContactsLoading] = useState<boolean>(false);
  const [contactsNote, setContactsNote] = useState<string | null>(null);
  const [linkedinVerdict, setLinkedinVerdict] = useState<LinkedInVerdict | null>(null);
  const [briefBusy, setBriefBusy] = useState<boolean>(false);

  async function exportBrief() {
    setBriefBusy(true);
    try {
      const key = (typeof localStorage !== "undefined" ? localStorage.getItem(SHOT_KEY) : null) ?? "";
      const r = await fetch("/api/brief", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          operator: op,
          linkedin: linkedinVerdict ? { on_linkedin: linkedinVerdict.on_linkedin, evidence_url: linkedinVerdict.evidence_url } : undefined,
          contacts: contacts ? { emails: contacts.emails, phone: contacts.phone, contact: contacts.contact } : undefined,
          email: ai ? { subject: ai.subject, body: ai.body } : undefined
        })
      });
      if (!r.ok) return;
      const j = await r.json() as { markdown: string; filename: string };
      const blob = new Blob([j.markdown], { type: "text/markdown;charset=utf-8" });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = j.filename || "longtail-brief.md";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } finally {
      setBriefBusy(false);
    }
  }

  async function discoverContacts() {
    setContactsLoading(true);
    setContactsNote(null);
    try {
      const key = (typeof localStorage !== "undefined" ? localStorage.getItem(SHOT_KEY) : null) ?? "";
      const params = new URLSearchParams({ url: op.url, name: op.name, key });
      const r = await fetch(`/api/contact-discovery?${params.toString()}`);
      const j = await r.json() as ContactDiscovery;
      setContacts(j);
      if (j.error) setContactsNote(j.error);
      else if (j.emails.length === 0 && !j.phone) setContactsNote(`No new contacts found across ${j.pages_fetched} page(s).`);
    } catch (err) {
      setContactsNote((err as Error).message);
    } finally {
      setContactsLoading(false);
    }
  }

  async function findLookalikes() {
    setLookalikesLoading(true);
    setLookalikesNote(null);
    try {
      const key = (typeof localStorage !== "undefined" ? localStorage.getItem("lts_demo_key") : null) ?? "";
      const r = await fetch(`/api/lookalikes?url=${encodeURIComponent(op.url)}&key=${encodeURIComponent(key)}`);
      if (!r.ok) {
        setLookalikesNote(`HTTP ${r.status}`);
        return;
      }
      const j = await r.json() as { lookalikes: Lookalike[]; note?: string };
      setLookalikes(j.lookalikes);
      if (j.note) setLookalikesNote(j.note);
    } catch (err) {
      setLookalikesNote((err as Error).message);
    } finally {
      setLookalikesLoading(false);
    }
  }

  async function flash(label: string, text: string) {
    if (await copyText(text)) {
      setCopied(label);
      setTimeout(() => setCopied(""), 1500);
    }
  }

  async function generateWithAi() {
    setAiLoading(true);
    setAiError(null);
    try {
      const key = (typeof localStorage !== "undefined" ? localStorage.getItem("lts_demo_key") : null) ?? "";
      const res = await fetch("/api/draft-email", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({ operator: op })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setAiError(j.error ?? `HTTP ${res.status}`);
        return;
      }
      const j = await res.json() as { subject: string; body: string; provider: string; estimated_cost_usd: number };
      setAi({ subject: j.subject, body: j.body, provider: j.provider, cost: j.estimated_cost_usd });
    } catch (err) {
      setAiError((err as Error).message);
    } finally {
      setAiLoading(false);
    }
  }

  const templateEmail = buildOutreachEmail(op);
  const activeEmail = ai ? { subject: ai.subject, body: ai.body } : templateEmail;

  function printDossier() {
    // Tag this DrillDown's root so the @media print stylesheet shows just it.
    // We walk up from the print button's ancestor — but easier to use a class on the wrapper.
    const root = document.querySelector("[data-print-root]");
    if (root) {
      // Move the root to be a direct child of body so the "hide all body > *" print rule works.
      const placeholder = document.createComment("dossier-placeholder");
      const parent = root.parentNode;
      if (parent) {
        parent.insertBefore(placeholder, root);
        document.body.appendChild(root);
        root.classList.add("lts-print-root");
        window.requestAnimationFrame(() => {
          window.print();
          // Restore DOM after the print dialog returns
          root.classList.remove("lts-print-root");
          parent.insertBefore(root, placeholder);
          placeholder.remove();
        });
        return;
      }
    }
    window.print();
  }

  const hostname = (() => { try { return new URL(op.url).hostname.replace(/^www\./, ""); } catch { return op.url; } })();
  const hiringPattern = op.sources.find(s => s.field === "hiring")?.tool ?? "";
  const hiringVia = hiringPattern.startsWith("careers_page:") ? hiringPattern.slice("careers_page:".length) : hiringPattern === "homepage_keyword_heuristic" ? "homepage heuristic" : hiringPattern;

  return (
    <div data-print-root>
      {/* Specimen header */}
      <div class="flex items-baseline justify-between gap-4 mb-3 flex-wrap">
        <div class="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-60">
          § specimen no. {String(op.rank).padStart(2, "0")} · field card
        </div>
        <div class="flex items-center gap-2">
          <button
            class="border border-ink-25 bg-paper px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-70 hover:bg-paper-3 inline-flex items-center gap-1.5 disabled:opacity-50"
            onClick={(e) => { e.stopPropagation(); exportBrief(); }}
            disabled={briefBusy}
            type="button"
            title="Download a Markdown account brief (evidence + contacts + draft email + sources) to paste into your CRM"
          >
            {briefBusy ? "exporting…" : "export brief"} <span aria-hidden="true">↓</span>
          </button>
          <button
            class="border border-ink-25 bg-paper px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-70 hover:bg-paper-3 inline-flex items-center gap-1.5"
            onClick={(e) => { e.stopPropagation(); printDossier(); }}
            type="button"
            title="Print or save this specimen card as a PDF"
          >
            print dossier <span aria-hidden="true">⎙</span>
          </button>
          <a
            class="border border-ink-25 bg-paper px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-70 hover:bg-paper-3 inline-flex items-center gap-1.5"
            href={op.url} target="_blank" rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            open homepage <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>

      {/* Title + metadata */}
      <h3 class="font-serif text-3xl font-bold text-ink leading-tight">{op.name}</h3>
      <div class="font-mono text-[11px] text-ink-50 mt-1 flex flex-wrap gap-x-3 gap-y-1">
        <span>{hostname}</span>
        {op.size_estimate && <><span>·</span><span>{op.size_estimate} emp</span></>}
        {op.city && <><span>·</span><span>{op.city}</span></>}
        {op.geo?.display_name && <><span>·</span><span class="truncate max-w-md" title={op.geo.display_name}>{op.geo.display_name.slice(0, 60)}</span></>}
      </div>
      {/* Contact strip — phone + owner if extracted from homepage */}
      {(op.phone || op.contact) && (
        <div class="mt-2 flex flex-wrap items-center gap-3 text-sm">
          {op.phone && (
            <a href={`tel:${op.phone.replace(/[^\d+]/g, "")}`} class="inline-flex items-center gap-1.5 text-ink-80 hover:text-rust font-mono" title="Direct dial — extracted from homepage">
              <span aria-hidden="true">📞</span>{op.phone}
            </a>
          )}
          {op.contact && (
            <span class="inline-flex items-center gap-1.5 text-ink-80">
              <span aria-hidden="true">👤</span>
              <span><strong class="text-ink">{op.contact.name}</strong> <span class="text-ink-60 text-xs">· {op.contact.role}</span></span>
            </span>
          )}
        </div>
      )}

      {/* Apollo-blind verification — live LinkedIn-absence proof via Bright Data */}
      <div class="mt-4">
        <LinkedInVerification name={op.name} city={op.city} opUrl={op.url} onVerdict={setLinkedinVerdict} />
      </div>

      {/* Two-column layout */}
      <div class="mt-5 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_360px] gap-6">
        {/* LEFT COLUMN — about + hiring + ICP + activity */}
        <div class="space-y-5">
          <p class="text-sm text-ink-70 leading-relaxed">{op.about ?? "—"}</p>

          {/* Hiring signal box — moss-bordered if real, ochre if heuristic, none if no signal */}
          {(op.hiring.count ?? 0) > 0 && (
            <div class={`border ${hiringPattern.startsWith("careers_page:") ? "border-moss bg-moss-tint/30" : "border-ochre-dk/40 bg-ochre-tint/30"} px-4 py-3 relative`}>
              <div class="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-60 mb-1.5">
                hiring signal · trigger event
              </div>
              <div class="flex items-baseline gap-3">
                <span class="font-serif text-3xl font-semibold text-ink leading-none">{op.hiring.count}</span>
                <span class="text-sm text-ink-70 leading-tight">open role{(op.hiring.count ?? 0) > 1 ? "s" : ""}{hiringVia ? ` — ${hiringPattern.startsWith("careers_page:") ? `parsed from ${hiringVia} via BD Scraping Browser` : "extracted from homepage text"}` : ""}</span>
              </div>
              {op.hiring.roles.length > 0 && (
                <div class="mt-3 flex flex-wrap gap-1.5">
                  {op.hiring.roles.slice(0, 6).map((r, i) => (
                    <span key={i} class="border border-ink-25 bg-paper px-2 py-0.5 text-xs text-ink-80">{r}</span>
                  ))}
                </div>
              )}
              {op.hiring.source && (
                <a class="block mt-2 font-mono text-[11px] text-ink-50 hover:text-ink underline decoration-dotted" href={op.hiring.source} target="_blank" rel="noreferrer">{op.hiring.source}</a>
              )}
            </div>
          )}

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div class="font-mono text-[10px] uppercase tracking-[0.14em] text-rust mb-1">icp fit reason</div>
              <div class="text-sm text-ink-80 leading-snug">{op.icp_fit_reason || "—"}</div>
            </div>
            <div>
              <div class="font-mono text-[10px] uppercase tracking-[0.14em] text-rust mb-1">draft outreach angle</div>
              <div class="text-sm text-ink-80 leading-snug italic">"{op.sales_angle}"</div>
            </div>
          </div>

          {op.tech_stack && op.tech_stack.length > 0 && (
            <div>
              <div class="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-60 mb-2">
                tech stack detected · {op.tech_stack.length} marker{op.tech_stack.length === 1 ? "" : "s"}
              </div>
              <div class="flex flex-wrap gap-1.5">
                {op.tech_stack.map((t) => (
                  <span key={t} class="inline-flex items-center bg-paper-3 border border-ink-15 text-ink-80 px-2 py-1 text-xs">
                    {t}
                  </span>
                ))}
              </div>
              <div class="mt-1 text-xs text-ink-60">
                Sniffed from the homepage HTML — what vendors this operator already runs. Useful for "avoid (already a customer of competitor)" or "pitch as migration" calls.
              </div>
            </div>
          )}

          {op.recent_activity.length > 0 && (
            <div>
              <div class="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-60 mb-2">recent activity</div>
              <ul class="m-0 p-0 list-none">
                {op.recent_activity.map((a, i) => (
                  <li key={i} class={`flex gap-3 py-1.5 ${i > 0 ? "border-t border-dashed border-ink-15" : ""}`}>
                    {a.date && <span class="font-mono text-[11px] text-ink-50 shrink-0 w-20">{a.date}</span>}
                    <a class="flex-1 text-sm text-ink-80 hover:text-ink underline decoration-dotted" href={a.source} target="_blank" rel="noreferrer">{a.headline}</a>
                    <span class="font-mono text-[10px] text-ink-50 shrink-0">{(() => { try { return new URL(a.source).hostname.replace(/^www\./, ""); } catch { return ""; } })()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {op.memory && op.memory.cross_niche && op.memory.cross_niche.length > 0 && (
            <div class="border border-sky-paper/40 bg-sky-tint px-3 py-2.5 text-sm">
              <div class="flex items-center justify-between mb-1.5">
                <div class="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-60">cross-niche signal</div>
                <CrossNicheSparkline count={(op.memory.cross_niche?.length ?? 0) + 1} seen={op.memory.seen_count} />
              </div>
              <div class="text-ink-80">
                Also appeared under:{" "}
                {op.memory.cross_niche.map((q, i) => (
                  <span key={i} class="ml-1 inline-block bg-paper px-2 py-0.5 text-xs border border-ink-25">{q}</span>
                ))}
              </div>
              <div class="mt-1 text-xs text-ink-60">Multi-vertical operators are often the highest-LTV accounts — they buy multiple SaaS tools.</div>
            </div>
          )}

          {/* Contact discovery — walks contact/about pages via Bright Data for a real inbox */}
          <div class="border border-ink-15 px-3 py-2.5">
            <div class="flex items-center justify-between mb-1.5">
              <div class="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-60">discover contacts</div>
              <button
                class="border border-ink-25 bg-paper-2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-70 hover:bg-paper-3 disabled:opacity-50"
                onClick={discoverContacts}
                disabled={contactsLoading}
                type="button"
                title="Fetch the operator's contact/about pages via Bright Data and extract a reachable email + phone"
              >
                {contactsLoading ? "fetching via BD…" : contacts ? "re-scan" : "find via Bright Data"}
              </button>
            </div>
            <div class="text-xs text-ink-60">Walks the contact/about pages via the Bright Data Browser to surface a real inbox an SDR can email — beyond the homepage.</div>
            {contactsNote && <div class="mt-2 text-xs text-rust-dk italic">{contactsNote}</div>}
            {contacts && (contacts.emails.length > 0 || contacts.phone || contacts.contact) && (
              <div class="mt-2.5 space-y-1.5">
                {contacts.emails.map((e) => (
                  <div key={e.email} class="flex items-center gap-2 text-sm">
                    <a href={`mailto:${e.email}`} class="text-ink-80 hover:text-rust font-mono text-[13px] break-all">{e.email}</a>
                    {e.same_domain && <span class="font-mono text-[9px] uppercase tracking-wider bg-moss-tint/50 text-moss-dk px-1.5 py-0.5" title="Own-domain inbox — the highest-value address">own domain</span>}
                  </div>
                ))}
                {contacts.phone && (
                  <div class="text-sm">
                    <a href={`tel:${contacts.phone.replace(/[^\d+]/g, "")}`} class="text-ink-80 hover:text-rust font-mono inline-flex items-center gap-1.5"><span aria-hidden="true">📞</span>{contacts.phone}</a>
                  </div>
                )}
                {contacts.contact && (
                  <div class="text-sm text-ink-80 inline-flex items-center gap-1.5"><span aria-hidden="true">👤</span><strong class="text-ink">{contacts.contact.name}</strong><span class="text-ink-60 text-xs">· {contacts.contact.role}</span></div>
                )}
                {contacts.sources.length > 0 && (
                  <div class="pt-1 font-mono text-[10px] text-ink-50">
                    {contacts.pages_fetched} page{contacts.pages_fetched === 1 ? "" : "s"} fetched via Bright Data:{" "}
                    {contacts.sources.map((s, i) => (
                      <span key={i}>
                        {i > 0 ? " · " : ""}
                        <a class="underline decoration-dotted hover:text-ink" href={s.url} target="_blank" rel="noreferrer">{(() => { try { return new URL(s.url).pathname || "/"; } catch { return s.url; } })()}</a>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Lookalikes — finds operators in the memory layer with overlapping query_history */}
          <div class="border border-ink-15 px-3 py-2.5">
            <div class="flex items-center justify-between mb-1.5">
              <div class="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-60">find lookalikes</div>
              <button
                class="border border-ink-25 bg-paper-2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-70 hover:bg-paper-3"
                onClick={findLookalikes}
                disabled={lookalikesLoading}
                type="button"
              >
                {lookalikesLoading ? "scanning…" : lookalikes ? "rescan" : "scan memory"}
              </button>
            </div>
            <div class="text-xs text-ink-60">Operators in our memory layer whose query_history overlaps with this one. Higher similarity = same buyer-fit signal.</div>
            {lookalikesNote && <div class="mt-2 text-xs text-rust-dk italic">{lookalikesNote}</div>}
            {lookalikes && lookalikes.length > 0 && (
              <ol class="m-0 mt-2 p-0 list-none space-y-1">
                {lookalikes.map((l, i) => (
                  <li key={l.url} class="flex items-center gap-2 text-xs">
                    <span class="font-mono text-[10px] text-ink-40 w-4 shrink-0">{i + 1}</span>
                    <a class="text-ink-80 hover:text-ink underline decoration-dotted truncate flex-1" href={l.url} target="_blank" rel="noreferrer">{l.name}</a>
                    <span class="font-mono text-[10px] text-moss-dk shrink-0" title={`Jaccard similarity over query_history\nShared: ${l.shared_queries.join(", ")}`}>
                      {(l.similarity * 100).toFixed(0)}%
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {lookalikes && lookalikes.length === 0 && !lookalikesNote && (
              <div class="mt-2 text-xs text-ink-50 italic">No overlapping operators yet. As more scouts run, the memory layer grows.</div>
            )}
          </div>

          <HomepageShot url={op.url} />
          <OperatorNotes opUrl={op.url} />
        </div>

        {/* RIGHT COLUMN — outreach draft + footnotes + index memory */}
        <div class="space-y-4">
          {/* Outreach draft panel */}
          <div class="border border-ink-20 bg-paper">
            <div class="border-b border-ink-15 px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
              <div class="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-60">
                outreach draft{ai && <span class="ml-1.5 text-moss">· DeepSeek</span>}
              </div>
              {ai && <span class="font-mono text-[10px] text-ink-50">+ AI-personalized · ${ai.cost.toFixed(5)}</span>}
            </div>
            <div class="px-3 py-3 space-y-2">
              <div class="flex items-baseline gap-2">
                <span class="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50 shrink-0">subj</span>
                <span class="text-sm font-semibold text-ink">{activeEmail.subject}</span>
              </div>
              <pre class="font-serif text-sm text-ink-80 whitespace-pre-wrap leading-relaxed m-0">{activeEmail.body}</pre>
            </div>
            {aiError && <div class="mx-3 mb-2 bg-rust-tint px-2 py-1 text-xs text-rust-dk">AI error: {aiError}</div>}
            <div class="border-t border-ink-15 px-2 py-2 flex flex-wrap gap-1">
              <button
                class={`px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider ${aiLoading ? "bg-paper-3 text-ink-40" : "bg-ink text-paper hover:bg-ink-90"} disabled:opacity-50`}
                onClick={generateWithAi}
                disabled={aiLoading}
                title="Generate a personalized cold email referencing operator's actual facts"
                type="button"
              >
                {aiLoading ? "✨ generating…" : ai ? "✨ regenerate" : "✨ + AI"}
              </button>
              <button class="border border-ink-25 bg-paper px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-70 hover:bg-paper-3" onClick={() => flash("subject", activeEmail.subject)}>
                {copied === "subject" ? "✓ subj" : "📋 subject"}
              </button>
              <button class="border border-ink-25 bg-paper px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-70 hover:bg-paper-3" onClick={() => flash("body", activeEmail.body)}>
                {copied === "body" ? "✓ body" : "📋 body"}
              </button>
              <a class="border border-ink-25 bg-paper px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-70 hover:bg-paper-3 inline-flex items-center gap-1" href={`mailto:?subject=${encodeURIComponent(activeEmail.subject)}&body=${encodeURIComponent(activeEmail.body)}`}>
                open in mail →
              </a>
            </div>
          </div>

          {/* Footnotes table — numbered citations */}
          <div class="border border-ink-20 bg-paper">
            <div class="border-b border-ink-15 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-60">
              footnotes · {op.sources.length} bright data fetch{op.sources.length === 1 ? "" : "es"}
            </div>
            <ol class="m-0 p-0 list-none">
              {op.sources.map((s, i) => (
                <li key={i} class={`px-3 py-1.5 text-xs ${i > 0 ? "border-t border-dashed border-ink-15" : ""}`}>
                  <div class="flex items-center gap-2">
                    <span class="font-mono text-[10px] text-ink-50 w-4 shrink-0">{i + 1}</span>
                    <span class="font-mono text-[10px] uppercase text-ink-60 w-24 shrink-0">{s.field}</span>
                    <a class="text-ink-80 hover:text-ink underline decoration-dotted truncate flex-1" href={s.url} target="_blank" rel="noreferrer" title={s.url}>{s.tool}</a>
                  </div>
                  {s.snippet && (
                    <div class="ml-[4.5rem] mt-1 italic text-ink-60 text-[11px] leading-snug" title="Snippet captured during the BD fetch — proof the citation isn't LLM hallucination">
                      "{s.snippet.length > 200 ? s.snippet.slice(0, 200) + "…" : s.snippet}"
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </div>

          {/* Index memory chip */}
          {op.memory && (
            <div class="border border-ink-15 bg-paper px-3 py-2.5">
              <div class="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-60">index memory</div>
              <div class="flex items-baseline gap-2 mt-1">
                <span class="font-serif text-2xl font-semibold text-ink leading-none">×{op.memory.seen_count}</span>
                <span class="text-xs text-ink-60">
                  {op.memory.memory_state === "new" ? "first time in any LongTail Scout query" :
                   op.memory.memory_state === "familiar" ? `seen ${op.memory.seen_count}× across prior queries` :
                   `frequent — ${op.memory.seen_count}× across queries`}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
