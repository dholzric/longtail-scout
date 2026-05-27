import { useState, useEffect } from "preact/hooks";
import { readSse } from "./sse";
import type { Operator, SseEvent, CostSnapshot } from "./types";
import { QueryForm } from "./components/QueryForm";
import { AgentTrace, type TraceEntry } from "./components/AgentTrace";
import { ResultTable } from "./components/ResultTable";
import { MapView } from "./components/MapView";
import { WedgeSummary } from "./components/WedgeSummary";
import { CityBreakdown } from "./components/CityBreakdown";
import { SocialShare } from "./components/SocialShare";
import { AboutPage } from "./components/AboutPage";
import { ApiDocsPage } from "./components/ApiDocsPage";
import { SkeletonStrip } from "./components/Skeleton";
import { Watchlist } from "./components/Watchlist";
import { Onboarding } from "./components/Onboarding";
import { DemandProbe } from "./components/DemandProbe";
import { Hero } from "./components/Hero";
import { TweaksPanel } from "./components/TweaksPanel";

type Status = "idle" | "running" | "done" | "error";
type ViewMode = "table" | "map";

const STORAGE_KEY = "lts_demo_key";

export function App() {
  // Tiny client-side router — Cloudflare assets serves the SPA on every path that doesn't
  // match /api/*, so we just look at window.location.pathname.
  if (typeof window !== "undefined" && /^\/(about|how-it-works)\/?$/.test(window.location.pathname)) {
    return <AboutPage />;
  }
  if (typeof window !== "undefined" && /^\/(docs|api-docs|api-reference)\/?$/.test(window.location.pathname)) {
    return <ApiDocsPage />;
  }
  const [query, setQuery] = useState("roofing contractors in Houston");
  const [status, setStatus] = useState<Status>("idle");
  const [trace, setTrace] = useState<TraceEntry[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [demoKey, setDemoKey] = useState<string>("");
  const [askKey, setAskKey] = useState<boolean>(false);
  const [view, setView] = useState<ViewMode>("table");
  const [cost, setCost] = useState<CostSnapshot | null>(null);
  const [sampleMode, setSampleMode] = useState<boolean>(false);
  const [initialOpenId, setInitialOpenId] = useState<string | null>(null);
  const [demandCount, setDemandCount] = useState<number | null>(null);
  const showTweaks = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tweaks") === "1";

  // Pull saved key + shareable ?q= query on first mount.
  useEffect(() => {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("key");
    if (fromUrl) {
      localStorage.setItem(STORAGE_KEY, fromUrl);
      setDemoKey(fromUrl);
      url.searchParams.delete("key");
      window.history.replaceState(null, "", url.toString());
    } else {
      const saved = localStorage.getItem(STORAGE_KEY) ?? "";
      if (saved) setDemoKey(saved);
    }
    // Shareable query (?q=...) — auto-fills the input; ?run=1 also auto-runs.
    const qParam = url.searchParams.get("q");
    const autoRun = url.searchParams.get("run") === "1";
    if (qParam) {
      setQuery(qParam);
      if (autoRun) {
        // Defer to next tick so demoKey state has time to settle.
        setTimeout(() => {
          const ev = new Event("auto-run-from-url");
          window.dispatchEvent(ev);
        }, 50);
      }
    }
    // Operator permalink (?op=<id>) — ResultTable will auto-expand the matching row.
    const opParam = url.searchParams.get("op");
    if (opParam) setInitialOpenId(opParam);
  }, []);

  // Listen for the auto-run signal dispatched after URL parsing.
  useEffect(() => {
    const handler = () => { void run(); };
    window.addEventListener("auto-run-from-url", handler);
    return () => window.removeEventListener("auto-run-from-url", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, demoKey]);

  // Keyboard shortcuts:
  //   Cmd/Ctrl+Enter — run the current query
  //   Cmd/Ctrl+K     — focus the query input
  //   Cmd/Ctrl+E     — export CSV (when results visible) — handled in ResultTable's Export button
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key === "Enter") {
        e.preventDefault();
        void run();
      } else if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        const input = document.querySelector('input[placeholder^="roofing"]') as HTMLInputElement | null;
        input?.focus();
        input?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, demoKey]);

  function copyShareUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set("q", query);
    url.searchParams.set("run", "1");
    url.searchParams.delete("key"); // never include password
    navigator.clipboard?.writeText(url.toString()).catch(() => {});
  }

  async function run(overrideQuery?: string) {
    if (!demoKey) {
      setAskKey(true);
      return;
    }
    const q = (overrideQuery ?? query).trim();
    if (!q) return;
    if (overrideQuery && overrideQuery !== query) setQuery(overrideQuery);
    setStatus("running");
    setTrace([]);
    setOperators([]);
    setError(null);
    setCost(null);

    // Pass through ?sample=1 if it was on the loaded URL
    const isSample = new URL(window.location.href).searchParams.get("sample") === "1";
    setSampleMode(isSample);
    const scoutPath = isSample ? "/api/scout?sample=1" : "/api/scout";
    const resp = await fetch(scoutPath, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${demoKey}`
      },
      body: JSON.stringify({ query: q })
    });
    if (resp.status === 401) {
      localStorage.removeItem(STORAGE_KEY);
      setDemoKey("");
      setAskKey(true);
      setError("Demo password rejected.");
      setStatus("error");
      return;
    }
    if (!resp.ok) {
      setError(`HTTP ${resp.status}`);
      setStatus("error");
      return;
    }
    try {
      for await (const ev of readSse(resp)) {
        ingest(ev);
      }
    } catch (err) {
      setError((err as Error).message);
      setStatus("error");
    }
  }

  function submitKey(e: Event) {
    e.preventDefault();
    const input = (document.getElementById("demo-key-input") as HTMLInputElement | null);
    const v = input?.value?.trim() ?? "";
    if (v) {
      localStorage.setItem(STORAGE_KEY, v);
      setDemoKey(v);
      setAskKey(false);
    }
  }

  function ingest(ev: SseEvent) {
    if (ev.event === "cost") {
      setCost(ev.data);
      return;
    }
    if (ev.event === "operator") {
      // Progressive rendering — append each operator as the worker emits it.
      setOperators(prev => [...prev, ev.data]);
      return;
    }
    if (ev.event === "result") {
      // Final canonical list — replace whatever streamed in (handles sample mode + any de-dupe).
      setOperators(ev.data.operators);
      return;
    }
    if (ev.event === "done") {
      setStatus("done");
      // Scroll the wedge summary into view so the demo "lands" on the result panel,
      // not on the scrolled-up form. Defers to next frame so the DOM has updated.
      requestAnimationFrame(() => {
        const el = document.querySelector('[data-section="wedge-summary"]');
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }
    if (ev.event === "error") {
      setError(ev.data.message);
      setStatus("error");
      return;
    }
    setTrace(t => [...t, { event: ev.event, data: ev.data, ts: Date.now() }]);
  }

  return (
    <div class="min-h-screen bg-paper text-ink">
      {/* Top utility bar — sticky cost meter + nav (live indicator, edition, BD/LLM, links) */}
      <div class="sticky top-0 z-50 border-b border-ink-15 backdrop-blur" style={{ background: "color-mix(in oklab, var(--paper) 88%, transparent)" }}>
        <div class="mx-auto max-w-6xl px-6 py-2 flex flex-wrap items-center gap-4 text-[11px] font-mono text-ink-70">
          <span class="inline-flex items-center gap-1.5">
            <span class="inline-block h-1.5 w-1.5 rounded-full bg-moss" style={{ boxShadow: "0 0 0 3px color-mix(in oklab, var(--moss) 25%, transparent)" }} />
            <span class="font-semibold text-ink-80">live</span>
          </span>
          <span class="text-ink-50">edition 2026.05 · field manual for the long tail</span>
          <span class="flex-1" />
          {cost && (
            <>
              <span title="Bright Data Scraping Browser nav cost"><span class="text-ink-40">BD</span> <span class="text-ink">${cost.bd_usd.toFixed(4)}</span> <span class="text-ink-40">({cost.bd_renders} renders)</span></span>
              <span class="text-ink-25">·</span>
              <span title="DeepSeek token cost"><span class="text-ink-40">LLM</span> <span class="text-ink">${cost.llm_usd.toFixed(4)}</span> <span class="text-ink-40">({(cost.llm_input_tokens / 1000).toFixed(1)}k tok)</span></span>
              <span class="text-ink-25">·</span>
              <span><span class="text-ink-40">Σ</span> <span class="text-ink font-bold">${cost.total_usd.toFixed(4)}</span></span>
              <span class="text-ink-25">·</span>
            </>
          )}
          <a href="/about" class="text-ink-70 hover:text-ink border-b border-dotted border-ink-30">field manual</a>
          <a href="/docs" class="text-ink-70 hover:text-ink border-b border-dotted border-ink-30">api</a>
        </div>
      </div>

      <header>
        <div class="mx-auto max-w-6xl px-6 pt-12 pb-2">
          <div class="flex items-baseline justify-between gap-4">
            <h1 class="text-2xl font-serif font-semibold tracking-tight">
              <span class="italic font-medium">longtail</span><span class="font-bold">scout</span><span class="ml-1 font-mono text-[10px] font-normal text-ink-40 align-baseline">.com</span>
            </h1>
            <div class="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50 flex items-center gap-2.5">
              <span>vol. 1</span>
              <span class="inline-block h-3 w-px bg-ink-25" />
              <span>field manual for the long tail</span>
              <span class="inline-block h-3 w-px bg-ink-25" />
              <span>est. may 2026</span>
            </div>
          </div>
        </div>
      </header>

      <main class="mx-auto max-w-6xl px-6 py-8 space-y-6">
        <Onboarding />
        {askKey && (
          <form onSubmit={submitKey} class="rounded-lg border border-ochre/40 bg-ochre-tint p-6 shadow-sm">
            <label class="block text-sm font-medium text-ochre-dk mb-2">Demo password required</label>
            <p class="text-xs text-ochre-dk/80 mb-3">This is a gated demo (Bright Data + DeepSeek API calls cost real money). Hackathon judges: the password is in the lablab.ai submission description.</p>
            <div class="flex gap-2">
              <input
                id="demo-key-input"
                type="password"
                autocomplete="current-password"
                class="flex-1 rounded border border-ochre/40 bg-paper px-3 py-2 focus:border-ochre-dk focus:outline-none"
                placeholder="enter password"
              />
              <button type="submit" class="rounded bg-ochre-dk px-4 py-2 text-paper hover:bg-ink">Unlock</button>
            </div>
          </form>
        )}
        <Hero demandCount={demandCount} />
        <QueryForm value={query} onChange={setQuery} onRun={() => run()} onRunWith={(q) => run(q)} onShare={copyShareUrl} disabled={status === "running"} />
        <DemandProbe query={query} onCount={setDemandCount} />
        <Watchlist demoKey={demoKey} currentQuery={query} onPickQuery={setQuery} />
        {sampleMode && (
          <div class="rounded border border-sky-paper/40 bg-sky-tint px-4 py-2 text-xs text-ink-80">
            <span class="font-medium">Sample mode active</span> — replaying a cached result for guaranteed-fast demo (140ms response, no real BD/LLM spend). Remove <code>?sample=1</code> from the URL to run a live scout.
          </div>
        )}
        {error && <div class="rounded border border-rust/40 bg-rust-tint p-4 text-rust-dk">Error: {error}</div>}
        {(status === "running" || trace.length > 0) && (
          <AgentTrace entries={trace} running={status === "running"} />
        )}
        {status === "running" && operators.length === 0 && (
          <SkeletonStrip count={3} />
        )}
        {operators.length > 0 && (
          <>
            <div data-section="wedge-summary"><WedgeSummary operators={operators} niche={query} /></div>
            <CityBreakdown operators={operators} />
            <SocialShare operators={operators} query={query} />
            <div class="flex items-center gap-2">
              <span class="text-xs text-ink-50 mr-2 font-mono uppercase tracking-wider">view:</span>
              <button
                class={`rounded px-3 py-1 text-xs font-mono uppercase tracking-wider ${view === "table" ? "bg-ink text-paper" : "border border-ink-25 bg-paper-2 text-ink-70 hover:bg-paper-3"}`}
                onClick={() => setView("table")}
              >Table</button>
              <button
                class={`rounded px-3 py-1 text-xs font-mono uppercase tracking-wider ${view === "map" ? "bg-ink text-paper" : "border border-ink-25 bg-paper-2 text-ink-70 hover:bg-paper-3"}`}
                onClick={() => setView("map")}
              >Map</button>
              <span class="ml-auto text-xs text-ink-50">{operators.filter(o => o.geo).length} of {operators.length} geocoded</span>
            </div>
            {view === "table" ? <ResultTable operators={operators} initialOpenId={initialOpenId} query={query} /> : <MapView operators={operators} query={query} />}
          </>
        )}
      </main>

      {showTweaks && <TweaksPanel />}

      <footer class="border-t border-ink-15 mt-12">
        <div class="mx-auto max-w-6xl px-6 py-10 font-mono text-[11px] text-ink-50 uppercase tracking-wider flex flex-wrap items-center justify-between gap-3">
          <span>longtailscout.com · made in Austin · all rights reserved</span>
          <span>Built for the Bright Data Web Data UNLOCKED hackathon, May 2026</span>
        </div>
      </footer>
    </div>
  );
}
