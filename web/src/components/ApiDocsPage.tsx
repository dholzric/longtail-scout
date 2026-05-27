/**
 * Public API reference page at /api or /docs. Lists every public endpoint the worker
 * exposes, with curl examples and response schemas. Built for technical judges who
 * want to verify the platform is real and inspect-able, not just a UI demo.
 */
export function ApiDocsPage() {
  return (
    <div class="min-h-screen bg-slate-50 text-slate-900">
      <header class="border-b border-slate-200 bg-white">
        <div class="mx-auto max-w-4xl px-6 py-5 flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-semibold tracking-tight">LongTail Scout — API Reference</h1>
            <p class="text-sm text-slate-600">Public endpoints, curl examples, response shapes.</p>
          </div>
          <a class="text-sm text-blue-700 underline" href="/">← Back to demo</a>
        </div>
      </header>

      <main class="mx-auto max-w-4xl px-6 py-10 space-y-8 text-slate-800">
        <section>
          <h2 class="text-base font-semibold">Authentication</h2>
          <p class="mt-1 text-sm text-slate-700">
            All POST endpoints (and screenshot via header) require a <code class="rounded bg-slate-100 px-1 py-0.5 text-xs">Bearer &lt;demo-password&gt;</code> in
            the <code class="rounded bg-slate-100 px-1 py-0.5 text-xs">Authorization</code> header. The demo password
            is in the lablab.ai submission description. GET endpoints that need auth also accept
            <code class="rounded bg-slate-100 px-1 py-0.5 text-xs">?key=&lt;password&gt;</code>.
          </p>
        </section>

        <Endpoint
          method="GET"
          path="/api/health"
          summary="Liveness check — no auth"
          example={`curl https://longtailscout.com/api/health`}
          response={`{ "ok": true, "ts": 1779870000000 }`}
        />

        <Endpoint
          method="POST"
          path="/api/scout"
          summary="Run a long-tail scout for a niche × city or state. Streams an SSE event log + per-operator results."
          example={`curl -N -X POST https://longtailscout.com/api/scout \\
  -H "authorization: Bearer <pw>" \\
  -H "content-type: application/json" \\
  -d '{"query":"roofing contractors in Houston"}'`}
          response={`event: phase
data: {"phase":"discovery"}

event: candidate
data: {"name":"...","url":"https://..."}

event: cost
data: {"bd_renders":3,"llm_calls":2,"bd_usd":0.015,"llm_usd":0.003,"total_usd":0.018}

event: operator
data: { /* full Operator object */ }

event: done
data: {}
`}
          notes="Append ?sample=1 for canned, deterministic responses (no real BD/LLM spend, ~140ms). Sample mode returns a clear stub if the niche has no canned sample (does NOT silently fall through to live)."
        />

        <Endpoint
          method="GET"
          path="/api/businesses?q={niche}&city={city}&limit={n}"
          summary="Proxy to the internal demand-API (7M+ Google Maps records). Returns deduped geotagged businesses for the heat-map underlay."
          example={`curl 'https://longtailscout.com/api/businesses?q=roofing&city=Houston&limit=50'`}
          response={`{
  "query": "roofing",
  "city": "Houston",
  "count": 16,
  "businesses": [
    { "name": "Amstill Roofing", "lat": 29.77, "lng": -95.59, "rating": 4.9, "review_count": 1708, "website": "...", "category": "Roofing contractor", "address": "..." }
  ]
}`}
          notes="KV-cached 1 hour. Deduped by lat/lng+name, keeps the row with highest review_count per cluster."
        />

        <Endpoint
          method="GET"
          path="/api/screenshot?url={target}&w=1024&h=640"
          summary="Live homepage screenshot via Bright Data Browser API. Returns image/png with 30-day KV cache."
          example={`curl -o shot.png 'https://longtailscout.com/api/screenshot?url=https%3A%2F%2Fexample.com&w=1024&h=640&key=<pw>'`}
          response={`<binary PNG bytes>
Headers: content-type: image/png, x-shot-cache: hit | live`}
          notes="Accepts ?key= for img-tag use (the browser can't send Authorization headers on <img> elements)."
        />

        <Endpoint
          method="POST"
          path="/api/draft-email"
          summary="Generate a personalized cold email for one operator. References operator about + hiring + recent_activity."
          example={`curl -X POST https://longtailscout.com/api/draft-email \\
  -H "authorization: Bearer <pw>" \\
  -H "content-type: application/json" \\
  -d '{"operator":{ /* Operator */ }, "buyer":{ "product":"AccuLynx", "vertical":"roofing" }}'`}
          response={`{
  "subject": "Braun's Roofing: 2 open roles, SaaS fit?",
  "body": "Hi, Noticed Braun's has been in Houston since 1987...",
  "provider": "deepseek",
  "estimated_cost_usd": 0.000217
}`}
        />

        <Endpoint
          method="GET / POST / DELETE"
          path="/api/watchlist[/:id]"
          summary="CRUD on saved-query watchlist. GET returns all watches; POST {query} creates one; DELETE removes by id."
          example={`# Add to watchlist
curl -X POST https://longtailscout.com/api/watchlist \\
  -H "authorization: Bearer <pw>" -H "content-type: application/json" \\
  -d '{"query":"HVAC contractors in Dallas"}'

# List watches
curl 'https://longtailscout.com/api/watchlist?key=<pw>'`}
          response={`{
  "watches": [
    {
      "id": "watch:...",
      "query": "HVAC contractors in Dallas",
      "created_at": 1779870000000,
      "last_run_at": null,
      "last_demand_count": 30,
      "previous_demand_count": 27
    }
  ]
}`}
        />

        <Endpoint
          method="GET"
          path="/api/cron/watchlist-refresh"
          summary="Manual trigger for the daily cron (also fires automatically at 13:00 UTC). Refreshes demand-API counts on every saved watch and stores deltas."
          example={`curl 'https://longtailscout.com/api/cron/watchlist-refresh?key=<pw>'`}
          response={`{ "refreshed": 7, "failed": 0, "details": [ /* per-watch prev/current/delta */ ] }`}
        />

        <section>
          <h2 class="text-base font-semibold">Stack &amp; SLAs</h2>
          <ul class="mt-2 list-disc pl-5 text-sm text-slate-700 space-y-1">
            <li>Worker: Cloudflare Workers (TypeScript), bound to <code class="bg-slate-100 px-1 rounded">longtailscout.com</code> + KV namespace <code class="bg-slate-100 px-1 rounded">CACHE</code></li>
            <li>Bridge: Playwright sidecar on a home server, serializes Bright Data Browser API renders via mutex + proactive session recycle every 6 navs</li>
            <li>LLM: DeepSeek primary, AI/ML API + GLM coding-plan fallbacks (see <code class="bg-slate-100 px-1 rounded">worker/src/llm/client.ts</code>)</li>
            <li>Geocoding: self-hosted Nominatim, unlimited</li>
            <li>Demand-API: FastAPI on a home server, 7M+ Google Maps business records</li>
          </ul>
        </section>

        <section class="text-xs text-slate-500">
          Public repo: <a class="text-blue-700 underline" href="https://github.com/dholzric/longtail-scout">github.com/dholzric/longtail-scout</a>
        </section>
      </main>
    </div>
  );
}

function Endpoint({ method, path, summary, example, response, notes }: {
  method: string;
  path: string;
  summary: string;
  example: string;
  response: string;
  notes?: string;
}) {
  return (
    <section class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div class="flex items-baseline gap-3">
        <span class={`rounded px-2 py-0.5 text-[11px] font-semibold ring-1 ${methodColor(method)}`}>{method}</span>
        <code class="text-sm font-semibold">{path}</code>
      </div>
      <p class="mt-2 text-sm text-slate-700">{summary}</p>
      <div class="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <div class="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">Example</div>
          <pre class="overflow-auto rounded bg-slate-900 p-3 text-[11px] text-slate-100 whitespace-pre">{example}</pre>
        </div>
        <div>
          <div class="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">Response</div>
          <pre class="overflow-auto rounded bg-slate-50 p-3 text-[11px] text-slate-700 ring-1 ring-slate-200 whitespace-pre">{response}</pre>
        </div>
      </div>
      {notes && <p class="mt-2 text-xs text-slate-500"><strong>Note:</strong> {notes}</p>}
    </section>
  );
}

function methodColor(m: string): string {
  if (m.includes("GET")) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (m.includes("POST")) return "bg-sky-50 text-sky-700 ring-sky-200";
  if (m.includes("DELETE")) return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-slate-50 text-slate-700 ring-slate-200";
}
