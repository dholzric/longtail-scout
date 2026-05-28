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
 */
export const VERSION = "1.5.1";
