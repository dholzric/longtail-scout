# LongTail Scout — Complete Feature Guide & Demo Walkthrough

**This is the master reference for what the app can do.** It lists every feature, where to find it, how to trigger it, and the one line to say about it. Use it to learn the surface, then follow the **Guided Walkthrough** at the bottom to demo. For the tight 90-second video narration, see `video-script.md`; for pre-flight, `demo-checklist.md`.

**Version:** v1.7.2 · **Live:** https://longtailscout.com (unlock with `?key=Piglet`) · **MCP:** 12 tools at `/api/mcp`

---

## The one-sentence pitch

> Apollo / ZoomInfo / Clay are built on the LinkedIn graph, so they're blind to the 7M small, local, web-first operators (roofers, HVAC, dental, salons). LongTail Scout finds them via Bright Data + their own websites, **proves** they're invisible to Apollo, and hands an SDR everything to act: the person, the inbox, the "why now," and a ready-to-send brief.

The narrative spine for the whole demo: **find → prove → reach → act.**

---

## The wedge story (say this once, early)

"An SDR at AccuLynx or ServiceTitan needs net-new roofing or HVAC accounts. Apollo's data is database-thin for the long tail because these operators aren't on LinkedIn. LongTail Scout crawls their actual websites + Google + news in real time through Bright Data, and cross-references a private 7M-business demand index for market size."

---

## Feature inventory

### A. Discovery & the 3-phase pipeline
| Feature | Where / how | Say |
|---|---|---|
| **Niche × city scout** | Type `roofing contractors in Houston`, click **Run Scout** | "Type a niche and city, the way an SDR scopes a list." |
| **3-phase pipeline** (discovery → enrichment → synthesis) | The phase strip + live trace appear on run | "Discovery fires Bright Data SERP queries; enrichment renders each homepage + careers page; synthesis ranks and writes the angle." |
| **Live agent trace** | Streams under the phase strip | "Every step is streamed — this is the agent thinking out loud." |
| **Live cost meter** | Sticky at top during a run | "Real spend — Bright Data renders + DeepSeek tokens. About 3 cents a scout." |
| **Multi-city expansion** | Query a state: `roofers in Texas` → top-3 cities, globally re-ranked | "State-level queries fan out to the top metros and re-rank across all of them." |
| **Multi-niche** | `roofing OR HVAC contractors in Houston` | "Compound queries split into multiple verticals." |
| **Sample mode (instant, free)** | Add `?sample=1`, or it auto-falls-back on error | "Cached 140 ms replay for a guaranteed-fast demo — identical event flow, zero spend." |
| **25 vertical prompt packs** | Auto-detected from the niche | "25 verticals each inject the right buyer names and ICP hints." |

### B. Results table
| Feature | Where | Say |
|---|---|---|
| **Ranked operators + confidence (0-100)** | Main table | "Rank answers 'who first'; confidence answers 'how much do I trust this row'." |
| **Apollo-thin badge** | Per row | "Operators on their own site, not LinkedIn — the long tail." |
| **Citations / footnotes** | Drill-down → footnotes | "Every claim links back to the exact Bright Data fetch. No hallucination." |
| **Filter + sort** | Min-confidence slider, hiring-only, long-tail-only; click headers | "Filter to hiring-only or the smallest operators." |
| **CSV export + copy** | Toolbar | "One click into Apollo / HubSpot / Salesforce." |
| **Wedge summary banner** | Above table | "Quantifies the Apollo gap for this run." |
| **Per-city breakdown** | Bar chart on multi-city runs | — |

### C. Map & demand density
| Feature | Where | Say |
|---|---|---|
| **Map view** | Toggle Table/Map | "Every operator geocoded and pinned." |
| **Heat-map underlay** | Under the pins | "Colored circles are the whole niche from the 7M-record index — color = rating, radius = review count. Density Apollo can't show." (v1.7.2: pulls a deep page so the map is dense, not sparse.) |
| **Demand probe** | Under the query input as you type | "The moment you type a niche, it shows how many businesses match in the 7M index — 82,000 for roofing." |

### D. Per-operator drill-down — the intelligence suite (click any row)
This is the richest part and where the newest features live. **Open row #1 and walk down the panel.**
| Feature | Trigger | Say | BD tie-in |
|---|---|---|---|
| **Apollo-blind verification** (v1.2) | Auto-fires on open | "We search LinkedIn through Bright Data — *confirmed not on LinkedIn*. That's exactly why Apollo can't see them." | Live `site:linkedin.com/company` via BD |
| **Homepage screenshot** | Auto, lazy | "Rendered live by the Bright Data Browser, cached 30 days." | BD Browser render |
| **Contact discovery** (v1.3) | Click **find via Bright Data** | "Walks the contact/about pages and pulls a real inbox, phone, and named contact." | BD multi-page render |
| **Decision-maker finder** (v1.7) | Click **find via Bright Data** | "Finds the owner/founder and their LinkedIn profile — who, specifically, to contact." | Live `site:linkedin.com/in` via BD |
| **Signal radar** (v1.6) | Click **scan news via Bright Data** | "Live third-party news — funding, a new location, an award — the timeliest 'why now'." | Live news SERP via BD |
| **AI cold email** | Click **✨ + AI** | "DeepSeek writes a personalized email from the operator's own about + hiring. ~2 hundredths of a cent." | DeepSeek |
| **Export brief** (v1.4) | Click **export brief** | "One Markdown dossier — evidence, contacts, draft email, every Bright Data source. Paste into a CRM." | — |
| **Lookalikes** | Click **scan memory** | "Operators with overlapping query history — same-buyer signal." | KV memory |
| **Tech stack** | Shown if detected | "Sniffed from the homepage HTML — what vendors they already run." | — |
| **SDR notes / print dossier** | In-panel | "Private scratchpad; print to PDF." | — |

### E. "Act first" trigger feed (v1.5)
| Feature | Where | Say |
|---|---|---|
| **Trigger-event ranking** | Panel above the table after a run | "Re-ranks the run by buying-signal strength — open roles, expansion, funding — so the SDR knows who to call *first*. Zero extra spend; scored from what we already gathered." |

### F. Niche Recon — reverse the funnel (the killer move)
| Feature | Where | Say |
|---|---|---|
| **Product → verticals** | "🧭 don't know your niche?" chip above the input | "Paste what you sell. We map it to verticals, then rank by demand-density × Apollo-thinness — what share of operators have no domain Apollo can match." |

### G. Watchlist & automation
| Feature | Where | Say |
|---|---|---|
| **Watchlist** | Save a query | "Server-side saved queries with new-vs-seen tracking." |
| **Daily cron refresh** | Automatic 13:00 UTC | "Refreshes demand counts daily — '+N businesses since yesterday' without paying per scout." |
| **Email digest** | Subscribe to a watch | "CAN-SPAM-compliant digest with a signed unsubscribe link." |
| **Slack/Discord webhook** | Watch settings | "Pings a channel when new operators land." |

### H. MCP server — 12 tools
| Feature | Where | Say |
|---|---|---|
| **MCP endpoint** | `/api/mcp`, docs at `/mcp` | "Every capability is also an MCP tool — drive the whole thing from Claude Desktop or Cursor." |
| **12 tools** | `scout, find_businesses, demand_count, operator_screenshot, draft_email, niche_recon, linkedin_check, find_contacts, account_brief, rank_triggers, signal_radar, decision_maker` | "Find an operator, verify it's Apollo-blind, find the person, draft the email — all from your assistant." |

### I. UX, sharing, trust
Voice input · keyboard shortcuts (⌘/Ctrl+Enter run, ⌘/Ctrl+K focus) · one-click vertical demo chips · saved queries · shareable URLs (`?q=…&run=1`) · per-operator permalinks (`?op=…`) · social-share snippets · OG cards (`/share`) · first-visit onboarding · BYOK panel (paste your own DeepSeek key) · Apollo-vs-LongTail compare panel · `/about` (how it works) · `/docs` (API reference) · `/mcp` (MCP guide).

---

## Guided walkthrough — extended cut (~3–4 min, shows the new features)

Use the 90-second `video-script.md` for the submission video. Use **this** longer flow for a live judge Q&A or a deeper recording, because it surfaces the v1.2–1.7 intelligence the short script skips.

1. **Hook (15s).** Land on the page. "Apollo can't see 7 million small American businesses because they're not on LinkedIn. LongTail Scout finds them — and proves it."
2. **Run a scout (40s).** `roofing contractors in Houston` → Run. Narrate the 3 phases + cost meter. (Pre-warmed → returns fast.)
3. **Results (20s).** Point at confidence, Apollo-thin badges, the wedge banner. Mention CSV export.
4. **"Act first" feed (15s).** "Before drilling in — the feed already tells me who to call first, ranked by live buying signals."
5. **Drill-down — the money sequence (70s).** Open row #1 and go top-to-bottom:
   - **Apollo-blind verification** badge → "Confirmed not on LinkedIn, via Bright Data. *This is the thesis, proven live.*"
   - **find via Bright Data** (contacts) → real email + phone.
   - **decision-maker** → "And here's the owner, with his LinkedIn — who to actually email."
   - **scan news via Bright Data** (signal radar) → any funding/expansion headline.
   - **✨ + AI** → DeepSeek email referencing a real fact.
   - **export brief** → download the Markdown dossier. "Everything an SDR needs, one click, every claim cited."
6. **Map (15s).** Toggle to Map → dense heat-map. "The whole niche, not just my picks."
7. **Niche Recon (30s).** Reverse the funnel: paste a product description → top verticals by Apollo-thinness.
8. **MCP (15s).** Show `/mcp` → "All 12 of these are MCP tools — run it from Claude Desktop."
9. **Close (10s).** "longtailscout.com. Bright Data + DeepSeek under the hood. Thanks."

**Sequence to emphasize for judges:** *find → prove (Apollo-blind) → reach (contact + decision-maker) → why-now (signal radar) → act (brief).* No competitor does the "prove" or "reach the person" steps.

---

## Demo modes & fallbacks

- **Fastest / safest:** `https://longtailscout.com/?key=Piglet` then use the **vertical demo chips** (each has cached sample data) or append `?sample=1`. Instant, free, deterministic.
- **Live (impressive, costs ~$0.03 + a few cents for the drill-down BD calls):** plain scout, no `?sample`. Requires the **bridge** running on the home server for the BD features.
- **If the bridge is down:** scout, triggers, brief, niche-recon, demand probe still work. The four drill-down BD features (Apollo-blind, contacts, decision-maker, signal radar) show a graceful "unavailable" message — skip them in the take, or start the bridge first (`demo-checklist.md`).
- **Bridge health:** `curl -s https://bridge.longtailscout.com/health` should return `{"ok":true,...}`.
