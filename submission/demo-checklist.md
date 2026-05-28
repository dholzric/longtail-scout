# Demo-day pre-flight checklist

**Run this checklist 20 minutes before recording.** All of it. Don't skip steps to "save time" — the failure modes here cost more recording time than the checks themselves.

Open this file in a tab and tick each box as you go.

---

## 1. Backend health (5 min)

Open a terminal. Run each command; expected result follows.

```bash
# Cloudflare Worker — should return {"ok":true,"ts":...}
curl -s https://longtailscout.com/api/health
```
**If it fails:** check `npx wrangler deploy` from `E:/hack2/worker`. Don't proceed if this is broken.

```bash
# Bright Data bridge on .29 — should return {"ok":true,...,"browser_connected":true/false}
curl -s https://bridge.longtailscout.com/health
```
**If `browser_connected: false`:** that's fine, it'll connect on first /render. **If the whole call fails:** SSH to .29 and check `systemctl status longtail-scout-bridge`. The video will still record without it but live scouts that need JS-rendered pages will degrade.

```bash
# Demand index on .29 — should return JSON with a "demand" number
curl -s "https://demand.longtailscout.com/api/research?q=roofing&tlds=com&limit=1" | head -c 200
```
**If it fails:** SSH to .29, check the FastAPI service. Without this the demand probe and Niche Recon both break.

```bash
# MCP discovery — should list 6 tools
curl -s https://longtailscout.com/api/mcp | python -c "import sys,json; d=json.load(sys.stdin); print(f'tools: {len(d[\"tools\"])}'); [print(' -',t['name']) for t in d['tools']]"
```
**Expected:** `tools: 6` with `scout, find_businesses, demand_count, operator_screenshot, draft_email, niche_recon`.

---

## 2. Pre-warm the demo paths (5 min)

The demo uses two queries. Pre-warming them means they return from KV cache instead of hitting Bright Data live during recording. Saves you 30-60 seconds of dead air per take.

**Run the demo scout once now so its result is cached:**

```bash
# Burns ~$0.03 of BD/LLM, then we have a warm cache for the rest of the day
curl -X POST https://longtailscout.com/api/scout \
  -H "authorization: Bearer Piglet" \
  -H "content-type: application/json" \
  -d '{"query":"roofing contractors in Houston"}' \
  --max-time 90 -o /tmp/warm-scout.txt
echo "scout done, $(wc -l < /tmp/warm-scout.txt) SSE events written"
```
**Expected:** prints a line count > 80. The KV cache now has this query's discovery SERP results, enriched homepages, and the synthesis output. Re-runs from any browser will hit those caches and return in 5-10s instead of 40s+.

**Pre-warm Niche Recon with the demo product description:**

```bash
curl -X POST https://longtailscout.com/api/niche-recon \
  -H "authorization: Bearer Piglet" \
  -H "content-type: application/json" \
  -d '{"product_description":"home services CRM and scheduling for trades — quotes, dispatch, mobile job sheets, GPS tracking, payments"}' \
  --max-time 120 -o /tmp/warm-recon.txt
echo "recon done; first niches:"; python -c "import json; d=json.load(open('/tmp/warm-recon.txt')); [print(' ',n['niche'],'thin='+str(int(n['thinness_pct']*100))+'%') for n in d.get('niches',[])]"
```
**Expected:** 3-5 niches print. Top niches should include plumbing, hvac, electrical with high thinness (50-100%). The cache is now warm for the recording.

**If Niche Recon returns 0 niches:** the demand server is overloaded. Wait 60 seconds and re-run. If it still fails, switch the demo to a different product description (try `"appointment scheduling software for personal services like hair, nails, lashes, massage, brow studios"`).

---

## 3. Browser setup (5 min)

1. **Close every other tab and window.** Chrome should have one window with one tab.
2. **Hide bookmarks bar.** (`Ctrl+Shift+B` on Windows.)
3. **Disable any extensions visible in the toolbar** that might pop notifications.
4. **Open the demo URL:** `https://longtailscout.com/?key=Piglet`
   The `?key=Piglet` will auto-unlock the demo (the SPA captures it into localStorage on first load and strips it from the URL). After the redirect the URL bar shows just `longtailscout.com`.
5. **Verify the demo is unlocked** — there should be NO yellow "Demo password required" banner. If you see one, paste `Piglet` and click Unlock.
6. **Verify the demand probe works** — type a few characters into the query input (`roo...`) and watch for the green dot + "N businesses match" message below it. If it never appears, the worker auth chain broke — re-check the URL has `?key=Piglet`.
7. **Clear the input back to empty** (or leave it on the default "roofing contractors in Houston").
8. **Browser zoom: 100%.** (`Ctrl+0`.)
9. **Devtools closed.** (`F12` to toggle if open.)

---

## 4. Recording setup

- **Resolution:** 1920×1080. Browser should be maximized but not fullscreen (you want the title bar visible).
- **Cursor visibility:** turn on "Highlight cursor" / "Show clicks" in your recorder (OBS: Settings → Sources → Display Capture. Loom: built-in.).
- **Audio:** external mic if you have one. **Test recording** 10 seconds of dead air to check ambient noise.
- **Practice run:** read the script aloud once without recording. Time it. Target is 85-90 seconds. If you're going over 95s, you're talking too slow or adding asides.

---

## 5. Backup plans

If something breaks mid-recording, here's the recovery path for each failure:

| What breaks | Recovery |
|---|---|
| Scout takes >60s during the take | Stop the take, re-run the curl pre-warm in step 2, restart. |
| Demand probe shows "—" | Check that `?key=Piglet` is still in `localStorage` (Application tab in devtools → Local Storage → look for `lts_demo_key`). |
| Niche Recon returns "no niches found" | Use the sample-mode URL: `https://longtailscout.com/?sample=1&q=roofing+contractors+in+Houston&key=Piglet` — runs deterministically from cache. |
| Live scout returns 0 operators | Switch to `?sample=1` mode for the recording. Mention it offhand or skip the comment entirely; the visuals are identical. |
| Map shows 0 of N geocoded | Skip the map view in the take. Stick with the table view. |
| Browser cleared the demo key | Re-open `https://longtailscout.com/?key=Piglet`. |

---

## 6. Final pre-take sanity

Click the "Run scout" button on the home page **without recording**. Watch the trace fly by. You should see:

- Phase events: "discovery", "enrichment", "synthesis"
- A handful of "candidate" events with operator names
- The cost meter at the top ticking up to ~$0.03
- A result table appearing with 8-10 ranked operators

If this preview-run works smoothly, you're ready. Hit record.
