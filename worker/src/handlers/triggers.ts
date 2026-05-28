/**
 * /api/triggers  (v1.5.0) — POST a run's operators, get them re-ranked by buying-signal strength
 * ("who should an SDR call first?"). Pure compute (no upstream cost); the UI posts the operators
 * it already has once the run completes, and the MCP `rank_triggers` tool shares this path.
 */
import type { Env } from "../index";
import type { Operator } from "../types";
import { scoreTriggers } from "../agent/triggers";

function authorized(req: Request, env: Env): boolean {
  if (!env.DEMO_PASSWORD) return true;
  return (req.headers.get("authorization") ?? "") === `Bearer ${env.DEMO_PASSWORD}`;
}

export async function triggersHandler(req: Request, env: Env): Promise<Response> {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  if (!authorized(req, env)) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { operators?: Operator[] };
  try { body = await req.json(); } catch { return Response.json({ error: "invalid json" }, { status: 400 }); }
  const ops = Array.isArray(body.operators) ? body.operators : [];
  if (ops.length === 0) return Response.json({ triggers: [] });

  // Cap the input so a giant POST can't be used to burn CPU.
  return Response.json({ triggers: scoreTriggers(ops.slice(0, 100)) });
}
