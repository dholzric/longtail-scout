import { useState } from "preact/hooks";
import { readSse } from "./sse";
import type { Operator, SseEvent } from "./types";
import { QueryForm } from "./components/QueryForm";
import { AgentTrace, type TraceEntry } from "./components/AgentTrace";
import { ResultTable } from "./components/ResultTable";

type Status = "idle" | "running" | "done" | "error";

export function App() {
  const [query, setQuery] = useState("aerospace and space-tech companies in Houston");
  const [status, setStatus] = useState<Status>("idle");
  const [trace, setTrace] = useState<TraceEntry[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setStatus("running");
    setTrace([]);
    setOperators([]);
    setError(null);

    const resp = await fetch("/api/scout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query })
    });
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

  function ingest(ev: SseEvent) {
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
          <p class="text-sm text-slate-600">Apollo for the long tail — built on Bright Data, OpenRouter, and a private demand-signal index.</p>
        </div>
      </header>

      <main class="mx-auto max-w-6xl px-6 py-8 space-y-6">
        <QueryForm value={query} onChange={setQuery} onRun={run} disabled={status === "running"} />
        {error && <div class="rounded border border-red-300 bg-red-50 p-4 text-red-800">Error: {error}</div>}
        {(status === "running" || trace.length > 0) && (
          <AgentTrace entries={trace} running={status === "running"} />
        )}
        {operators.length > 0 && <ResultTable operators={operators} />}
      </main>

      <footer class="mx-auto max-w-6xl px-6 py-12 text-xs text-slate-500">
        Built for the Bright Data Web Data UNLOCKED hackathon, May 2026.
      </footer>
    </div>
  );
}
