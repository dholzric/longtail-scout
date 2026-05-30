# LongTail Scout — 90-Second Demo Script

**Target length:** 85-90 seconds. **One take preferred** (judges feel the live progression).
**Pre-flight:** finish `submission/demo-checklist.md` first.

> **This is the tight 90-second cut.** It shows the scout + Niche Recon only. Since v1.2 the app gained a full per-operator intelligence suite — Apollo-blind LinkedIn verification, contact discovery, decision-maker finder, live signal radar, account-brief export, and the "Act first" trigger feed (all Bright-Data-backed). The 90 seconds can't fit them. **For the complete feature list and a ~3–4 min extended walkthrough that demos them, see `submission/feature-guide.md`.** If your video can run 2–3 minutes, use the extended cut — the drill-down "find → prove → reach → act" sequence is the strongest material.

---

## How to use this script

Each row is one beat. Read **🎙️ SAY** aloud in real time. Do **🖱️ DO** at exactly that moment. **📺 SCREEN** describes what the camera should be looking at — don't worry about exact pixel matches, just direction.

You're talking to a hackathon judge who has 90 seconds of attention. Don't over-explain. Let the screen do the work.

---

## 00:00 – 00:07 · The hook

📺 **SCREEN:** Page loaded. Title visible: "longtailscout.com — vol. 1 · field manual for the long tail · est. may 2026". Hero section visible. Empty query input.

🖱️ **DO:** Nothing yet. Just be on the page.

🎙️ **SAY:**
> "Apollo and ZoomInfo can't see roofing contractors. They can't see HVAC techs, dental clinics, hair salons, or any of the seven million small American businesses that aren't on LinkedIn. This is LongTail Scout."

(7 seconds. Pace yourself — don't rush.)

---

## 00:07 – 00:18 · The setup

📺 **SCREEN:** Same view. The query input.

🖱️ **DO:** Click into the query input. It should already say `roofing contractors in Houston` (the default). If it's empty, type it. Don't hit Run yet.

🎙️ **SAY:**
> "Type a niche and a city. The kind of query an SDR would build a list around. Watch what happens when you click run."

🖱️ **DO at "click run":** Click the black "RUN SCOUT →" button.

(Time at end of this beat: 0:18.)

---

## 00:18 – 00:50 · The live agent run

📺 **SCREEN:** Trace panel starts streaming. "Phase: discovery" appears, then a flood of candidate names. The cost meter at the top of the page starts ticking. Pins start dropping on the inline live map.

🖱️ **DO:** Don't touch anything. Let the trace fly. Move the mouse to subtly point at things as you narrate them.

🎙️ **SAY** (timed in three beats — pause briefly between them):

> *(at ~0:20, gesture to the trace)*
> "Discovery — the agent fires four Bright Data SERP queries in parallel: direct, suppliers, hiring, news. Different angles to catch the operators that one query alone would miss."

> *(at ~0:32, gesture to the cost meter at the top of the page)*
> "Enrichment — for each candidate, it plain-fetches the homepage, parses the careers page, extracts hiring signals. The cost meter shows real spend — Bright Data renders and DeepSeek tokens, three cents so far."

> *(at ~0:42, point to a pin dropping on the inline map)*
> "And the map is filling in live as operators are geocoded against our seven-million-business demand index."

(At about 0:50 the trace should show "Synthesis via deepseek" and the result table should be rendering.)

**If the run is taking longer than 35s, just keep narrating. Repeat the cost line. The map appearing is your visual cover.**

---

## 00:50 – 01:08 · The result

📺 **SCREEN:** Result table is rendered. 8-10 ranked operators. Wedge summary banner visible above ("N of N Apollo-thin"). City breakdown chips visible.

🖱️ **DO:** Move your mouse over the table. Click the **top row** (#1) to expand its drill-down panel.

🎙️ **SAY:**
> "Eight ranked roofing contractors. Each row: name, hiring signals, recent activity, and a one-line sales angle. Click any row..."

🖱️ **DO at "click any row":** Click row #1 to expand.

🎙️ **SAY** *(as the drill-down expands)*:
> "...and every claim is footnoted back to the exact Bright Data fetch that produced it. No hallucination. Look at the bottom — a personalized cold email, drafted by DeepSeek from the operator's own about page."

(Time at end: 1:08.)

---

## 01:08 – 01:25 · The killer differentiator — Niche Recon

📺 **SCREEN:** Result table still visible.

🖱️ **DO:** Scroll up to the query input area. Above the input, there's a chip that says **"🧭 don't know your niche? get recon →"**. Click it.

🎙️ **SAY:**
> "But here's what Apollo physically cannot do."

🖱️ **DO:** The Niche Recon panel expands. Type **exactly** this into the textarea (it must match the description you locked in during pre-warm so the cached result loads — see checklist step 2):

> `home services CRM for trades`

Click the **"find niches →"** button. (Because it's pre-warmed, results load in ~1s — and they're deterministic: electrical 100%, hvac 86%, pool service 76%, plumbing 53%.)

🎙️ **SAY:**
> "Paste a product description. We map it to candidate verticals via LLM, then cross-reference each against our private demand index. We rank by how Apollo-thin each vertical is — meaning what share of the businesses there have no real domain Apollo can match. Booking platforms, social profiles, Google profile pages — Apollo's blind to all of them."

(Niche Recon results should appear within 2-5 seconds because the cache is warm.)

📺 **SCREEN:** Niche Recon shows the niches with real index counts. Top row: `electrical` · `16,666` · `100% Apollo-thin` — every sampled business on ServiceTitan booking, no own domain.

🖱️ **DO:** Point at the top row. Don't click — just gesture.

🎙️ **SAY:**
> "Sixteen thousand electrical contractors in our index — and a hundred percent Apollo-thin: every one we sampled lives on a ServiceTitan booking link, not their own domain. Apollo can't see a single one. We just did."

(Time at end: 1:25.)

---

## 01:25 – 01:30 · The close

📺 **SCREEN:** Niche Recon panel visible.

🖱️ **DO:** Nothing. Optionally close the Niche Recon panel and let the result table from the earlier scout be the final shot, if it makes a better closing frame.

🎙️ **SAY:**
> "LongTail Scout — live at longtailscout.com. Source on GitHub. Bright Data and DeepSeek under the hood. Thanks."

(End at 1:30.)

---

## Cue card — the absolute minimum if you forget the script

If something goes off-rails and you need to ad-lib, hit these four beats in order:

1. **"Apollo can't see small local businesses."** (the problem)
2. **"Live scout in ~40 seconds, every claim cited back to a Bright Data fetch."** (the product)
3. **"Niche Recon — paste your product, find verticals Apollo's blind to."** (the moat)
4. **"longtailscout.com."** (the URL)

90 seconds covers all four with breathing room. Don't add a fifth thing.

---

## Visual overlays (post-edit, optional)

If you have time to edit, drop these as lower-thirds during recording:

| Timestamp | Caption |
|---|---|
| 0:00 | `LongTail Scout · longtailscout.com` |
| 0:18 | `Bright Data Scraping Browser + Brave SERP API` |
| 0:32 | `Live cost meter: $0.03 per scout` |
| 0:50 | `Ranked operators with citation-grounded sales angles` |
| 1:08 | `Niche Recon — reverse the GTM funnel` |
| 1:18 | `Apollo-thinness = 1 − (own_domain / total) on raw rows` |
| 1:25 | `https://longtailscout.com` |

Skip overlays if it stresses your post-edit timeline. The voiceover carries the demo on its own.

---

## After the recording

1. Watch the playback once at 1.0×. **Listen for um/uh/anyway/like.** A single take with 1-2 verbal stumbles is fine; more than that, do a second take.
2. **Check audio levels.** No clipping, no breath noise dominating.
3. **Trim head and tail.** Cut to the first "Apollo" and end on "Thanks."
4. **Export at 1080p.** H.264, ~10 Mbps. Aim for a file under 80 MB.
5. **Upload to YouTube as unlisted.** Title: `LongTail Scout — 90-second demo (Bright Data Web Data UNLOCKED hackathon)`.
6. **Save the YouTube URL** — you'll paste it into the lablab submission form.

Then go to `submission/lablab-submission.md` for the form copy.
