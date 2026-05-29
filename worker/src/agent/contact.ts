/**
 * Pull contact info out of the operator's homepage HTML.
 *
 * Phone — `tel:` href links first (highest confidence), then US-format regex
 * over the plain-text rendering. Owner/leader — looks for "founded by",
 * "owned by", "CEO/Founder/President/Owner: <Name>" + a few common patterns.
 *
 * Zero added cost — runs over HTML we already have.
 */

export interface ContactInfo {
  /** Best-guess phone number in raw form (we don't normalize to E.164 client-side). null if nothing parseable. */
  phone: string | null;
  /** Owner / founder / CEO / president name + role tag, if parseable. */
  contact: { name: string; role: string } | null;
}

const PHONE_TEL_RE = /href=["']tel:([^"']{7,40})["']/i;
const PHONE_TEXT_RE = /\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/;

function cleanPhone(s: string): string {
  // Strip leading +1, parens, dashes, dots, spaces — return a (xxx) xxx-xxxx form for display.
  const digits = s.replace(/[^\d]/g, "").replace(/^1(\d{10})$/, "$1");
  if (digits.length !== 10) return s.trim();
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function plainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

function extractPhone(html: string): string | null {
  if (!html) return null;
  // 1. tel: anchor — strongest signal
  const telMatch = html.match(PHONE_TEL_RE);
  if (telMatch && telMatch[1]) return cleanPhone(telMatch[1]);
  // 2. footer / contact section regex
  const plain = plainText(html);
  const phoneMatch = plain.match(PHONE_TEXT_RE);
  if (phoneMatch && phoneMatch[0]) return cleanPhone(phoneMatch[0]);
  return null;
}

const ROLE_KEYWORDS = ["founder", "co-founder", "ceo", "president", "owner", "managing partner", "principal", "general manager", "head of"];

/** Common words that capitalize at the start of a sentence/testimonial and get mis-captured as a
 *  person name (e.g. "Was Very ... Owner" → "Was Very"). A real name token is never one of these. */
const NON_NAME_TOKENS = new Set([
  "was", "very", "the", "our", "we", "this", "that", "they", "their", "great", "best", "highly",
  "would", "will", "call", "free", "get", "your", "you", "service", "services", "quality",
  "professional", "honest", "reliable", "thank", "thanks", "definitely", "i", "my", "his", "her",
  "a", "an", "and", "for", "with", "from", "about", "contact", "home", "team", "us", "is", "are",
  "very", "so", "such", "what", "when", "where", "why", "how", "good", "amazing", "excellent"
]);

/** Reject obvious non-names: must be 2–3 capitalized tokens and contain no common English filler
 *  word. Guards against testimonial/marketing text bleeding into the contact name. */
function isPlausiblePersonName(name: string): boolean {
  const tokens = name.trim().split(/\s+/);
  if (tokens.length < 2 || tokens.length > 3) return false;
  for (const t of tokens) {
    if (NON_NAME_TOKENS.has(t.toLowerCase())) return false;
    if (!/^[A-Z][A-Za-z.'’-]*$/.test(t)) return false;
  }
  return true;
}

/**
 * Detect a likely person name. We look for patterns like:
 *   "Bob Smith, Founder" / "Founded by Bob Smith" / "CEO: Bob Smith" / "Owner — Bob Smith"
 * Then validate the name with a loose "Capitalized word + Capitalized word" check.
 */
function extractContact(html: string): { name: string; role: string } | null {
  if (!html) return null;
  // Try JSON-LD Person markup first (rare but most reliable)
  try {
    const ldMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    for (const m of ldMatches) {
      try {
        const data = JSON.parse((m[1] ?? "").trim());
        const candidates = Array.isArray(data) ? data : [data];
        for (const node of candidates) {
          const founder = node?.founder?.name ?? node?.founder;
          if (typeof founder === "string" && isPlausiblePersonName(founder.trim())) return { name: founder.trim(), role: "Founder" };
        }
      } catch { /* malformed json-ld */ }
    }
  } catch { /* skip */ }

  const plain = plainText(html);

  // Pattern A: "Founder/Owner/CEO Bob Smith" or "Founder, Bob Smith" or "Founder: Bob Smith"
  for (const role of ROLE_KEYWORDS) {
    const re = new RegExp(`\\b(${role})\\b[\\s:,\\-—]+([A-Z][a-z]+(?:\\s+[A-Z]\\.?)?\\s+[A-Z][a-z]+)`, "i");
    const m = plain.match(re);
    if (m && m[2] && isPlausiblePersonName(m[2].trim())) return { name: m[2].trim(), role: titleCase(role) };
  }
  // Pattern B: "<Name>, <Role>" e.g. "Bob Smith, Founder"
  for (const role of ROLE_KEYWORDS) {
    const re = new RegExp(`([A-Z][a-z]+(?:\\s+[A-Z]\\.?)?\\s+[A-Z][a-z]+)\\s*[,—\\-]\\s*(${role})\\b`, "i");
    const m = plain.match(re);
    if (m && m[1] && isPlausiblePersonName(m[1].trim())) return { name: m[1].trim(), role: titleCase(role) };
  }
  // Pattern C: "Founded by <Name>" / "Owned by <Name>"
  const foundedBy = plain.match(/\b(?:founded|started|owned|run)\s+by\s+([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)/i);
  if (foundedBy && foundedBy[1] && isPlausiblePersonName(foundedBy[1].trim())) return { name: foundedBy[1].trim(), role: "Founder" };

  return null;
}

function titleCase(s: string): string {
  return s.split(/[\s-]/).map(w => w.length === 0 ? w : w[0]!.toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

export function extractContactInfo(html: string): ContactInfo {
  return {
    phone: extractPhone(html),
    contact: extractContact(html)
  };
}
