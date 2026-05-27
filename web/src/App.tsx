import { useState, useEffect } from "preact/hooks";
import { readSse } from "./sse";
import type { Operator, SseEvent, CostSnapshot } from "./types";
import { QueryForm } from "./components/QueryForm";
import { AgentTrace, type TraceEntry } from "./components/AgentTrace";
import { ResultTable } from "./components/ResultTable";
import { MapView } from "./components/MapView";
import { WedgeSummary } from "./components/WedgeSummary";
import { ApolloCompare } from "./components/ApolloCompare";
import { CityBreakdown } from "./components/CityBreakdown";
import { SocialShare } from "./components/SocialShare";
import { AboutPage } from "./components/AboutPage";
import { ApiDocsPage } from "./components/ApiDocsPage";
import { SkeletonStrip } from "./components/Skeleton";
import { Watchlist } from "./components/Watchlist";
import { Onboarding } from "./components/Onboarding";
import { DemandProbe } from "./components/DemandProbe";

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
    <div class="min-h-screen bg-slate-50 text-slate-900">
      <header class="border-b border-slate-200 bg-white">
        <div class="mx-auto max-w-6xl px-6 py-5">
          <div class="flex items-baseline justify-between gap-4">
            <h1 class="text-2xl font-semibold tracking-tight">LongTail Scout</h1>
            <div class="flex items-center gap-3 text-xs">
              <a class="text-blue-700 underline" href="/docs">API docs</a>
              <span class="text-slate-300">·</span>
              <a class="text-blue-700 underline" href="/about">How it works →</a>
            </div>
          </div>
          <p class="text-sm text-slate-600">Find net-new accounts in markets Apollo can't see. Long-tail prospect scout for vertical-SaaS GTM teams — built on Bright Data, DeepSeek, and a private ~7M-business demand-signal index.</p>
        </div>
      </header>

      <main class="mx-auto max-w-6xl px-6 py-8 space-y-6">
        <Onboarding />
        {askKey && (
          <form onSubmit={submitKey} class="rounded-lg border border-amber-300 bg-amber-50 p-6 shadow-sm">
            <label class="block text-sm font-medium text-amber-900 mb-2">Demo password required</label>
            <p class="text-xs text-amber-800 mb-3">This is a gated demo (Bright Data + DeepSeek API calls cost real money). Hackathon judges: the password is in the lablab.ai submission description.</p>
            <div class="flex gap-2">
              <input
                id="demo-key-input"
                type="password"
                autocomplete="current-password"
                class="flex-1 rounded border border-amber-300 px-3 py-2 focus:border-amber-500 focus:outline-none"
                placeholder="enter password"
              />
              <button type="submit" class="rounded bg-amber-700 px-4 py-2 text-white hover:bg-amber-800">Unlock</button>
            </div>
          </form>
        )}
        <QueryForm value={query} onChange={setQuery} onRun={() => run()} onRunWith={(q) => run(q)} onShare={copyShareUrl} disabled={status === "running"} />
        <DemandProbe query={query} />
        <Watchlist demoKey={demoKey} currentQuery={query} onPickQuery={setQuery} />
        {sampleMode && (
          <div class="rounded border border-violet-200 bg-violet-50 px-4 py-2 text-xs text-violet-900">
            <span class="font-medium">Sample mode active</span> — replaying a cached result for guaranteed-fast demo (140ms response, no real BD/LLM spend). Remove <code>?sample=1</code> from the URL to run a live scout.
          </div>
        )}
        {cost && (
          <div class="sticky top-2 z-30 flex flex-wrap items-center gap-3 rounded border border-slate-200 bg-white/95 backdrop-blur px-4 py-2 text-xs text-slate-600 shadow-sm">
            <span class="font-medium text-slate-700">{status === "running" ? "Live cost meter:" : "Final cost:"}</span>
            <span title="Bright Data Scraping Browser nav cost">BD ${cost.bd_usd.toFixed(4)} <span class="text-slate-400">({cost.bd_renders} renders)</span></span>
            <span class="text-slate-300">·</span>
            <span title="DeepSeek token cost">LLM ${cost.llm_usd.toFixed(4)} <span class="text-slate-400">({cost.llm_input_tokens.toLocaleString()} in / {cost.llm_output_tokens.toLocaleString()} out)</span></span>
            <span class="text-slate-300">·</span>
            <span class="font-medium text-slate-900">Total ${cost.total_usd.toFixed(4)}</span>
          </div>
        )}
        {error && <div class="rounded border border-red-300 bg-red-50 p-4 text-red-800">Error: {error}</div>}
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
            <ApolloCompare operators={operators} query={query} />
            <SocialShare operators={operators} query={query} />
            <div class="flex items-center gap-2">
              <span class="text-xs text-slate-500 mr-2">View:</span>
              <button
                class={`rounded px-3 py-1 text-xs ${view === "table" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
                onClick={() => setView("table")}
              >Table</button>
              <button
                class={`rounded px-3 py-1 text-xs ${view === "map" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
                onClick={() => setView("map")}
              >Map</button>
              <span class="ml-auto text-xs text-slate-500">{operators.filter(o => o.geo).length} of {operators.length} geocoded</span>
            </div>
            {view === "table" ? <ResultTable operators={operators} initialOpenId={initialOpenId} query={query} /> : <MapView operators={operators} query={query} />}
          </>
        )}
      </main>

      <footer class="mx-auto max-w-6xl px-6 py-12 text-xs text-slate-500">
        Built for the Bright Data Web Data UNLOCKED hackathon, May 2026.
      </footer>
    </div>
  );
}
