/**
 * Thin Resend HTTP client. We use the public REST API directly so the bundle stays
 * Worker-friendly (no node-specific SDK).
 *
 * Docs: https://resend.com/docs/api-reference/emails/send-email
 */

export interface ResendEmail {
  from: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  reply_to?: string;
  /** Tags for tracking in Resend's dashboard. */
  tags?: { name: string; value: string }[];
}

export interface ResendSendResult {
  ok: boolean;
  id?: string;
  error?: string;
  status?: number;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export async function sendEmail(apiKey: string, payload: ResendEmail): Promise<ResendSendResult> {
  if (!apiKey) return { ok: false, error: "missing RESEND_API_KEY" };
  if (!payload.text && !payload.html) return { ok: false, error: "missing text or html body" };
  try {
    const resp = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        "authorization": `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      return { ok: false, error: errText.slice(0, 500) || `HTTP ${resp.status}`, status: resp.status };
    }
    const json = await resp.json() as { id?: string };
    return { ok: true, id: json.id, status: resp.status };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Validates a Resend "from" address. Until we verify longtailscout.com in Resend's dashboard,
 * the only sender that works is onboarding@resend.dev — which can only deliver to the
 * Resend account-owner's verified email. Good enough for the hackathon demo (Dan's own
 * inbox); update to digest@longtailscout.com once domain verification ships.
 */
export const RESEND_DEFAULT_FROM = "LongTail Scout <onboarding@resend.dev>";
