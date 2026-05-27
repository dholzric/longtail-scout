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
 * Sender used by every Resend send in this codebase. quiltmap.com is already verified on the
 * Resend account so emails deliver to any recipient (not just the account-owner). Display name
 * "LongTail Scout" — most mail clients show that, not the bare address. Verify longtailscout.com
 * in Resend (paid plan or after deleting quiltmap.com from the same account) to swap this for
 * digest@longtailscout.com.
 */
export const RESEND_DEFAULT_FROM = "LongTail Scout <longtailscout@quiltmap.com>";
