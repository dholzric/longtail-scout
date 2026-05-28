/**
 * Trigger-event scorer — the pure half of v1.5.0 "Act first" feed.
 *
 * Re-ranks a run's operators by buying-signal strength so an SDR knows who to call FIRST. Uses
 * only evidence we already scraped: open roles (with a premium for growth/ops hires), recent
 * expansion/funding/award headlines (weighted by recency), and multi-vertical presence. Pure and
 * deterministic — recency is measured against an injected `now` so the feed and tests agree.
 */
import type { Operator } from "../types";

export interface TriggerResult {
  url: string;
  name: string;
  /** 0-100 composite buying-signal score. */
  trigger_score: number;
  /** Human-readable contributing signals, strongest first. */
  reasons: string[];
  /** The single strongest reason — what the UI leads with. */
  primary_reason: string;
}

/** Roles that imply a growth / operational-change moment (a buying trigger for vertical SaaS). */
const GROWTH_ROLE_RE = /(estimator|operations|ops|manager|director|foreman|superintendent|recruit|sales|controller|project manager|gm|head of)/i;

/** Headline keywords that signal a trigger event worth acting on now. */
const EVENT_RE = /(expand|expansion|new location|opens?|opening|grand opening|fund|raised|series\s+[a-d]|acqui|merger|award|wins?|won|grant|partnership|launch|milestone|new branch|relocat)/i;

const RECENT_DAYS = 90;

function daysAgo(dateStr: string, now: number): number | null {
  if (!dateStr) return null;
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return null;
  return (now - t) / 86400_000;
}

function scoreOne(op: Operator, now: number): TriggerResult | null {
  let score = 0;
  const weighted: { w: number; reason: string }[] = [];

  // ── Hiring ────────────────────────────────────────────────────────────────
  const count = op.hiring?.count ?? 0;
  if (count > 0) {
    const hiringPts = Math.min(count * 10, 40);
    score += hiringPts;
    const growthRoles = (op.hiring.roles ?? []).filter(r => GROWTH_ROLE_RE.test(r));
    let reason = `${count} open role${count === 1 ? "" : "s"}`;
    if (growthRoles.length > 0) {
      score += 15;
      reason += ` incl. ${growthRoles.slice(0, 2).join(", ")}`;
    }
    weighted.push({ w: hiringPts + (growthRoles.length > 0 ? 15 : 0), reason: `Hiring: ${reason}` });
  }

  // ── Recent activity ─────────────────────────────────────────────────────────
  let recentPts = 0;
  for (const a of op.recent_activity ?? []) {
    if (!a.headline) continue;
    let pts = 8;
    const isEvent = EVENT_RE.test(a.headline);
    if (isEvent) pts += 16;
    const age = daysAgo(a.date, now);
    if (age !== null && age <= RECENT_DAYS) pts += 10;
    else if (age !== null && age > 365) pts -= 6; // stale — discount
    pts = Math.max(0, pts);
    recentPts += pts;
    if (pts > 0) weighted.push({ w: pts, reason: `Recent: ${a.headline.slice(0, 80)}` });
  }
  score += Math.min(recentPts, 45);

  // ── Multi-vertical presence (multi-tool buyer) ───────────────────────────────
  const crossNiche = op.memory?.cross_niche?.length ?? 0;
  if (crossNiche > 0) {
    const pts = Math.min(crossNiche * 5, 10);
    score += pts;
    weighted.push({ w: pts, reason: `Appears in ${crossNiche + 1} verticals — multi-tool buyer` });
  }

  // ── Fresh to the index ───────────────────────────────────────────────────────
  if (op.memory?.memory_state === "new") {
    score += 5;
    weighted.push({ w: 5, reason: "New to the index" });
  }

  if (score <= 0 || weighted.length === 0) return null;
  score = Math.max(0, Math.min(100, Math.round(score)));
  weighted.sort((a, b) => b.w - a.w);
  return {
    url: op.url,
    name: op.name,
    trigger_score: score,
    reasons: weighted.map(w => w.reason),
    primary_reason: weighted[0]!.reason
  };
}

export function scoreTriggers(ops: Operator[], now: number = Date.now()): TriggerResult[] {
  return ops
    .map(o => scoreOne(o, now))
    .filter((r): r is TriggerResult => r !== null)
    .sort((a, b) => b.trigger_score - a.trigger_score);
}
