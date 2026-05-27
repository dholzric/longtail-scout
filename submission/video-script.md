# LongTail Scout — 90-Second Demo Video Script

Target length: 75-95 seconds. Single take preferred. Screen recording at 1920×1080.

Pre-flight:
1. Bridge running on .29 — verify `curl https://bridge.longtailscout.com/health` returns `ok: true`
2. Roofing query pre-warmed in KV cache — run it once and let cache populate
3. Clean browser window, no extensions visible, devtools closed
4. Open `https://longtailscout.com/?key=Piglet` so the demo password auto-fills
5. Mic check, screen recording started

---

## Storyboard

### 00:00–00:08 — Hook (8s)

[Title card overlay or just begin on the page]

**Narration:**
> "Apollo and ZoomInfo can't see roofing contractors. Or HVAC. Or childcare providers. Or any of the 7 million small American businesses that aren't on LinkedIn."

### 00:08–00:18 — Intro to the product (10s)

[Camera on the page header: "LongTail Scout — Apollo for the long tail"]

**Narration:**
> "LongTail Scout is an AI agent that finds them — built on Bright Data, DeepSeek, and a private demand-signal index."

### 00:18–00:30 — Type the query (12s)

[Click into the input. Type or paste: `roofing contractors in Houston`. Click Run.]

**Narration:**
> "I'll type the kind of query you'd give an SDR. Roofing contractors. In Houston. Watch the agent work."

### 00:30–01:00 — Agent trace (30s)

[Camera on the trace pane. Don't narrate every line — let the trace speak for itself with brief callouts.]

**Narration as events appear:**
> "Phase one — discovery. The agent fires four parallel Google searches via Bright Data's Scraping Browser. Different angles: direct, suppliers, hiring, news."
>
> [pause for "Discovered N candidates" event]
>
> "Phase two — enrichment. For each top operator, it renders their homepage through Bright Data, extracts hiring signals and press links from the page itself."

### 01:00–01:20 — Result table (20s)

[Camera on the result table as it renders. Hover over the top row.]

**Narration:**
> "Eight ranked roofing contractors. Each row: name, size estimate, hiring count, and a sales angle. Click any row…"

[Click to expand the top row's drill-down.]

> "…and you see the underlying sources. Every claim has a citation back to the Bright Data fetch that produced it. No hallucination."

### 01:20–01:30 — Punch line + end card (10s)

[End card or final shot of the URL.]

**Narration:**
> "Live at longtailscout.com. Source on GitHub. Built on Bright Data Scraping Browser. Thanks."

---

## Visual cues / on-screen text

- 0:00 — Title overlay: "LongTail Scout — Apollo for the long tail"
- 0:18 — Caption: `https://longtailscout.com`
- 0:30 — Caption: "Phase 1: Discovery (Bright Data SERP via Scraping Browser)"
- 0:42 — Caption: "Phase 2: Enrichment (Bright Data Browser API per operator)"
- 1:00 — Caption: "Phase 3: Synthesis (DeepSeek, every claim cited)"
- 1:20 — End card: "longtailscout.com · github.com/dholzric/longtail-scout · MIT"

## Recording tips

- One full take preferred. Don't edit between phases — judges should *feel* the live progression.
- If the agent run is slow, you can either (a) pre-warm cache so it's fast, or (b) speed-cut the 30-second discovery phase.
- Cursor visibility: enable "Show cursor" / "Highlight clicks" in OBS/Loom.
- Audio: external mic if possible, otherwise check input levels before the take.
