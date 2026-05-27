# LongTail Scout — Slide Deck Outline

Submission for Bright Data Web Data UNLOCKED hackathon, Track 1 (GTM Intelligence).
5–8 slides, designed for skimming. Paste into Google Slides / Figma / Canva.

---

## Slide 1 — Title

**LongTail Scout**
*Apollo for the long tail.*

An AI agent that finds the small, local, niche businesses Apollo, ZoomInfo, and Clay can't see.

Built for the Bright Data Web Data UNLOCKED hackathon — Track 1, GTM Intelligence.
2026-05-30 · `https://longtailscout.com` · MIT on GitHub

---

## Slide 2 — The problem

> Apollo, ZoomInfo, and Clay were built around the **LinkedIn employee-profile graph**.

Three groups of businesses are missing from that graph:
1. Companies with < 50 employees who don't maintain a LinkedIn corporate page
2. Long-tail verticals — local trades, niche manufacturing, family-owned services
3. The "Bob's Roofing LLC" segment — real revenue, no online presence except their own site

Estimated US TAM blind to Apollo: **millions of small operators**, billions in collective revenue.

These are exactly the companies that **buy SaaS from vertical-specific vendors** (AccuLynx for roofing, ServiceTitan for HVAC, etc.) — and their go-to-market teams pay six figures a year to find them.

---

## Slide 3 — The product

**Type a niche × city query. Get a ranked, cited, evidence-backed list of operators.**

Example query: *"roofing contractors in Houston"*

Output: ~8 ranked operators with
- Company name + homepage URL
- Hiring signals (roles posted, role count)
- Recent activity headlines from the web
- Size estimate
- A one-sentence **sales angle** generated from the scraped facts
- Every claim citation-linked to the source URL

Per-row drill-down panel shows the underlying Bright Data fetches.

(screenshot here from the live demo)

---

## Slide 4 — How Bright Data powers it

Three-phase hybrid agent pipeline. **Bright Data is the spine.**

| Phase | Step | Bright Data tool |
|---|---|---|
| 1. Discovery | LLM fires 3–4 diverse SERP queries in parallel, dedupes | **Scraping Browser** drives real Chromium against Google → bypass bot detection automatically |
| 2. Enrichment | Per top candidate: render homepage, search "<co> careers", search "<co> news" | **Scraping Browser** renders JS-heavy ATS pages (Greenhouse, Lever, Workday, Ashby) |
| 3. Synthesis | LLM ranks + writes per-row sales angle; every claim cited | — |

One zone (`longtail_browser`, type `browser_api`) handles both SERP and per-site enrichment via the **Chrome DevTools Protocol over WebSocket**. A tiny bridge service on the home server connects Playwright to BD's WSS endpoint and exposes `/render` + `/serp` HTTP for the Worker.

This is the MCP-Server pattern — agent calls a tool, doesn't need to know about zones or WSS connections.

---

## Slide 5 — Architecture

```
Browser ── Preact SPA ── Cloudflare Worker (TypeScript)
                              │
                              ├── Bright Data Scraping Browser (via WSS bridge)
                              ├── DeepSeek (OpenAI-compatible LLM, with GLM/OpenRouter fallback)
                              ├── Cloudflare KV (caches BD calls, 24h SERP / 7d static)
                              └── Private 7M-business demand-signal index (CF Tunnel)
```

Hosted on **Cloudflare Workers paid plan**. Custom domain via auto-cert. SSE streaming for live agent trace. Gated by a demo password.

OSS stack: Preact + Tailwind v4 + Vite (frontend), playwright-core + cheerio (bridge), Wrangler 3 (deploy).

---

## Slide 6 — Why this beats Apollo for long tail

Two moats:

**1. Live web rendering via Bright Data.** Apollo's data is static, refreshed quarterly. We pull operator websites + Google + press in real time, every query. Operators added yesterday are in our results today.

**2. Private demand-signal index.** A 7M-business scrape of local services pulled from Google Maps via the team's own scraping infra. We don't tell the LLM that the niche has "high demand" without numbers — we tell it the niche has **82,200 matching businesses** (for "roofing") and let it reason about market size.

Apollo doesn't have either of these. Their build-vs-buy decision was made before LLMs could ground their reasoning in scraped fact.

---

## Slide 7 — Demo (link to video)

(embed YouTube video here, or screenshot a frame + link)

90 seconds. Live URL: `https://longtailscout.com`. Demo password in the submission notes.

---

## Slide 8 — What's next + thanks

**Next 30 days:**
- CRM connectors (HubSpot, Salesforce, Apollo CSV import)
- "Always-on" mode: re-run the same niche × city every week, surface new entrants
- Vertical-tuned prompts (roofing, HVAC, childcare, EMS specific signals)
- Two-token export — single-button "send to ChatGPT/Claude/Gemini for a prospecting email"

**Thanks to:**
- **Bright Data** for the $250 promo credit and the Scraping Browser product
- **Cloudflare** for Workers, KV, Tunnels, custom-domain auto-cert (all free-tier-friendly)
- **DeepSeek** for genuinely cheap, fast tool-use LLM
- **lablab.ai** for running the hackathon

---

## Submission form copy (for lablab.ai)

**Title:** LongTail Scout

**Short description** (under 200 chars):
> Apollo for the long tail. An AI agent that finds the small, local, niche businesses Apollo can't see — built on Bright Data Scraping Browser, DeepSeek, Cloudflare, and a private 7M-business demand-signal index.

**Long description:**
> LongTail Scout is a GTM-intelligence agent that surfaces the operators Apollo, ZoomInfo, and Clay can't find: small, local, niche businesses that aren't on LinkedIn. Type a niche × city query (`"roofing contractors in Houston"`); get a ranked, cited list of operators with hiring signals scraped from their careers pages, recent activity headlines, and a one-sentence sales angle aimed at vertical-specific SaaS buyers.
>
> The agent runs as a three-phase pipeline on a single Cloudflare Worker: LLM-driven discovery (Bright Data SERP queries via Scraping Browser), deterministic per-candidate enrichment (homepage + careers + news via Bright Data's WSS-only Scraping Browser, bridged through a tiny Playwright service), and LLM synthesis (DeepSeek ranks + writes citation-grounded sales angles).
>
> A private 7M-business demand-signal index (built independently of LinkedIn) provides niche-size context to the synthesis prompt, so the agent reasons about real market dynamics, not LLM hallucination.
>
> **Live demo:** https://longtailscout.com — demo password: `<see Demo Notes section below>`
> **Source:** https://github.com/dholzric/longtail-scout (MIT)

**Demo Notes (paste into the lablab submission's private notes / judge comments field, not the public description):**
> Password to unlock the demo: `Piglet` (set as the `DEMO_PASSWORD` env on the Worker). Open `https://longtailscout.com/?key=Piglet` to auto-fill.

**Tech tags:** Bright Data, DeepSeek, Cloudflare Workers, TypeScript, Preact, Playwright

**Category:** GTM Intelligence (Track 1)
