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

### Discovery & enrichment
- **3-phase hybrid pipeline:** LLM-driven discovery (Bright Data SERP queries) → deterministic per-candidate enrichment (homepage scrape via Bright Data Browser API, ICP-fit reasoning, hiring/press signal extraction) → LLM synthesis with citations.
- **25 vertical prompt packs** — auto-detects roofing / HVAC / childcare / dental / auto / electrician / plumbing / legal / MSP / accounting / fitness / restaurant / hotel / real-estate / landscaping / marketing-agency / insurance-broker / salon / vet / trucking / medical-specialty / food-truck / brewery / photographer / jewelry queries and injects vertical-specific buyer names (AccuLynx, ServiceTitan, Brightwheel, Clio, …), signal hints, and ICP-fit examples into the prompts.
- **Multi-city batch** — type "roofers in Texas" → expands to top 3 cities and globally re-ranks by confidence × per-city rank.
- **Streaming synthesis** — operators appear one-by-one in the UI as they're ranked.
- **Sample mode** (`?sample=1`) — canned 140 ms response with full SSE event flow for guaranteed-fast demos. 4 verticals seeded (roofing, HVAC, childcare, dental in Houston). Live pipeline also auto-falls-back to sample if BD/LLM errors.

### Per-operator intelligence
- **ICP fit reason** — a one-line account-intelligence label per row, derived from scraped evidence, not LLM hallucination.
- **Draft outreach angle** — every row has a one-sentence draft outreach line the SDR edits and sends. Labeled "Draft — edit before sending" so trust signal is honest.
- **Confidence score (0-100)** — derived from citation count + data depth + hostname-name match. Rank answers "who first?"; confidence answers "how much do I trust this row?"
- **Apollo-thin badge** — every operator on its own website (not LinkedIn/Crunchbase/etc.) is labeled `Apollo-thin`.
- **Memory layer** — every URL surfaced across queries is remembered in Cloudflare KV. New operators are labeled `New`; recurring ones show `Seen ×N`. Swappable for Cognee/Pinecone — the interface aligns with vector-DB APIs.
- **City badge** in multi-city results; **favicons** next to each operator's name.
- **Outreach kit** in the drill-down — copy email subject/body, `mailto:` deep link, vertical-specific template.
- **SDR notes** per operator — private localStorage scratchpad ("called Tuesday, no answer").

### UI / workflow
- **Map view** — Leaflet + local OSM Nominatim geocodes each operator and pins it on the map. Toggle between Table and Map.
- **Heat-map underlay** — colored circle markers underneath the operator pins, drawn from the 7M-record demand index. Color encodes rating, radius encodes review-count. Visualizes the entire niche density, not just the LLM's picks.
- **Homepage screenshots** — each drill-down lazy-loads a real homepage screenshot via Bright Data Browser API, cached 30 days in KV. Demonstrates the BD browser path live.
- **AI-personalized cold email** — `/api/draft-email` calls DeepSeek with the operator's about + hiring + recent_activity + buyer context, returns a 100-word personalized email (~$0.0002/call). Sits next to the static template option in the drill-down.
- **Apollo vs LongTail comparison panel** — side-by-side wedge proof. Hardcoded per-vertical Apollo counterfactuals (national franchises, dead LinkedIn profiles, aggregators) contrasted with actual LongTail results.
- **Wedge summary banner** — quantifies the Apollo gap above the table (citations, hiring, geocoded, new-to-index).
- **Per-city breakdown** — bar chart of operators-per-city when a state-level query expanded into 2+ metros.
- **Demand-index live probe** — small badge under the query input shows "N businesses match this niche in our 7M-record index" the moment a niche is typed (debounced, KV-cached).
- **Live cost meter** — running USD tally of Bright Data renders + DeepSeek tokens shown sticky-at-top throughout the scout.
- **3-phase progress strip** — Discovery → Enrichment → Synthesis chips above the raw trace log, with current-phase highlight.
- **Filter + sort table** — min-confidence slider, hiring-only toggle, long-tail-only toggle; click column headers to sort.
- **CSV export + copy-to-clipboard** — one-click ingest into Apollo, HubSpot, Salesforce. Filters apply.
- **Voice input** — Web Speech API native (Chrome/Edge), no partner integration required.
- **One-click vertical demo chips** — 8 emoji-tagged niche×city presets (Roofing·Houston, HVAC·Dallas, …). Click to instantly run; every chip has cached sample data so judges can stress-test at zero cost via `?sample=1`.
- **Saved queries chips** + **shareable URLs** (`?q=<query>&run=1` auto-fills + auto-runs) + **per-operator permalinks** (`?op=<hash>` auto-expands a specific row).
- **Social-share snippets** — copy-paste-ready Twitter/LinkedIn posts summarizing the just-completed run with the Apollo-vs-LongTail framing.
- **First-visit onboarding card** — three "what to click" steps, dismissible.
- **Watchlist** — server-side saved queries with new-vs-seen tracking on every re-run.
- **CF Cron Triggers** — daily 13:00 UTC refresh of demand-API counts per watch, surfaces "+N businesses since yesterday" badges in the UI without spending real BD/LLM dollars per cron tick.
- **Keyboard shortcuts** — Cmd/Ctrl+Enter runs, Cmd/Ctrl+K focuses the input.
- **`/about`** — how-it-works diagram, full feature list, tech stack table. **`/docs`** — public API reference with curl examples.
- **Skeleton loading rows** during the pipeline; **sample-mode banner** when active.
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

- **Bright Data MCP Server** — wrap the existing /api/scout, /api/businesses, /api/screenshot, /api/draft-email endpoints as MCP tools so any MCP-aware client (Claude Desktop, ChatGPT MCP, etc.) can call them directly. The HTTP/SSE shape is already in place.
- **CRM connectors** — direct push to HubSpot / Salesforce / Apollo CSV import, beyond the manual CSV export.
- **Per-operator screenshot diffs** — recapture once a quarter; flag operators whose homepages have materially changed (homepage refresh ≈ leadership change ≈ trigger event).
- **Slack/Discord webhook** — wire the watchlist cron to ping a channel when `+N new operators` lands.
- **Vertical packs for the next 50 niches** — current packs are 25.

## License

Proprietary. All rights reserved. This codebase is shared with hackathon judges for evaluation only and is not licensed for redistribution or reuse.
