/**
 * /api/draft-email — generate a personalized cold-email draft for one operator.
 *
 * The drill-down's static template is the safe default. This endpoint is the "wow"
 * path: an LLM call that weaves the operator's actual about/hiring/recent_activity
 * into a short, specific email a real SDR could send. Costs ~$0.0001 per call.
 */
import type { Env } from "../index";
import { llmCall } from "../llm/client";

interface DraftRequest {
  operator?: {
    name?: string;
    url?: string;
    about?: string | null;
    icp_fit_reason?: string;
    sales_angle?: string;
    size_estimate?: string | null;
    hiring?: { count?: number | null; roles?: string[] };
    recent_activity?: { headline?: string }[];
    city?: string;
  };
  /** Optional buyer context — what your SaaS sells. Defaults to a generic vertical-SaaS pitch. */
  buyer?: { product?: string; vertical?: string };
}

interface DraftResponse {
  subject: string;
  body: string;
  /** Provider used to generate it — so the UI can attribute correctly. */
  provider: string;
  /** Approximate cost in USD for this single call (DeepSeek pricing). */
  estimated_cost_usd: number;
}

function authorized(req: Request, env: Env): boolean {
  if (!env.DEMO_PASSWORD) return true;
  const h = req.headers.get("authorization") ?? "";
  return h === `Bearer ${env.DEMO_PASSWORD}`;
}

export async function draftEmailHandler(req: Request, env: Env): Promise<Response> {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  if (!authorized(req, env)) return new Response("unauthorized", { status: 401 });

  let body: DraftRequest;
  try { body = await req.json(); } catch { return Response.json({ error: "invalid json" }, { status: 400 }); }
  const op = body.operator;
  if (!op || !op.name || !op.url) return Response.json({ error: "missing operator.name/url" }, { status: 400 });

  // Cheap sanity caps — we don't want a multi-megabyte request burning our LLM budget.
  const about = (op.about ?? "").slice(0, 1200);
  const fit = (op.icp_fit_reason ?? "").slice(0, 400);
  const angle = (op.sales_angle ?? "").slice(0, 400);
  const roles = (op.hiring?.roles ?? []).slice(0, 5).join(", ");
  const recent = (op.recent_activity ?? []).slice(0, 3).map(r => r.headline).filter(Boolean).join(" | ").slice(0, 300);
  const product = (body.buyer?.product ?? "ServiceTitan-style vertical SaaS").slice(0, 120);
  const vertical = (body.buyer?.vertical ?? "field service").slice(0, 60);

  const system = `You are a senior SDR at a vertical-SaaS company. Write short, specific cold emails that reference one concrete detail about the recipient's business. Never use buzzwords ("unlock", "leverage", "synergy", "game-changing"). Always under 100 words. Always end with a single low-friction CTA ("worth a 15-min call?" or "is next Tuesday morning open?"). No "I hope this finds you well" openers. No emoji.`;
  const user = `Recipient: ${op.name}
Website: ${op.url}
${op.city ? `City: ${op.city}` : ""}
About them: ${about || "(no about found)"}
Why we think they fit: ${fit || "(none provided)"}
Sales angle drafted by our analyst: ${angle || "(none)"}
Hiring signals: ${op.hiring?.count ?? 0} open roles${roles ? ` (${roles})` : ""}
Recent activity: ${recent || "(none)"}
Company size: ${op.size_estimate ?? "unknown"}

What our SaaS does: ${product} for the ${vertical} vertical.

Write the cold email. Return JSON with this exact shape:
{
  "subject": "<8 words max, specific>",
  "body": "<3-5 short paragraphs, hand-typed feel, references at least one specific fact>"
}`;

  let result;
  try {
    result = await llmCall(env, {
      system,
      messages: [{ role: "user", content: user }],
      responseFormat: "json_object",
      maxTokens: 400
    });
  } catch (err) {
    return Response.json({ error: "llm call failed", detail: (err as Error).message }, { status: 502 });
  }

  const choice = result.response.choices[0];
  const content = choice?.message?.content ?? "";
  let parsed: { subject?: string; body?: string };
  try {
    parsed = JSON.parse(content);
  } catch {
    return Response.json({ error: "llm returned non-json", raw: content.slice(0, 500) }, { status: 502 });
  }
  if (!parsed.subject || !parsed.body) {
    return Response.json({ error: "llm response missing subject/body", raw: content.slice(0, 500) }, { status: 502 });
  }

  // Approx DeepSeek pricing: $0.27/M input, $1.10/M output. Estimate via response.usage.
  const usage = result.response.usage;
  const inTok = usage?.prompt_tokens ?? 0;
  const outTok = usage?.completion_tokens ?? 0;
  const estimated_cost_usd = (inTok / 1_000_000) * 0.27 + (outTok / 1_000_000) * 1.10;

  const resp: DraftResponse = {
    subject: parsed.subject.slice(0, 120),
    body: parsed.body.slice(0, 2000),
    provider: result.provider,
    estimated_cost_usd: Number(estimated_cost_usd.toFixed(6))
  };
  return Response.json(resp);
}
