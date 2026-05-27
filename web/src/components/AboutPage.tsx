export function AboutPage() {
  return (
    <div class="min-h-screen bg-slate-50 text-slate-900">
      <header class="border-b border-slate-200 bg-white">
        <div class="mx-auto max-w-4xl px-6 py-5 flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-semibold tracking-tight">LongTail Scout — How it works</h1>
            <p class="text-sm text-slate-600">The agent, the data, the moat.</p>
          </div>
          <a class="text-sm text-blue-700 underline" href="/">← Back to demo</a>
        </div>
      </header>

      <main class="mx-auto max-w-4xl px-6 py-10 space-y-10 text-slate-800">

        <section>
          <h2 class="text-xl font-semibold mb-3">The job-to-be-done</h2>
          <p class="text-sm leading-relaxed">
            LongTail Scout finds the small, local, niche business operators that Apollo, ZoomInfo, and Clay
            can't see — Bob's Roofing LLC, Hargrove HVAC, Brightway Childcare, the kind of accounts whose
            primary signal is their own website, not a LinkedIn corporate page. The customers for this list
            are the vertical-SaaS GTM teams at <strong>AccuLynx, ServiceTitan, JobNimbus, Brightwheel,
            HousecallPro, Roofr, Procare, ConnectWise</strong>, and dozens more. They each pay six figures
            a year for SDRs to build these lists by hand.
          </p>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3">The 3-phase pipeline</h2>
          <pre class="bg-slate-900 text-slate-100 rounded p-4 text-xs overflow-auto whitespace-pre">{`┌──────────── Query ─────────────┐
│ "roofing contractors in Houston"│
└───────────┬────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────────┐
│ PHASE 1 — DISCOVERY                                          │
│ Vertical pack auto-detected → ICP-tuned discovery prompt     │
│ LLM (DeepSeek) fires 3-4 SERP queries via Bright Data        │
│ Scraping Browser; dedupes against 100+ aggregator blocklist  │
└──────────────────────┬───────────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ PHASE 2 — ENRICHMENT (deterministic, 2 concurrent)           │
│ Per candidate: render homepage via Bright Data Browser API   │
│   • extract about, size estimate, hiring keywords            │
│   • find /careers and /press links on the homepage HTML      │
│   • Nominatim geocode (operator name + city)                 │
└──────────────────────┬───────────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ PHASE 3 — SYNTHESIS                                          │
│ Niche-level demand lookup against private 7M-business index  │
│ LLM ranks + writes ICP fit reason + draft outreach angle     │
│ + confidence score per operator                              │
│ Operators streamed one-by-one to the UI                      │
│ Each operator recorded in KV memory (new vs seen Nx)         │
└──────────────────────────────────────────────────────────────┘`}</pre>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3">Why Bright Data is the spine</h2>
          <p class="text-sm leading-relaxed mb-3">
            We use Bright Data's <strong>Scraping Browser</strong> zone (Browser API) as the only scraping
            surface needed end-to-end. It powers both phases: SERP queries (we render google.com directly
            and parse the DOM with cheerio) AND per-operator homepage rendering. Because the Browser API is
            WSS/CDP-only — not REST — and Cloudflare Workers can't host Playwright, we run a 200-line bridge
            service on a home server that proxies CDP to HTTP. The Worker hits <code>bridge.longtailscout.com</code>,
            never the BD endpoint directly.
          </p>
          <p class="text-sm leading-relaxed">
            One zone (<code>lts_browser</code>, type <code>browser_api</code>) handles every page-render call
            in the pipeline. Total per-run cost: $0.04–0.05.
          </p>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3">The moat: a private 7M-business demand index</h2>
          <p class="text-sm leading-relaxed">
            The agent has access to a private 7-million-record business demand index (built independently of
            LinkedIn from Google Maps scrapes) hosted at <code>demand.longtailscout.com</code>. For every
            query we look up the niche keyword and pass the result count as <em>market-size context</em> to
            the synthesis LLM. This is why "roofing in Houston" knows it has 82,000 nearby operators in the
            index — the LLM ranks long-tail-fit accordingly. Apollo doesn't have this.
          </p>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3">Tech stack</h2>
          <table class="w-full text-sm border-collapse">
            <tbody>
              <tr class="border-b border-slate-200"><td class="py-1.5 font-medium w-44">Compute</td><td>Cloudflare Workers (paid plan), TypeScript</td></tr>
              <tr class="border-b border-slate-200"><td class="py-1.5 font-medium">Frontend</td><td>Preact + Tailwind v4 + Vite + Leaflet</td></tr>
              <tr class="border-b border-slate-200"><td class="py-1.5 font-medium">Cache + memory</td><td>Cloudflare KV (24h SERP, 7d static, 90d memory)</td></tr>
              <tr class="border-b border-slate-200"><td class="py-1.5 font-medium">LLM</td><td>DeepSeek (OpenAI-compat) with GLM + OpenRouter fallback</td></tr>
              <tr class="border-b border-slate-200"><td class="py-1.5 font-medium">Bright Data</td><td>Scraping Browser zone — only product needed end-to-end</td></tr>
              <tr class="border-b border-slate-200"><td class="py-1.5 font-medium">Bridge</td><td>Node.js + Playwright (core) + cheerio</td></tr>
              <tr class="border-b border-slate-200"><td class="py-1.5 font-medium">Geocoding</td><td>OpenStreetMap Nominatim (self-hosted, unlimited)</td></tr>
              <tr class="border-b border-slate-200"><td class="py-1.5 font-medium">Tunnel</td><td>Cloudflare Tunnel (bridge.longtailscout.com → home server)</td></tr>
              <tr class="border-b border-slate-200"><td class="py-1.5 font-medium">Voice input</td><td>Web Speech API (Chrome/Edge native)</td></tr>
              <tr class="border-b border-slate-200"><td class="py-1.5 font-medium">CSV export</td><td>Client-side, ready for Apollo / HubSpot / Salesforce</td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3">Features at a glance</h2>
          <ul class="text-sm leading-relaxed list-disc list-inside space-y-1">
            <li>20 vertical prompt packs (roofing, HVAC, dental, childcare, MSP, legal, ...)</li>
            <li>ICP fit reason + draft outreach angle per operator</li>
            <li>Apollo-thin / New / Seen×N / city badges</li>
            <li>Confidence score (0-100) per row</li>
            <li>Filter by confidence, hiring, long-tail size</li>
            <li>Map view (Leaflet + OSM Nominatim)</li>
            <li>Multi-city batch (state-level queries → top-3 cities, globally re-ranked)</li>
            <li>Outreach kit (copy email subject/body, mailto: deep links)</li>
            <li>CSV export + clipboard copy</li>
            <li>Voice input (Web Speech API)</li>
            <li>Saved queries (localStorage)</li>
            <li>Shareable URLs (?q=...&run=1)</li>
            <li>Live cost meter (BD + LLM USD streaming)</li>
            <li>Wedge summary banner ("why these wouldn't be in Apollo")</li>
            <li>Memory layer (KV-backed, swappable for Cognee/Pinecone)</li>
            <li>Streaming synthesis (operators appear one-by-one)</li>
            <li>Sample mode (?sample=1) — 140ms canned response for demo reliability</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3">What's next</h2>
          <ul class="text-sm leading-relaxed list-disc list-inside space-y-1">
            <li>Watchlist + weekly re-runs via Cloudflare Cron Triggers — turn discovery into recurring intel</li>
            <li>CRM connectors (HubSpot, Salesforce) beyond manual CSV</li>
            <li>Real Bright Data MCP Server integration for LLM tool-use (sponsor pattern)</li>
            <li>Heat-map underlay on the map view using the demand-API's geotagged records</li>
            <li>Tech-stack detection (BuiltWith-style) per operator</li>
            <li>Recent-funding signal (Crunchbase via Bright Data)</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3">Origin</h2>
          <p class="text-sm leading-relaxed">
            Built for the <a class="text-blue-700 underline" href="https://lablab.ai/ai-hackathons/brightdata-ai-agents-web-data-hackathon">Bright Data "Web Data UNLOCKED" hackathon</a>,
            May 2026 (Track 1 — GTM Intelligence). Private repo; source shared with judges for evaluation.
          </p>
        </section>

      </main>

      <footer class="mx-auto max-w-4xl px-6 py-12 text-xs text-slate-500">
        © 2026 LongTail Scout · Built on Bright Data Scraping Browser, DeepSeek, Cloudflare, OSM Nominatim.
      </footer>
    </div>
  );
}
