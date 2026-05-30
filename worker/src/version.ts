/**
 * Single source of truth for the worker/API version. Surfaced in /api/health and the MCP
 * serverInfo. Keep web/src/version.ts in lockstep with this value.
 *
 * Scheme (bump on every shipped change):
 *   patch (1.1.x) — bug fix, security hardening, polish
 *   minor (1.x.0) — new user-facing feature / stretch goal
 *   major (x.0.0) — reserved for a breaking API or pipeline rewrite
 *
 * History:
 *   1.0.0 — lablab "Web Data UNLOCKED" submission baseline
 *   1.1.0 — post-submission security hardening (bridge SSRF guard + drift test, auth DRY)
 *   1.2.0 — Apollo-blind verification: live LinkedIn-absence proof via Bright Data (/api/linkedin-check + MCP tool)
 *   1.3.0 — Contact discovery: email/phone/contact harvested from contact+about pages via Bright Data (/api/contact-discovery + MCP tool)
 *   1.4.0 — Account brief export: one-click Markdown dossier (/api/brief + MCP tool + drill-down download)
 *   1.5.0 — Trigger-event "Act first" feed: re-rank operators by buying-signal strength (/api/triggers + MCP tool)
 *   1.5.1 — docs refresh: README + /about + /docs + /mcp updated for the v1.2–1.5 feature/tool surface (10 MCP tools)
 *   1.5.2 — fix the one-command deploy (root script's `pnpm -C worker deploy` collided with pnpm's reserved `deploy`)
 *   1.6.0 — Signal Radar: live third-party news/funding/expansion triggers via Bright Data (/api/signal-radar + MCP tool). 11 MCP tools.
 *   1.7.0 — Decision-maker finder: owner/founder + LinkedIn profile via Bright Data (/api/decision-maker + MCP tool). 12 MCP tools.
 *   1.7.1 — live-test fixes: MCP tools call handlers in-process (no same-zone loopback 522); contact-name plausibility guard; signal-radar cache key includes opHost.
 *   1.7.2 — data-quality: operator-name cleanup (strip SEO title cruft via domain match); recent-activity nav/single-word junk filter.
 *   1.7.3 — heat-map density: raise /api/businesses page to 1000 (demand index front-loads dupes; 200→16 distinct, 1000→~199); complete submission docs (feature-guide, 12 tools, 118 tests).
 *   1.8.0 — Niche Recon shows TRUE index depth: each vertical's count comes from the demand probe (e.g. ~16,666 electrical, ~42,873 hvac) instead of the capped "30+" sample. Sample still drives Apollo-thinness % + operators.
 *   1.8.1 — Niche Recon response cache (2h, keyed by description; `fresh:true` bypasses+overwrites): warmed result is reproducible so the scripted demo isn't at the mercy of LLM non-determinism.
 *   1.8.2 — Niche Recon perf + geography: probes run in parallel w/ 30s timeout + 24h count cache (cold 69s -> ~25s); suggested scout city is now the top-state flagship metro (was the noisy modal city of a 30-row sample, e.g. "septic service in Apple Valley").
 *   1.8.3 — Niche Recon / demand-probe speed: send count_only=1 to /api/research so the demand server returns just the count (skips ~18s of per-domain registrar+scoring). Pairs with domainsearch api count_only fast path.
 */
export const VERSION = "1.8.3";
