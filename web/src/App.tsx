import { useState, useEffect } from "preact/hooks";
import { readSse } from "./sse";
import type { Operator, SseEvent, CostSnapshot } from "./types";
import { QueryForm } from "./components/QueryForm";
import { AgentTrace, type TraceEntry } from "./components/AgentTrace";
import { ResultTable } from "./components/ResultTable";
import { MapView } from "./components/MapView";
import { WedgeSummary } from "./components/WedgeSummary";

type Status = "idle" | "running" | "done" | "error";
type ViewMode = "table" | "map";

const STORAGE_KEY = "lts_demo_key";

export function App() {
  const [query, setQuery] = useState("roofing contractors in Houston");
  const [status, setStatus] = useState<Status>("idle");
  const [trace, setTrace] = useState<TraceEntry[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [demoKey, setDemoKey] = useState<string>("");
  const [askKey, setAskKey] = useState<boolean>(false);
  const [view, setView] = useState<ViewMode>("table");
  const [cost, setCost] = useState<CostSnapshot | null>(null);

  // Pull saved key on first mount + from URL ?key=
  useEffect(() => {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("key");
    if (fromUrl) {
      localStorage.setItem(STORAGE_KEY, fromUrl);
      setDemoKey(fromUrl);
      // Clean the URL so password doesn't stay in the bar
      url.searchParams.delete("key");
      window.history.replaceState(null, "", url.toString());
      return;
    }
    const saved = localStorage.getItem(STORAGE_KEY) ?? "";
    if (saved) setDemoKey(saved);
  }, []);

  async function run() {
    if (!demoKey) {
      setAskKey(true);
      return;
    }
    setStatus("running");
    setTrace([]);
    setOperators([]);
    setError(null);
    setCost(null);

    const resp = await fetch("/api/scout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${demoKey}`
      },
      body: JSON.stringify({ query })
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
    if (ev.event === "result") {
      setOperators(ev.data.operators);
      return;
    }
    if (ev.event === "done") {
      setStatus("done");
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
          <h1 class="text-2xl font-semibold tracking-tight">LongTail Scout</h1>
          <p class="text-sm text-slate-600">Find net-new accounts in markets Apollo can't see. Long-tail prospect scout for vertical-SaaS GTM teams — built on Bright Data, DeepSeek, and a private ~7M-business demand-signal index.</p>
        </div>
      </header>

      <main class="mx-auto max-w-6xl px-6 py-8 space-y-6">
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
        <QueryForm value={query} onChange={setQuery} onRun={run} disabled={status === "running"} />
        {cost && (
          <div class="flex items-center gap-3 rounded border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 shadow-sm">
            <span class="font-medium text-slate-700">Live cost meter:</span>
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
        {operators.length > 0 && (
          <>
            <WedgeSummary operators={operators} niche={query} />
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
            {view === "table" ? <ResultTable operators={operators} /> : <MapView operators={operators} />}
          </>
        )}
      </main>

      <footer class="mx-auto max-w-6xl px-6 py-12 text-xs text-slate-500">
        Built for the Bright Data Web Data UNLOCKED hackathon, May 2026.
      </footer>
    </div>
  );
}
