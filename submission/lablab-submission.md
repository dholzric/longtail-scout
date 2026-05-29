# lablab.ai submission — ready-to-paste copy

This file has the exact text for every field in the lablab.ai submission form for the **Bright Data Web Data UNLOCKED hackathon**. Copy each block as-is.

**Deadline:** 2026-05-30.
**Track:** GTM Intelligence (Track 1).
**Required:** demonstrably use ≥ 1 Bright Data product. (We use Scraping Browser via WSS, plus the demand-index moat that wraps it.)

---

## Field-coverage checklist — map this doc against the live form

Tick each field on the form against this list. ✅ = ready-to-paste block below. ⚠️ = only YOU can do it (upload/paste). If the form shows a field NOT on this list, tell me and I'll draft it.

| Form field | Status |
|---|---|
| Project Title | ✅ |
| Short Description (255 char max) | ✅ |
| Long Description | ✅ |
| **Cover Image** (required) | ⚠️ upload `og-card.png` (block below) |
| **Video Presentation** (required) | ⚠️ paste your YouTube URL after upload |
| Event track (GTM Intelligence) | ✅ |
| **Category (global tag multi-select)** | ✅ guidance below |
| Technologies / tech tags | ✅ |
| Live demo / Demo URL | ✅ |
| GitHub / Source code URL | ✅ |
| Team members | ✅ (team "more-coffee-less-sleep" already exists) |
| How it uses Bright Data | ✅ |
| Inspiration · Challenges · Accomplishments · What we learned · What's next | ✅ |
| Private demo notes (password) | ✅ |

Confirmed against your saved form: the requirements are **Project Title, Short Description, Long Description, Cover Image, Video Presentation**, plus Category, Technologies, Demo URL, GitHub, Team. lablab's "Presentation" = the **video**, not a slide deck (so `slides-outline.md` is optional extra material, not a required field).

**The two things only you can complete:** the **Cover Image** upload (`og-card.png`) and the **Video Presentation** URL. Everything else is paste-ready below.

---

## Field: Project name

```
LongTail Scout
```

## Field: Short Description (the form's real label — 255 char max)

```
Apollo for the long tail. An AI agent that finds the small, local, niche businesses Apollo can't see — built on Bright Data Scraping Browser, DeepSeek, and a private 7M-business demand index.
```

(190 chars — comfortably under the 255 limit. Room to spare if you want to add a phrase.)

## Field: Event track (the hackathon's own track — single choice)

```
GTM Intelligence (Track 1)
```

## Field: Categories (lablab's global multi-select tag list — separate from the event track)

This is the big alphabetical tag list on the form (advertising, art, assistant, …). It categorizes the app across the lablab platform; it is NOT the hackathon track. Pick the tightly-relevant ones — don't spray. If the form caps the number you can pick, use this priority order:

```
1. Agent builder track - the internet of agents   ← strongest fit: LongTail Scout is an autonomous agent AND exposes 12 MCP tools other agents/assistants can call
2. Assistant                                       ← it's a GTM assistant for SDRs
3. App builder track - the internet of agents      ← it's also a full deployed app (pick if multi-select allows)
```

Then, if these tags exist in the list, add them (all clearly on-point for a GTM/sales-intelligence agent):

```
Sales · Business · Marketing · Data · Productivity · Automation · Developer tools (for the MCP server)
```

**Do NOT pick** (irrelevant — dilutes the categorization): Advertising, Art, Music, Gaming, Health, Travel, Entertainment, Web3, Social, Education, and similar.

> Note: lablab blocks automated fetches, so I'm working from your partial list + lablab's standard taxonomy. Map the ✅ picks above to whatever exact labels your form shows; skip any that aren't present.

## Field: Cover image / thumbnail (lablab REQUIRES a project image — easy to miss)

Use an existing asset from the repo root — no need to make a new one:

```
og-card.png   (1200×630 editorial OG card — ideal as the cover/thumbnail)
```

Alternatives if you want a screenshot instead: `redesign-final.png` (full UI) or `heatmap-overlay.png` (the map view). Upload one in the form's image/thumbnail field.

## Field: Live demo URL

```
https://longtailscout.com
```

## Field: Source code URL

```
https://github.com/dholzric/longtail-scout
```

## Field: Video URL

```
[paste your YouTube unlisted URL here after upload]
```

---

## Field: Long description / "What does your project do?"

Paste this whole block verbatim:

```
LongTail Scout is a GTM-intelligence agent that surfaces the operators Apollo, ZoomInfo, and Clay can't find: small, local, niche businesses that aren't on LinkedIn.

THE PROBLEM
GTM teams at vertical-SaaS companies (AccuLynx, ServiceTitan, Brightwheel, Jobber, Bambee) spend their weeks chasing accounts that look identical: small, local, operator-owned, web-first. Real revenue, real budget, no LinkedIn corporate page, no Apollo record. One SDR builds ~10 qualified accounts a day by scrolling directory sites and opening every roofing company's homepage by hand. That's ~$300 per account just to FIND them.

Apollo and ZoomInfo can't help here. Their data was built around the LinkedIn employee graph — and for the long tail (local trades, niche manufacturers, family-owned services) that graph is empty.

THE PRODUCT
Type a niche × city query: "roofing contractors in Houston". Get a ranked list of operators with:
  • Company name + homepage URL
  • Hiring signals (open roles scraped from their careers page)
  • Recent activity headlines pulled live from the web
  • Size estimate
  • A one-sentence sales angle generated from the scraped facts
  • Every claim citation-linked back to the exact Bright Data fetch that produced it

Per-row drill-down shows the underlying evidence. An on-page map plots operators against a heat layer of every other business in the demand index for that niche.

WHY BRIGHT DATA IS THE SPINE
The agent runs a 3-phase pipeline on a single Cloudflare Worker:

  1. DISCOVERY — LLM fires 4 parallel SERP queries via Brave Search API (free 2k/mo tier), with Bright Data Scraping Browser as the deeper-fallback tier when Brave's organic results miss the long tail.

  2. ENRICHMENT — for each top candidate, plain-fetch the homepage, parse the careers page for hiring signals, scrape recent press. Bright Data Scraping Browser (Chrome over WSS) handles the JS-heavy ATS pages (Greenhouse, Lever, Workday) that plain HTTP can't render. Homepage screenshots in the drill-down are also rendered through Bright Data Browser API.

  3. SYNTHESIS — DeepSeek ranks the operators and writes citation-grounded sales angles. Every claim is footnoted back to the Bright Data fetch that produced it. No hallucination.

THE KILLER DIFFERENTIATOR — NICHE RECON
The feature Apollo physically cannot replicate: paste your product description, get the top long-tail verticals to hunt in. We map the description to candidate verticals via LLM, then cross-reference each against our private 7M-business demand index. We rank by "Apollo-thinness" — the share of businesses whose only URL is a booking platform (Booksy, Boulevard, ServiceTitan, Yelp, a Facebook page) instead of their own domain. Apollo enriches via domain match; no domain means Apollo is blind to that business. Niches with high Apollo-thinness are where you can build a list nobody else has.

Example output for "home services CRM for trades":
  • electrical    100% Apollo-thin (every operator uses ServiceTitan booking)
  • hvac          86% thin
  • pool service  76% thin
  • plumbing      50% thin

THE STACK
Cloudflare Worker (TypeScript, Wrangler) + Cloudflare KV (caching) + Cloudflare Cron Triggers (daily watchlist refresh) + a tiny Playwright bridge on a home server (192.168.1.29, exposed via Cloudflare Tunnel) that wraps Bright Data's WSS Chrome connection in HTTP. Frontend is Preact + Tailwind v4 + Vite, served as Worker static assets. LLM is DeepSeek primary with OpenRouter / GLM-4.6 / AI/ML API as fallbacks.

WHAT'S NEW VS. THE BASELINE
  • Live scout in ~40 seconds end-to-end (was 8+ minutes before speed work — Brave SERP primary, plain-fetch-only enrichment, single-turn discovery cap)
  • Editorial / field-manual UI inspired by analog scientific journals — Fraunces serif + JetBrains Mono + a cream-paper palette
  • PER-OPERATOR INTELLIGENCE SUITE (v1.2–1.7), all Bright-Data-backed:
      - Apollo-blind verification — a live site:linkedin.com/company search via Bright Data that CONFIRMS an operator has no LinkedIn company page (hard proof Apollo can't see them)
      - Contact discovery — walks the contact/about pages for a real email + phone + named contact
      - Decision-maker finder — the owner/founder + their LinkedIn /in/ profile (who to actually email)
      - Signal radar — live third-party news (funding / expansion / leadership / award) as buying triggers
      - "Act first" trigger feed — re-ranks the run by buying-signal strength
      - Account-brief export — a one-click Markdown dossier (evidence + contacts + draft email + sources)
    The drill-down is now a full loop: find → prove it's Apollo-blind → reach the person → why-now → act.
  • MCP server at /api/mcp (12 tools — scout, find_businesses, demand_count, operator_screenshot, draft_email, niche_recon, linkedin_check, find_contacts, account_brief, rank_triggers, signal_radar, decision_maker) so Claude Desktop / Cursor users can drive the whole pipeline directly
  • Live cost meter (Bright Data renders + LLM tokens in USD, streaming)
  • Watchlist with daily cron-refreshed demand counts + Resend email digests + Slack/Discord webhook integration
  • Demand-index hostname-match geocoding (when Nominatim misses, we inherit lat/lng from the index) + a dense heat-map underlay (deep-page fetch surfaces ~200 distinct operators, not 16)
  • 118 unit tests including SSRF guards (worker + bridge), HMAC unsubscribe tokens, PII redaction, the Apollo-thinness platform-host detector, and every new classifier (LinkedIn / contacts / signals / decision-maker / triggers / brief / name-cleanup)
  • Two passes of external security review (Codex), 10/10 findings closed, plus a bridge SSRF fix; full live end-to-end burn-test of all 12 endpoints + 12 MCP tools (3 bugs found & fixed)

LIVE DEMO
https://longtailscout.com — see the Demo Notes section below for the password.

SOURCE
https://github.com/dholzric/longtail-scout
```

---

## Field: How does it use Bright Data?

```
Bright Data Scraping Browser is the deep tier of every web call the agent makes.

DISCOVERY tier 3 fallback: when Brave SERP + DDG miss a long-tail niche, the Worker calls /serp on a Playwright bridge that connects to Bright Data's Browser API via Chrome DevTools Protocol over WebSocket (wss://brd.superproxy.io). The bridge drives a real Chromium against google.com, bypassing the bot-detection that would block a naive fetch.

ENRICHMENT JS fallback: most operator homepages render with plain HTTP, but JS-heavy ATS pages (Greenhouse, Lever, Workday, Ashby careers pages) require rendering. Those go through the same Bright Data Scraping Browser bridge.

OPERATOR SCREENSHOTS: every operator's drill-down shows a homepage screenshot rendered via Bright Data Browser API. Cached in Cloudflare KV for 30 days per (url, viewport).

The Bright Data bridge exposes /render, /serp, /screenshot — HTTP endpoints the Worker can call without itself speaking WSS. One mutex serializes all calls so Bright Data's per-context throttling never bites us.

Configured zones:
  - lts_browser (browser_api): single zone handles SERP + render + screenshot
```

---

## Field: Inspiration / why this matters

```
GTM tooling has been about the same 100,000 enterprise accounts for a decade — the ones in Apollo, ZoomInfo, Clay. The interesting accounts now are everywhere else. Most American economic activity is small and local, and the vertical-SaaS companies winning right now (ServiceTitan, AccuLynx, Brightwheel, Jobber, Toast, Bambee) all sell into markets that Apollo's static LinkedIn-graph data doesn't reach.

The opportunity isn't a better Apollo. It's a parallel data layer that GROUNDS LLM reasoning in live web evidence and private demand signals — exactly what Bright Data + an LLM stack makes possible for the first time.

That's the bet LongTail Scout makes.
```

---

## Field: Challenges we ran into

```
1. SPEED. Live scouts initially took 8+ minutes because Bright Data Scraping Browser
   serializes per-context renders, and our agent fired 25+ enrichment fetches against
   it. The fix was a three-layer cascading SERP tier (Brave → DDG HTML → BD bridge),
   plain-fetch-only enrichment as the default (BD as opt-in quality tier), and
   parallel-with-stagger discovery instead of one-at-a-time tool calls. End-to-end
   scout time dropped from ~480s to ~40s.

2. JOB-TITLE HALLUCINATION. The careers-page parser was matching <li> items in
   phone-country-code dropdowns. The trace literally showed "Cook Islands +682" as a
   parsed job title. Fixed with a blacklist regex (phone codes, emails, dates) and a
   "page-level hiring marker required before parsing list items" rule.

3. SECURITY. Two passes of external code review (Codex) found 10 issues. Highlights:
   the demand-index API was anonymous-accessible (moat exposure), the watchlist GET
   leaked every subscriber's email and webhook URL, the email unsubscribe link was a
   dead path (CAN-SPAM violation), and — caught by the unit tests we wrote in the
   final security pass — an IPv6 SSRF bypass in the screenshot endpoint (the
   PRIVATE_HOSTNAME_RE only matched literal "fc00:" / "fd00:" / "fe80:" prefixes, so
   addresses like [fd12:3456::1] slipped through). All 10 findings closed.

4. THE NICHE RECON SIGNAL. The first version computed "Apollo-thinness" as "% of
   businesses without a website" — but the demand index records SOME URL for nearly
   every row (Booksy booking page, Boulevard widget, Yelp profile, Facebook page,
   Google Maps redirect). So thinness was 0% for every niche, and the feature was
   useless. The fix was redefining thinness as "% of businesses whose host is NOT
   on a 50-platform blocklist" — booking platforms and social profiles don't count
   as own-domain. Suddenly electrical contractors showed 100% Apollo-thin (every
   operator using ServiceTitan booking) and the feature came alive.
```

---

## Field: Accomplishments we're proud of

```
- 40-second live scouts. Real Bright Data calls, real LLM inference, citations on every
  claim. The trace is visible to the user as it happens, with a live cost meter
  ticking in cents.

- The Niche Recon feature. Reverses the GTM funnel — given a product description, finds
  the verticals where Apollo is structurally blind. The killer demo moment Apollo
  physically cannot reproduce.

- The per-operator intelligence suite that closes the GTM loop: live Apollo-blind
  LinkedIn verification, contact discovery, decision-maker finder, signal radar, and a
  one-click account brief — find -> prove -> reach the person -> why-now -> act. The
  "prove it's Apollo-blind" and "find the actual person" steps are things no incumbent
  data vendor does.

- 118 unit tests covering the security-critical paths (worker + bridge SSRF guards, HMAC
  unsubscribe tokens, PII redaction, Apollo-thinness detection) and every new classifier.
  The IPv6 SSRF bypass was caught by tests we wrote BEFORE shipping the fix, which is
  exactly how unit tests should pay for themselves.

- A full live end-to-end burn-test of all 12 API endpoints AND all 12 MCP tools against
  real Bright Data, which caught 3 real bugs (a same-zone-loopback 522 on the MCP tools,
  a garbage-name parse, a cache-key leak) — all fixed and re-verified live.

- MCP server with 12 tools that any MCP-aware client (Claude Desktop, Cursor, ChatGPT)
  can drive directly. The same agent pipeline works as a website AND as a tool surface
  for a separate LLM.

- An editorial / field-manual UI inspired by analog scientific journals (Fraunces
  serif, JetBrains Mono, cream-paper palette, paper-grain texture). The visual
  language reinforces the product's claim — this is reference material, not a
  chatbot.

- The whole thing runs on Cloudflare Workers' free-tier-friendly stack. Single
  custom domain, single KV namespace, one cron trigger. ~$0.03 per scout in real
  external API spend.
```

---

## Field: What we learned

```
- LLMs are dramatically better at structured reasoning when you GIVE them numbers
  from a private index instead of asking them to estimate. "Roofing has 82,200
  businesses" beats "roofing is a large vertical."

- Plain HTTP fetches recover ~60% of US-SMB homepages. The remaining 40% need
  Bright Data's Browser API. That hybrid (plain-fetch first, BD on demand) is
  the right cost/speed/coverage trade-off.

- DDG SERP fallback is real and free. A regex against DDG's HTML page produces
  parseable results without any auth. Saved us during the ~24h Brave Search
  rate-limit window.

- Cloudflare Workers + KV + Cron + Tunnels makes a real production deploy
  achievable in a weekend. The frontend, the backend, the cron triggers, the
  custom domain, and the API tunnel for the private demand server — one
  account, no infra ops.
```

---

## Field: What's next

```
- CRM connectors (HubSpot + Salesforce one-click import, Apollo CSV
  reverse-import).
- "Always-on" mode: re-run the same niche × city weekly, surface new entrants
  to the demand index, fire Slack/email digests on delta > 0. (Already wired
  as cron + Resend; needs a UI to enable per-watch).
- Vertical-tuned prompts: roofing, HVAC, childcare, EMS-specific hiring
  signals so the LLM weights different evidence per market.
- Quality mode: opt-in BD-bridge enrichment that recovers the ~35% of
  candidates plain-fetch drops, in exchange for 3-5x scout latency.
- Browser MCP integration via Bright Data's own MCP server — once it's
  generally available, deprecate our Playwright bridge and route directly.
```

---

## Field: Tech tags

```
Bright Data, DeepSeek, Cloudflare Workers, TypeScript, Preact, Playwright, MCP, Vite, Tailwind
```

---

## Field: Team

```
Dan Holzrichter (solo)
```

---

## Field: Demo Notes (judge-facing, PRIVATE — not the public description)

These go in the submission's private notes / judge comments field, NOT the public description. They contain the demo password.

```
DEMO ACCESS

Open https://longtailscout.com/?key=Piglet — the ?key= captures the demo password
into localStorage automatically and strips it from the URL on first load.

If the demo password prompt appears, paste: Piglet

WHAT TO TRY (in order of demo impact)

1. The default query is "roofing contractors in Houston". Click "RUN SCOUT →" and
   watch the live trace + cost meter + inline map populate. ~40 seconds end-to-end
   from a warm cache.

2. After results render, click any row to drill down. Every claim is footnoted
   with a citation link back to the Bright Data fetch that produced it.

3. Click the "🧭 don't know your niche? get recon →" chip above the query input.
   Paste a product description (try "home services CRM for trades — quotes,
   dispatch, mobile job sheets, payments"). Click "find niches →". You'll see
   the top 5 long-tail verticals ranked by Apollo-thinness — this is the killer
   feature we built around our private 7M-business demand index. ~30-50s on a
   cold cache, ~3s on a warm one.

4. The MCP server lives at https://longtailscout.com/api/mcp — try:
   curl https://longtailscout.com/api/mcp  (lists 12 tools)
   See /mcp page for Claude Desktop config.

5. Map view (toggle at the top of the result table) shows operators as numbered
   pins against a heat underlay of every other business in the demand index for
   that niche.

KNOWN LIMITS

- Quality vs. speed trade-off: live scouts use plain HTTP enrichment by default
  (the "live" pace would otherwise be 3-4 minutes per scout via Bright Data
  Browser API serialization). Plain HTTP recovers ~60% of US-SMB homepages;
  the rest are dropped from the result set. The Bright Data Browser API is
  still used for SERP fallbacks, screenshots, and JS-heavy career pages.

- ?sample=1 mode returns cached results deterministically in ~140ms with zero
  BD or LLM cost — useful if you want to demo the UX without burning credits.
  Example: https://longtailscout.com/?q=roofing+contractors+in+Houston&run=1&sample=1&key=Piglet

If anything breaks during your evaluation, please email dholzric@gmail.com — I'll be
watching for judge traffic and can fix issues in minutes.
```
