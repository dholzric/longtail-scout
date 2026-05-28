# LongTail Scout — Slide Deck Outline

Submission for **Bright Data Web Data UNLOCKED** hackathon, Track 1 (GTM Intelligence). 2026-05-30.
8 slides, designed for skimming. Paste into Google Slides / Figma / Canva.

This deck is OPTIONAL — lablab.ai doesn't require slides, just the form + video. But if you want supporting material to send to the partner-prize judges (Bright Data, Cognee, Speechmatics), this is the deck.

---

## Slide 1 — Title

**LongTail Scout**
*Apollo for the long tail.*

Live AI prospect scout for the 7M small American businesses Apollo can't see.

Bright Data Web Data UNLOCKED hackathon · Track 1, GTM Intelligence · 2026-05-30
`https://longtailscout.com`

---

## Slide 2 — The buyer's problem

The GTM teams at **ServiceTitan, AccuLynx, JobNimbus, Brightwheel, Jobber, Bambee, Toast** spend their weeks chasing the same kind of account:

> *Small, local, operator-owned, web-first. Real revenue, real budget, no LinkedIn corporate page, no Apollo record.*

One SDR builds ~10 qualified accounts a day by hand — scrolling directory sites, opening every roofing company's homepage, copying URLs out of Google. **~$300 per account just to FIND them**, before any outreach starts.

Apollo and ZoomInfo don't help here. Their data was built around the LinkedIn employee graph. For the long tail — local trades, niche manufacturers, family-owned services, franchisees — that graph is empty.

This is the job we automate.

---

## Slide 3 — The product

**Type a niche × city query. Get a ranked, cited, evidence-backed list of operators in ~40 seconds.**

Example query: `roofing contractors in Houston`

Output: 8-10 ranked operators with
- Company name + homepage URL
- Hiring signals scraped from the careers page (role count + titles)
- Recent activity headlines pulled live from press / blog
- Size estimate from public footprint
- A one-sentence **sales angle** generated from scraped facts
- **Every claim citation-linked to the source URL**

Per-row drill-down shows the underlying Bright Data fetches inline. On-page map plots operators against a heat layer of every other business in the demand index for that niche.

*(screenshot here from the live demo)*

---

## Slide 4 — How Bright Data powers it

**Three-phase hybrid agent pipeline. Bright Data is the spine.**

| Phase | Step | Bright Data tool |
|---|---|---|
| 1. Discovery | LLM fires 4 parallel SERP queries: direct, hiring, news, suppliers | **Brave SERP API → DDG → BD Scraping Browser** cascade. BD handles the long-tail queries Brave misses. |
| 2. Enrichment | Per candidate: render homepage, careers, news. Hybrid plain-fetch + BD. | **BD Scraping Browser** for JS-heavy ATS pages (Greenhouse / Lever / Workday) |
| 3. Synthesis | DeepSeek ranks + writes citation-grounded sales angles | — |

A tiny Playwright bridge service on the home server connects to Bright Data's **WSS (Chrome DevTools Protocol) Browser API** and exposes `/render` + `/serp` + `/screenshot` as HTTP for the Worker.

One BD zone (`lts_browser`, type `browser_api`) handles SERP + render + screenshot. Mutex serialization avoids BD's per-context throttling.

---

## Slide 5 — The killer differentiator: Niche Recon

**The feature Apollo physically cannot replicate.**

Paste a product description. Get the top 5 long-tail verticals to hunt in.

How: we map the description to candidate verticals via LLM, then cross-reference each against our private 7M-business demand index. We rank by **Apollo-thinness** — what share of businesses in the vertical have NO own-domain website. Booking platforms (Booksy, Boulevard, ServiceTitan, Vagaro), social profiles (Facebook, Instagram, Yelp), Google profile pages — all of those make the operator invisible to Apollo's domain-match enrichment.

Example output for `"home services CRM for trades"`:

| Niche | Businesses | Apollo-thin |
|---|---:|---:|
| electrical | 30+ | **100%** (every one uses ServiceTitan booking) |
| hvac | 30+ | 86% |
| pool service | 30+ | 76% |
| plumbing | 30+ | 50% |

This is the moat. Apollo doesn't have the demand index. Without the index, this feature doesn't exist.

---

## Slide 6 — Architecture

```
Browser ── Preact SPA ── Cloudflare Worker (TypeScript)
                              │
                              ├── Brave SERP API (primary)
                              ├── DuckDuckGo HTML (Tier 2)
                              ├── Bright Data Scraping Browser (Tier 3, via WSS bridge)
                              ├── Bright Data Browser API (screenshots)
                              ├── DeepSeek (LLM primary) / OpenRouter / GLM (fallbacks)
                              ├── Cloudflare KV (caches: 24h SERP / 7d static / 1h niche samples)
                              ├── Cloudflare Cron (daily watchlist refresh + cache pre-warm)
                              ├── Resend (email digests, longtailscout.com domain verified)
                              └── Private 7M-business demand index (CF Tunnel)
```

**Hosting:** Cloudflare Workers (paid plan), custom domain via auto-cert, SSE streaming for the live agent trace. Demo password gates writes; all read paths still require Bearer auth for the demand index (we don't expose the moat).

**Stack:** Preact + Tailwind v4 + Vite (frontend), Wrangler 3 (deploy), playwright-core + cheerio (bridge), Vitest (49 tests).

---

## Slide 7 — Beyond the demo: MCP, watchlists, security

**MCP Server at `/api/mcp`** — 6 tools any MCP-aware client (Claude Desktop, Cursor, ChatGPT) can call:

| Tool | Use case |
|---|---|
| `scout` | Run a full long-tail scout for a niche × city |
| `niche_recon` | Reverse the funnel — paste a product, get the top verticals |
| `find_businesses` | Geotagged businesses from the demand index |
| `demand_count` | Single-integer count for a niche |
| `operator_screenshot` | Live BD-rendered homepage screenshot |
| `draft_email` | Personalized cold email from operator facts |

**Watchlist + alerts:** save a query, daily cron refreshes the demand-index count, Resend email digest + Slack/Discord webhook fire when delta > 0. CAN-SPAM compliant — each digest email has an HMAC-signed unsubscribe link.

**Security:** 49 unit tests covering SSRF guard (caught an IPv6 bypass before deploy), HMAC unsubscribe tokens, watchlist PII redaction, the Apollo-thinness platform-host filter. Two external code reviews (Codex), 10/10 findings closed.

---

## Slide 8 — What's next + thanks

**Next 30 days:**
- CRM connectors (HubSpot, Salesforce, Apollo CSV reverse-import)
- Quality mode: opt-in BD-bridge enrichment that recovers the ~35% of candidates plain-fetch drops
- Vertical-tuned prompts (roofing, HVAC, childcare, EMS — different hiring signal weights per market)
- Bright Data MCP Server integration once it's GA — deprecate our Playwright bridge, call BD directly

**Thanks to:**
- **Bright Data** for the Scraping Browser product and the hackathon promo credit
- **Cloudflare** for Workers, KV, Tunnels, custom-domain auto-cert (the free tier is staggeringly generous)
- **DeepSeek** for cheap fast tool-use LLM — primary all the way
- **lablab.ai** for running the hackathon

**Live demo:** `https://longtailscout.com` · **Source:** `github.com/dholzric/longtail-scout`
