# Submission folder — read this first

Everything you need to ship the LongTail Scout submission for the Bright Data Web Data UNLOCKED hackathon.

**Deadline:** 2026-05-30.

---

## Do this, in order

1. **`demo-checklist.md`** — Run this 20 min before you record. Pre-flight checks + cache pre-warm. **Do not skip.**

2. **`video-script.md`** — The 90-second recording. Has the exact words to say + exact clicks to make, second-by-second. Print it on paper or open on a second screen.

3. *(optional)* **`slides-outline.md`** — 8-slide deck. lablab doesn't require it, but it's useful supporting material for the partner-prize judges (Bright Data, Cognee, Speechmatics). Paste into Google Slides / Figma / Canva.

4. **`lablab-submission.md`** — The form text. Every lablab field has a ready-to-paste block. Open the form at https://lablab.ai/event/web-data-unlocked-hackathon/submissions and copy each block into the matching field.

5. **Submit.** Hit the green "Submit" button on lablab. Save the receipt email.

---

## Time budget

If you're starting from a cold morning:

| Task | Time |
|---|---|
| `demo-checklist.md` pre-flight + cache warm | 20 min |
| Read `video-script.md` start to finish once | 5 min |
| Practice run (no recording) | 5 min |
| Record + re-record if needed | 30 min |
| Edit + trim + upload to YouTube unlisted | 30 min |
| Fill in lablab form from `lablab-submission.md` | 15 min |
| Final review + submit | 10 min |
| **Total** | **~2 hours** |

---

## What's already done

- Live site deployed: https://longtailscout.com
- GitHub repo public: https://github.com/dholzric/longtail-scout
- Demo password: `Piglet` (set as `DEMO_PASSWORD` env on the Worker)
- All 4 High + 5 Medium + 1 Low Codex security findings closed
- 49 unit tests passing
- 6 MCP tools live
- Niche Recon shipped + pre-warmed

You just need to: record the video, fill the form, hit submit.

---

## What's NOT done

- The video itself (you have to record it — only you can do this part)
- The lablab form submission (only you can submit; it's account-tied)
- The screenshot for slide 3 and slide 7 if you choose to use the deck (one minute in Loom / Snip)

---

## If you hit a problem

- **Site is down on demo day** — check `npx wrangler deploy` from `worker/`, and `curl https://longtailscout.com/api/health`.
- **Bridge / demand server is down** — SSH to .29, check `systemctl status longtail-scout-bridge` and the demand-API service.
- **Live scout is slow** — re-run the curl pre-warm in `demo-checklist.md` step 2.
- **Niche Recon returns 0 niches** — wait 60s and retry; if still failing, switch demo product description per `demo-checklist.md` step 2.

You can also fall back to `?sample=1` mode for a guaranteed deterministic demo replay.
