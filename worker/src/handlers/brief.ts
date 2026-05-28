/**
 * /api/brief  (v1.4.0) — POST an operator (+ optional discovered extras), get back a Markdown
 * account brief and a suggested filename. Pure compute (no upstream cost); the drill-down's
 * "export brief" button posts the operator it already has and downloads the result. Lives
 * server-side so the MCP `account_brief` tool and the UI share one implementation.
 */
import type { Env } from "../index";
import type { Operator } from "../types";
import { buildAccountBrief, briefFilename, type BriefExtras } from "../agent/accountBrief";

function authorized(req: Request, env: Env): boolean {
  if (!env.DEMO_PASSWORD) return true;
  return (req.headers.get("authorization") ?? "") === `Bearer ${env.DEMO_PASSWORD}`;
}

export async function briefHandler(req: Request, env: Env): Promise<Response> {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  if (!authorized(req, env)) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { operator?: Operator } & BriefExtras;
  try { body = await req.json(); } catch { return Response.json({ error: "invalid json" }, { status: 400 }); }
  const op = body.operator;
  if (!op || !op.name || !op.url) return Response.json({ error: "missing operator.name/url" }, { status: 400 });

  const markdown = buildAccountBrief(op, { contacts: body.contacts, linkedin: body.linkedin, email: body.email });
  return Response.json({ markdown, filename: briefFilename(op) });
}
