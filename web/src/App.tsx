import { useState } from "preact/hooks";
import { readSse } from "./sse";
import type { Operator, SseEvent } from "./types";

type Status = "idle" | "running" | "done" | "error";

interface TraceEntry { event: string; data: unknown; ts: number }

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
          <p class="text-sm text-slate-600">Apollo for the long tail — built on Bright Data, OpenRouter, and your own demand-signal index.</p>
        </div>
      </header>

      <main class="mx-auto max-w-6xl px-6 py-8 space-y-6">
        <div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <label class="block text-sm font-medium text-slate-700 mb-2">Niche × city</label>
          <div class="flex gap-2">
            <input
              class="flex-1 rounded border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
              type="text"
              value={query}
              onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
              placeholder="aerospace companies in Houston"
              disabled={status === "running"}
            />
            <button
              class="rounded bg-slate-900 px-4 py-2 text-white disabled:bg-slate-300"
              onClick={run}
              disabled={status === "running"}
            >
              {status === "running" ? "Running…" : "Run"}
            </button>
          </div>
        </div>

        {error && <div class="rounded border border-red-300 bg-red-50 p-4 text-red-800">Error: {error}</div>}

        {(status === "running" || trace.length > 0) && (
          <div class="rounded-lg border border-slate-200 bg-slate-900 text-slate-100 shadow-sm">
            <div class="flex items-center justify-between border-b border-slate-700 px-4 py-2">
              <span class="text-xs font-medium uppercase tracking-wider text-slate-300">
                Agent trace {status === "running" && <span class="ml-2 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />}
              </span>
              <span class="text-xs text-slate-400">{trace.length} events</span>
            </div>
            <div class="h-72 overflow-auto px-4 py-2 font-mono text-xs whitespace-pre-wrap">
              {trace.map((e, i) => (
                <div key={i}>[{e.event}] {JSON.stringify(e.data).slice(0, 200)}</div>
              ))}
            </div>
          </div>
        )}

        {operators.length > 0 && (
          <div class="rounded-lg border border-slate-200 bg-white shadow-sm p-6">
            <h2 class="text-base font-semibold mb-3">Results — {operators.length} operators</h2>
            <pre class="text-xs overflow-auto">{JSON.stringify(operators, null, 2)}</pre>
          </div>
        )}
      </main>

      <footer class="mx-auto max-w-6xl px-6 py-12 text-xs text-slate-500">
        Built for the Bright Data Web Data UNLOCKED hackathon, May 2026.
      </footer>
    </div>
  );
}
