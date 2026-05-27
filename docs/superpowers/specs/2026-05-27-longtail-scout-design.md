# LongTail Scout — Design Spec

**Status:** Draft for user review
**Owner:** Dan Holzrichter
**Date:** 2026-05-27
**Submission deadline:** 2026-05-30 (Bright Data Web Data UNLOCKED hackathon, online track)
**Working directory:** `E:\hack2`

> An AI agent that takes a niche × city query and returns a ranked, enriched, citation-backed list of operators — focused on the long-tail businesses that Apollo, ZoomInfo, and Clay can't see. Built on Bright Data's MCP Server + SERP API + Web Scraper API + Web Unlocker, with enrichment from a private 3.97M-business demand-signal API.

---

## 1. Goals & non-goals

### Goals

- Win or place in **Track 1: GTM Intelligence** of Bright Data's "Web Data UNLOCKED" hackathon (online pool, $700 per track).
- Ship a single public demo URL where judges can run a real query and see real, cited results in under 90 seconds.
- Demonstrably use Bright Data **MCP Server + SERP API + Web Scraper API + Web Unlocker** as the primary integration, with **Scraping Browser** invoked conditionally for JS-heavy careers pages.
- Position the product as fundable post-hackathon — eligible for the Bright Data AI Startup Program ($20K credits) and credible to angel/seed investors.

### Non-goals (for the hackathon MVP)

- No login, no auth, no accounts.
- No CRM export. Show the table; mention CSV/HubSpot in slides as "next."
- No multi-city batch. One niche × one city per run.
- No monitoring or alerts ("changes over time"). Single-shot enrichment only.
- No mobile-optimized UI. Desktop demo is the target.
- No agent memory layer. (Cognee has a partner prize, but adding agent memory in 4 days while shipping the core product is not realistic. Defer.)

---

## 2. Product summary

### The pitch

> *"Apollo for the long tail. Any niche × any city, in 90 seconds, with demand scores from 4M businesses and live web signals — for the operators Apollo can't see."*

### Demo storyline (90-second video for judges)

1. **0:00–0:10** Title card + problem statement: *"Apollo and ZoomInfo can't see the long tail — small, local, niche operators. We can."*
2. **0:10–0:25** Show the input form. Type: **"Aerospace and space-tech companies in Houston, under 100 employees."** Click Run.
3. **0:25–0:55** Watch the agent stream its work live — phase-by-phase: *"Searching SERP API for aerospace Houston… found 47 candidates. Pulling websites via Web Unlocker… extracting pricing, hiring, recent activity… enriching with demand signal…"*
4. **0:55–1:20** Result table renders. ~15 ranked rows. Each row: name, URL, est. size, **hiring (e.g., "Yes — 4 open RF engineer roles")**, **last web activity**, **demand-score**, and a generated one-line **sales angle** ("Posted 4 RF engineer roles in 30 days, mentions Lunar Gateway — likely chasing Axiom subcontract.").
5. **1:20–1:30** Click a row → drill-down panel with cited sources (each fact links back to the Bright Data fetch that produced it). End card: *"Built on Bright Data MCP + SERP API + Web Scraper API + Web Unlocker."*

### Demo vertical: aerospace in Houston

Chosen because:
- Genuinely long-tail (small NASA/SpaceX subcontractors, avionics shops, machine shops feeding primes — not on LinkedIn, not in Apollo).
- Visually compelling — "I found every space company in Houston no one's heard of" is a sharable demo title.
- Geographic story is defensible (the user is filming from Houston this weekend).
- Aerospace sites are exactly the kind of crufty + JS-heavy + geo-tagged content that justifies *needing* Web Unlocker and Scraping Browser — flexes Bright Data.
- Real buyer set exists (primes have BD teams sourcing suppliers; VCs hunt space startups; defense recruiters need lists).

The product is **any niche × any city**; aerospace-Houston is the chosen demo flavor only.

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser (judges' demo)                                             │
│  Static SPA — Preact + Tailwind, streams via fetch + EventSource    │
└────────────────────────────┬────────────────────────────────────────┘
                             │ POST /api/scout (SSE)
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Cloudflare Worker (TypeScript, wrangler, paid plan)                │
│  ────────────────────────────────────────────────                   │
│  Hybrid agent pipeline:                                             │
│    Phase 1 (discovery)  — Claude tool-use loop, 1-2 turns           │
│    Phase 2 (enrichment) — deterministic, parallel, per candidate    │
│    Phase 3 (synthesis)  — single Claude call, structured output     │
│  Streams progress via Server-Sent Events (TransformStream)          │
└──────┬────────────────────────────┬──────────────────────────────┬──┘
       │                            │                              │
       ▼                            ▼                              ▼
┌─────────────────┐     ┌────────────────────────┐     ┌───────────────────┐
│ Bright Data MCP │     │ Demand-signal API      │     │ Cloudflare KV     │
│ Server (HTTPS)  │     │ via existing CF Tunnel │     │ Cache tool calls  │
│  • SERP API     │     │ demand.longtailscout.com    │     │ by (tool, args)   │
│  • Web Scraper  │     │   → 192.168.1.29:8080  │     │ TTL: 24h-7d       │
│  • Web Unlocker │     │ /api/research          │     │                   │
│  • Scraping Br. │     │                        │     │                   │
└─────────────────┘     └────────────────────────┘     └───────────────────┘
```

### Stack choices

| Layer | Pick | Why |
|---|---|---|
| Hosting | Cloudflare Worker + Pages (or Worker with static asset binding) | One `wrangler deploy`; user is already on the CF ecosystem with tokens and paid plan. |
| Frontend | Preact + Tailwind, static SPA | No SSR needed; one HTML + one JS bundle. Avoids Next.js complexity in 4 days. |
| Backend | Single TypeScript Worker | Handles `/api/scout` streaming endpoint. |
| Streaming | SSE via TransformStream | Workers stream natively; UI consumes via `EventSource`. |
| LLM | Claude Sonnet 4.6 via Anthropic SDK (works in Workers) | Best-in-class tool use; user has Anthropic API token. |
| LLM fallback | AI/ML API partner credits | Use for synthesis only if Anthropic 529s during judging. |
| Bright Data | MCP Server (HTTP) | Featured/named integration; signals "Application of Technology" criterion clearly. |
| Cache | Cloudflare KV | Tool calls deterministic on `(tool, args)` — KV is the natural fit. |
| Demand signal | Existing API at `192.168.1.29:8080` exposed via existing CF Tunnel | Reuses user's 4M-business demand DB without ETL. Tunnel infrastructure is already provisioned. |
| Domain | `longtailscout.com` (registered on Cloudflare, same account as Worker) | Public demo URL for lablab submission. `demand.longtailscout.com` for the tunneled demand-signal API. |
| Repo | GitHub, public, MIT license | Hackathon submission requirement. |

### Reuse vs. rebuild

**Reuse:**
- The demand-signal API at `192.168.1.29:8080` (the moat — without it this is a generic Apollo clone).
- The user's existing Cloudflare Tunnels (one hostname-add away from publishing the demand API).

**Do not reuse:**
- `pinchtab-scraper`, OverlordNG2, DirectoryNG, NordVPN trio. Bright Data replaces the entire bottom layer. Don't try to make Rust binaries fit a 4-day timeline.

---

## 4. Components

### File layout

```
E:\hack2\
├── worker\
│   ├── src\
│   │   ├── index.ts                    # Worker entry; routes /api/scout (SSE), /api/health, serves index.html
│   │   ├── agent\
│   │   │   ├── discovery.ts            # Phase 1: Claude tool-use loop, returns candidate list
│   │   │   ├── enrich.ts               # Phase 2: deterministic fan-out per candidate
│   │   │   └── synthesize.ts           # Phase 3: single Claude call, structured output
│   │   ├── brightdata\
│   │   │   ├── mcp.ts                  # MCP HTTP client: callTool(name, args)
│   │   │   └── tools.ts                # Convenience wrappers: serpSearch, webScraper, webUnlocker, scrapingBrowser — each cached via KV
│   │   ├── demand\
│   │   │   └── client.ts               # Calls demand.longtailscout.com/api/research
│   │   ├── stream.ts                   # SSE helpers: emit(event, data)
│   │   ├── cache.ts                    # KV cache wrapper with TTL policy
│   │   └── types.ts                    # Shared types: Operator, SearchQuery, etc.
│   ├── wrangler.toml                   # Bindings: KV namespace, env secrets
│   └── package.json
├── web\
│   ├── index.html
│   ├── app.tsx                         # Preact mount, SSE consumer, state machine
│   ├── components\
│   │   ├── QueryForm.tsx
│   │   ├── AgentTrace.tsx              # Live "watch the agent work" log feed
│   │   ├── ResultTable.tsx             # Sortable table with drill-down panel
│   │   └── CitationLink.tsx            # Per-fact source link
│   ├── styles.css                      # Tailwind directives
│   └── package.json
├── docs\
│   └── superpowers\
│       └── specs\
│           └── 2026-05-27-longtail-scout-design.md   # this file
└── README.md                           # Opens with MCP integration code snippet
```

### Hybrid agent pipeline

The agent is **not** a pure free-form tool-use loop end-to-end. It runs as three phases — LLM-driven where reasoning adds value, deterministic where it doesn't. This is a deliberate 4-day reliability tradeoff over a "pure agent" architecture.

#### Phase 1 — Discovery (LLM-driven, 1 short tool-use loop)

- Claude reads the query, drafts 3–6 SERP queries (e.g., *"small aerospace companies Houston"*, *"NASA contractors Houston suppliers"*, *"Houston space startup hiring"*, *"avionics machine shop Texas"*).
- For each: Bright Data SERP API → collect URLs.
- Optionally: Web Unlocker on 2–3 directory pages (Crunchbase, BuiltIn, local economic-development listings).
- Output: deduped candidate list of ~30–60 `{name, primary_url}`.

Streams: `phase: discovery`, then `tool` and `candidate` events.

#### Phase 2 — Enrichment (deterministic, parallel)

For each candidate (capped at **15** for MVP demo speed; was 25 in early draft — lowered for reliability):

- Web Scraper API (or Web Unlocker fallback) on homepage → extract about, team, services
- SERP API: `"<company> careers"` and `"<company> news"` → recent hiring + activity
- Scraping Browser on careers page only if Web Scraper API returns empty *or* the URL matches a JS-framework heuristic (Greenhouse, Lever, Workday, Ashby) — deterministic rule, not an LLM decision
- Demand-signal API: `GET demand.longtailscout.com/api/research?q=<name>` → demand score + nearby business count

Runs as `Promise.allSettled` — partial failures (3 of 15 candidates fail) do not break the run. Failed candidates are skipped and logged in the trace.

Streams: `phase: enrichment`, `enrich` events per field completed.

#### Phase 3 — Synthesis (LLM-driven, single Claude call)

- Pass enriched records + original query to Claude.
- Output structured: top 15 ranked + per-row sales angle sentence.
- Constraint: every claim cites a source URL (passed in as part of each enriched record).
- Use Claude's structured output / JSON mode.

Streams: `phase: synthesis`, then `result` event with full JSON.

### Enriched record schema (TypeScript)

```ts
type Operator = {
  name: string;
  url: string;
  sources: { field: string; tool: string; url: string }[];   // citations
  about: string | null;
  size_estimate: "1-10" | "11-50" | "51-100" | "100+" | null;
  hiring: { count: number | null; roles: string[]; source: string | null };
  recent_activity: { headline: string; date: string; source: string }[];
  demand_signal: { score: number; nearby_count: number } | null;
  sales_angle: string;                  // generated in synthesis phase
  rank: number;
};
```

### Cache strategy (Cloudflare KV)

- Key: `tool:<name>:<sha256(JSON.stringify(args))>`
- TTL: 24h for SERP, 7d for static scrapes (homepages don't change often)
- Pre-warm the demo query on day 3 so judge runs hit cache and complete in <10s.

### SSE event protocol

```
event: phase     data: {"phase": "discovery"}
event: progress  data: {"message": "Searching: small aerospace Houston"}
event: tool      data: {"tool": "serp", "args": {...}, "url": "..."}
event: candidate data: {"name": "Foo Aerospace", "url": "..."}
event: phase     data: {"phase": "enrichment"}
event: enrich    data: {"name": "Foo Aerospace", "field": "hiring", "value": "..."}
event: phase     data: {"phase": "synthesis"}
event: result    data: { operators: [...] }
event: done      data: {}
event: error     data: {"message": "...", "recoverable": true}
```

---

## 5. Timeline (4 days)

### Day 1 — Wed 5/27 (today, partial)

*Goal: every external dependency proven.*

- Sign up at brightdata.com, apply promo code `unlocked` for $250 credits.
- Get Bright Data MCP server endpoint + API key.
- Cloudflare Tunnel: expose `192.168.1.29:8080` as `demand.longtailscout.com` (one hostname add to existing tunnel).
- `wrangler init`; deploy hello-world Worker, then bind `longtailscout.com` as the Worker's custom domain (CF auto-issues the cert since the zone is on the same account).
- KV namespace created and bound.
- Smoke test: from the deployed Worker, hit Bright Data MCP SERP for "aerospace Houston" and return raw results.
- Smoke test: from the Worker, hit `demand.longtailscout.com/api/research?q=test` and return.

**End-of-day signal:** one Worker URL that, when called, returns real SERP + real demand data.

### Day 2 — Thu 5/28

*Goal: end-to-end happy path, ugly UI.*

- Implement Phase 1 (discovery) — Claude tool-use loop, 3–6 SERP queries, dedupe.
- Implement Phase 2 (enrichment) — deterministic fan-out per candidate.
- Wire demand-signal call into Phase 2.
- Implement Phase 3 (synthesis) — single Claude call with structured output.
- Implement SSE streaming end-to-end.
- Bare-bones HTML: input box + scroll-of-events + raw JSON dump.

**End-of-day signal:** typing the demo query into the Worker URL streams progress for ~60s and returns JSON with 10+ enriched operators and sales angles.

### Day 3 — Fri 5/29

*Goal: ship-worthy UI + reliability.*

- Real UI: Preact + Tailwind, result table with sort/drill-down, agent-trace pane.
- Citations: each cell links to the Bright Data fetch that produced it.
- Cache pre-warm: run demo query 3–4 times; KV fills.
- Error handling: graceful fallback on any Bright Data 5xx (skip candidate, log).
- Anthropic fallback: if 529, retry synthesis with AI/ML API partner credits.
- Snapshot demand-signal data for top ~10K Houston-area businesses into KV as resilience for tunnel outage.
- `README.md` opening with the MCP integration snippet.
- Public GitHub repo, MIT license.
- First pass at slides.

**End-of-day signal:** demo URL is polished, "aerospace Houston" runs end-to-end in <90s, every claim has a citation link, repo public.

### Day 4 — Sat 5/30

*Goal: submit by mid-day.*

- 90-second video shoot (multiple takes, pick best).
- Cover image (Figma or Canva, ~15 min).
- Polish slides.
- Submit on lablab.ai — title, descriptions, video, slides, repo URL, demo URL.
- Buffer: ~4 hours for last-minute fixes.

---

## 6. Risks & mitigations

| Risk | Probability | Mitigation |
|---|---|---|
| Bright Data MCP latency makes the demo feel slow (>2 min) | Medium | Cache aggressively. Pre-warm. Cap parallel candidates at 15. |
| One Bright Data tool 5xxs mid-run | Medium | Per-candidate `Promise.allSettled`. UI shows the gap, doesn't break. |
| Anthropic rate-limits during judging | Low-medium | Switch to AI/ML API for synthesis only (partner credits). |
| Home network drops during judging → demand tunnel offline | Low | Day 3: snapshot top ~10K Houston-area businesses into KV as fallback. Stale but always-up. |
| Demo query result quality is meh | **Medium — highest-impact risk** | Iterate system prompt + candidate filters on Day 2–3 until "aerospace Houston" reliably surfaces ≥3 obviously-cool operators. Pre-pick the demo query. |
| Workers 5-min subrequest cap | Very low | Realistic agent runs are 60–90s. |
| Scope creep on day 3 | High (always) | Hard rule: anything not in §1 Goals is deferred to a "future work" slide. |

**The one risk that matters most:** demo query quality. The pitch lives or dies on whether the "aerospace Houston" query, on a judge's screen, returns a list that makes them go *"oh, that's actually useful."* Spend deliberate time tuning the system prompt and candidate-filtering on Day 2–3. Pre-pick the demo query.

---

## 7. Submission checklist (lablab.ai)

- [ ] Project title: **LongTail Scout**
- [ ] Short description (≤200 chars)
- [ ] Long description with positioning vs. Apollo
- [ ] Tech / category tags (must include Bright Data and Claude / Anthropic)
- [ ] Cover image
- [ ] Video presentation (~90 seconds)
- [ ] Slide presentation (5–8 slides max)
- [ ] Public GitHub repo URL (MIT)
- [ ] Demo application URL (Cloudflare Worker)
- [ ] Bright Data Requirement: explicit MCP integration code visible in README

## 8. Judging criteria alignment

| Criterion | How this submission scores |
|---|---|
| **Application of Technology** | Four Bright Data products used (MCP, SERP, Web Scraper, Web Unlocker) with MCP as the orchestration layer — the featured integration pattern Bright Data is promoting. |
| **Presentation** | 90-second video with a concrete query producing real results, plus drill-down with citations. |
| **Business Value** | Maps to GTM Intelligence track's stated buyer (sales/marketing teams, account researchers). Apollo/ZoomInfo are a $10B+ market — long-tail differentiation is a fundable wedge. |
| **Originality** | "Apollo for the long tail" with web-derived demand signal + per-fact citations is a unique combination versus prior submissions like VEIN.intel. |

---

## 9. Open items to finalize before implementation

- Whether to add Cognee for agent memory in pursuit of the partner prize ($2,400). **Default: defer** — adding it in 4 days while shipping core features is high-risk. Revisit on Day 3 if buffer time exists.

## 10. Resolved decisions

- **Name:** LongTail Scout
- **Primary domain:** `longtailscout.com` (registered on Cloudflare, same account as the Worker — no DNS migration, custom-domain binding is one click)
- **Demand API hostname:** `demand.longtailscout.com` via existing Cloudflare Tunnel to `192.168.1.29:8080`
- **Track:** GTM Intelligence (Track 1)
- **Demo vertical:** aerospace and space-tech in Houston
