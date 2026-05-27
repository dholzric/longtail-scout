# LongTail Scout

**Live long-tail prospect scout for vertical-SaaS GTM teams.** Find net-new accounts in markets Apollo, ZoomInfo, and Clay can't see — small, local, niche operators whose primary signal is their own website, not LinkedIn. Type a niche × city query; get a ranked, cited list of operators with an ICP-fit reason, hiring signals, and a draft outreach angle.

**Who this is built for:** the GTM teams at vertical SaaS companies — **AccuLynx**, **JobNimbus**, **Roofr** (roofing); **ServiceTitan**, **HousecallPro**, **Jobber** (HVAC / home services); **Brightwheel**, **Procare** (childcare); and the hundred others whose SDRs spend their weeks manually scraping local-trade websites because Apollo's data is database-thin for the long tail.

> **Demo storyline:** type `roofing contractors in Houston` → in 90 seconds, get 8 small-to-mid roofing operators with the kind of evidence an AccuLynx or Roofr SDR would build in a week of manual LinkedIn scraping. These are the operators Apollo doesn't have because they're not on LinkedIn.

**Live demo:** https://longtailscout.com (gated — password in lablab.ai submission description)
**Source:** https://github.com/dholzric/longtail-scout
**Built for:** [Bright Data "Web Data UNLOCKED" hackathon](https://lablab.ai/ai-hackathons/brightdata-ai-agents-web-data-hackathon), May 2026, Track 1 — GTM Intelligence.

```
You type:     "roofing contractors in Houston"
You get:      ~8 ranked operators with hiring signals, size estimates, recent
              activity headlines, a niche-size demand context (~82K matching
              roofing businesses in our 7M-record index), and a one-sentence
              per-row sales angle. Every fact is citation-linked back to the
              Bright Data fetch that produced it.
```

## How it uses Bright Data

The agent runs as a 3-phase hybrid pipeline. Each phase rests on Bright Data infrastructure:

| Phase | What it does | Bright Data leg |
|---|---|---|
| 1. Discovery | LLM fires 3-4 diverse SERP queries in parallel ("aerospace companies Houston", "rocket propulsion Houston", …), dedupes results | Bright Data **Scraping Browser** (Browser API) drives real Chromium against Google → bypass bot detection automatically |
| 2. Enrichment | For each top candidate, pull homepage + careers page + news → extract hiring, size, recent activity | Bright Data **Scraping Browser** renders JS-heavy ATS pages (Greenhouse, Lever, Workday, Ashby); fall through to faster path for plain HTML |
| 3. Synthesis | LLM ranks candidates + writes per-row sales angle, every claim tied back to a source URL | — |

The **Bright Data Scraping Browser** is the central piece — one zone (`longtail_browser`, type `browser_api`) does both SERP rendering and per-site enrichment via the Chrome DevTools Protocol over WebSocket. Because Workers can't host Playwright directly, a tiny **bridge service** runs on the user's home server, connects to the BD WSS endpoint, and exposes two HTTP endpoints (`/render`, `/serp`) that the Worker calls.

```ts
// worker/src/bridge/client.ts — what the Worker calls
export async function bridgeRender(url, opts, auth) {
  return bridgeFetch("/render", { url, ...opts }, auth);
}
export async function bridgeSerp(query, opts, auth) {
  return bridgeFetch("/serp", { query, ...opts }, auth);
}
```

```ts
// bridge/server.ts — what the bridge does (running outside Workers)
import { chromium } from "playwright-core";
const browser = await chromium.connectOverCDP(BRIGHTDATA_BROWSER_WSS);
const page = await (await browser.newContext()).newPage();
await page.goto(url, { waitUntil: "domcontentloaded" });
const html = await page.content();
// → cheerio parses, returns clean JSON
```

The Worker registers the bridge as a tool with the LLM via OpenAI's tool-use API. The LLM decides when to query SERP, doesn't have to know about Bright Data zones, customer IDs, or WSS connections — exactly the surface Bright Data's MCP Server exposes, modeled here.

## Architecture

```
                   ┌────────────────────────────────────────┐
                   │  Browser — Preact + Tailwind SPA       │
                   │  Streams SSE events into a live trace  │
                   └───────────────┬────────────────────────┘
                                   │ POST /api/scout (Bearer <demo-key>)
                                   ▼
                   ┌────────────────────────────────────────┐
                   │  Cloudflare Worker (TypeScript)        │
                   │  Hybrid agent pipeline (3 phases)      │
                   │  KV cache (24h SERP, 7d static pages)  │
                   └─────┬─────────────────┬────────────┬───┘
                         │                 │            │
              LLM (OpenAI-compatible)  Bridge (HTTPS)  Demand API
              ┌──────────────────┐   ┌──────────────┐  ┌──────────────────┐
              │ DeepSeek (primary)│  │ bridge.lts.. │  │ demand.lts...    │
              │  → AI/ML API     │   │ Playwright   │  │ CF Tunnel →      │
              │  → Z.AI GLM-4.6  │   │ + cheerio    │  │ 192.168.1.29:8080│
              │  → OpenRouter    │   │ + Bright Data│  │ ~7M-business   │
              │ fallback chain   │   │ Browser API  │  │ demand-signal DB │
              └──────────────────┘   │ via WSS/CDP  │  └──────────────────┘
                                     └──────────────┘
```

| Layer | Implementation |
|---|---|
| Public hostname | `longtailscout.com` (Cloudflare custom domain → Worker) |
| Bridge hostname | `bridge.longtailscout.com` (Cloudflare Tunnel → home server :8081) |
| Demand-signal hostname | `demand.longtailscout.com` (Cloudflare Tunnel → home server :8080) |
| Compute | Cloudflare Workers (paid plan), TypeScript, Wrangler 3 |
| Frontend | Preact + Tailwind v4 + Vite, ~23 kB JS bundle |
| Storage | Cloudflare KV (cached BD calls, snapshot fallback) |
| LLM | OpenAI-compatible client w/ 4-provider fallback (DeepSeek → AI/ML API → GLM coding-plan → OpenRouter) |
| **Bright Data** | **Scraping Browser** zone via Playwright (`playwright-core`) WSS connection on the bridge |
| Bridge service | Node.js + Playwright + cheerio, ~200 lines |
| Demand signal | Private ~7M-business demand-signal API, exposed via existing CF Tunnel |

## Features

- **3-phase hybrid pipeline:** LLM-driven discovery (Bright Data SERP queries) → deterministic per-candidate enrichment (homepage scrape via Bright Data Browser API, ICP-fit reasoning, hiring/press signal extraction) → LLM synthesis with citations.
- **Vertical prompt packs** — auto-detects roofing / HVAC / childcare / dental / auto / electrician / plumbing queries and injects vertical-specific buyer names (AccuLynx, ServiceTitan, Brightwheel…), signal hints, and ICP-fit examples into the prompts.
- **ICP fit reason column** — a one-line account-intelligence label per row, derived from scraped evidence, not LLM hallucination.
- **Draft outreach angle** — every row has a one-sentence draft outreach line the SDR edits and sends. Labeled "Draft — edit before sending" so trust signal is honest.
- **Map view** — Leaflet + local OSM Nominatim geocodes each operator and pins it on the map. Toggle between Table and Map.
- **Apollo-thin badge** — every operator on its own website (not LinkedIn/Crunchbase/etc.) is labeled `Apollo-thin`. Makes the wedge visible in the UI.
- **Memory layer** — every URL surfaced across queries is remembered in Cloudflare KV. New operators are labeled `New`; recurring ones show `Seen ×N`. Swappable for Cognee/Pinecone — the interface aligns with vector-DB APIs.
- **Live cost meter** — running USD tally of Bright Data renders + DeepSeek tokens shown in the UI throughout the scout. No black-box pricing.
- **CSV export + copy-to-clipboard** — one-click ingest into Apollo, HubSpot, Salesforce, or any CSV-friendly CRM.
- **Demo gate** — Bearer-token auth on `/api/scout` so judges (with the password) can use the demo without paying for bot abuse.

## Why this beats Apollo for long-tail

Apollo, ZoomInfo, Clay are built around the LinkedIn-employee-profile graph. That graph is thin for businesses that:
- Have < 50 employees and don't maintain a corporate LinkedIn page
- Operate in long-tail verticals (aerospace contractors, regional HVAC, niche manufacturing)
- Are small enough to be missed by web crawlers but big enough to have real budget

LongTail Scout sidesteps the LinkedIn graph entirely. It uses Bright Data to crawl the actual operator websites + Google + news in real time, then a private ~7M-business demand-signal index (curated independently of LinkedIn) for the "is there a real market here?" question.

Demo query that shows it: **"roofing contractors in Houston"** — surfaces the small + mid roofing contractors that Apollo/ZoomInfo/Clay can't see, with hiring signals scraped from their actual careers pages. Roofing has ~82,000 matching businesses in the demand index (out of ~7M total).

## Run it yourself

```bash
git clone https://github.com/dholzric/longtail-scout
cd longtail-scout
pnpm -C worker install
pnpm -C web install
pnpm -C bridge install

# Copy worker/.dev.vars.example to worker/.dev.vars and fill in keys
# Copy bridge/.env.example to bridge/.env and fill in keys

# Start the bridge on a host that can reach Bright Data via WSS
cd bridge && pnpm start

# In another terminal: start the Worker locally
pnpm dev:worker

# In another terminal: start the frontend with /api proxied to local Worker
pnpm dev:web
```

Deploy: `pnpm deploy` from the repo root (builds web/dist, then runs `wrangler deploy`).

## Tech credits

- **Bright Data** — Scraping Browser zone (`browser_api`) is the only BD product needed end-to-end for this build. Powers SERP via rendered google.com searches and per-operator homepage rendering. WSS/CDP only → bridge service required.
- **DeepSeek** — discovery and synthesis LLM calls; OpenAI-compatible, fast tool-use, $0.27/1M input. **Total LLM spend in this build: <$1.**
- **Cloudflare** — Workers, KV, Tunnels, Pages assets binding, custom-domain auto-cert.
- **OpenStreetMap + Nominatim** (self-hosted) — geocoding for the map view, unlimited usage.
- **Playwright (`playwright-core`)** — drives Bright Data's remote Chrome via CDP from the bridge.
- **Cheerio** — server-side HTML parsing in the bridge for SERP extraction.
- **Preact + Tailwind v4 + Vite + Leaflet** — frontend.
- **AI/ML API / Z.AI GLM / OpenRouter** — configured fallback LLM providers if DeepSeek is unavailable.

## What's next

- **Saved searches / weekly monitoring** — type a niche × city, get a notification every Monday with the new operators that have hit your radar since last week.
- **Cognee or Pinecone swap** for the memory layer — replace the KV-backed store with a real vector DB so we can also surface "operators similar to this one" cross-niche.
- **CRM connectors** — direct push to HubSpot / Salesforce / Apollo CSV import, beyond the manual CSV export.
- **Vertical packs for the next 30 niches** — current packs are 7. Roofing/HVAC-class verticals number in the hundreds; each pack is ~30 minutes to write.
- **Triggerware / Speechmatics** — voice query and event-driven re-runs as additional partner integrations.
- **Playwright** (`playwright-core`) — drives Bright Data's remote Chrome via CDP.
- **cheerio** — server-side HTML parsing in the bridge.
- **Preact + Tailwind + Vite** — frontend.

## License

MIT — see [LICENSE](./LICENSE).
