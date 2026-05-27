# LongTail Scout

**Apollo for the long tail** — an AI agent that finds small, local, niche businesses that Apollo, ZoomInfo, and Clay can't see. Type a niche × city query; get a ranked, cited list of operators with hiring signals and a generated sales angle.

**Live demo:** https://longtailscout.com (gated — password in lablab.ai submission description)
**Source:** https://github.com/dholzric/longtail-scout
**Built for:** [Bright Data "Web Data UNLOCKED" hackathon](https://lablab.ai/ai-hackathons/brightdata-ai-agents-web-data-hackathon), May 2026, Track 1 — GTM Intelligence.

```
You type:     "aerospace and space-tech companies in Houston"
You get:      ~10 ranked operators (Venus Aerospace, Ad Astra Rocket, Windhover Labs,
              FanThom Propulsion, …) with hiring signals, size estimates, recent
              activity, demand scores, and a one-sentence per-row sales angle.
              Every fact is citation-linked back to the Bright Data fetch that
              produced it.
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
                                   │ POST /api/scout (Bearer Piglet)
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
              │  → OpenRouter    │   │ + Bright Data│  │ 3.97M-business   │
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
| Demand signal | Private 3.97M-business demand-signal API, exposed via existing CF Tunnel |

## Why this beats Apollo for long-tail

Apollo, ZoomInfo, Clay are built around the LinkedIn-employee-profile graph. That graph is thin for businesses that:
- Have < 50 employees and don't maintain a corporate LinkedIn page
- Operate in long-tail verticals (aerospace contractors, regional HVAC, niche manufacturing)
- Are small enough to be missed by web crawlers but big enough to have real budget

LongTail Scout sidesteps the LinkedIn graph entirely. It uses Bright Data to crawl the actual operator websites + Google + news in real time, then a private 3.97M-business demand-signal index (curated independently of LinkedIn) for the "is there a real market here?" question.

Demo query that shows it: **"aerospace and space-tech companies in Houston"** — surfaces Venus Aerospace, Ad Astra Rocket, FanThom Propulsion, Windhover Labs, and similar regional operators that Apollo's account list doesn't include.

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

- **Bright Data** — Scraping Browser zone (Browser API) is the only product needed end-to-end for this build.
- **DeepSeek** — discovery and synthesis LLM calls; OpenAI-compatible.
- **Cloudflare** — Workers, KV, Tunnels, Pages assets binding, custom-domain auto-cert.
- **Playwright** (`playwright-core`) — drives Bright Data's remote Chrome via CDP.
- **cheerio** — server-side HTML parsing in the bridge.
- **Preact + Tailwind + Vite** — frontend.

## License

MIT — see [LICENSE](./LICENSE).
