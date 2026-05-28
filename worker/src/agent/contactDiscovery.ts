/**
 * Contact-discovery extraction — the pure half of v1.3.0.
 *
 * Turns each operator from "a company" into "a person + an inbox to email." The handler fetches
 * the operator's contact/about pages via Bright Data; this module decides which emails are real,
 * usable business addresses (ranking the operator's own-domain inbox first) and reuses the
 * homepage phone/person extractor from agent/contact.ts.
 */
import { extractContactInfo, type ContactInfo } from "./contact";

export interface DiscoveredEmail {
  email: string;
  /** True when the email's domain matches the operator's own website — the highest-value inbox. */
  same_domain: boolean;
}

// Deliberately conservative — one email per match, no consecutive dots, normal TLD lengths.
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}/gi;

// Asset filenames (logo@2x.png), error-tracking, site-builder internals, and the placeholder
// addresses that litter template sites. None of these are a real operator inbox.
const JUNK_LOCAL = /^(your|youremail|email|name|user|example|test|noreply|no-reply|donotreply)$/i;
const JUNK_DOMAIN = /(sentry\.io|wixpress\.com|example\.(com|org|net)|domain\.com|yourcompany\.com|yourdomain\.com|email\.com|sentry-next\.wixpress\.com|2x\.(png|jpg|jpeg|gif|webp|svg))$/i;
const ASSET_EXT = /\.(png|jpe?g|gif|webp|svg|css|js)$/i;

function siteRoot(hostname?: string): string {
  return (hostname ?? "").replace(/^www\./i, "").toLowerCase();
}

/** Extract usable business emails from page HTML, ranked with the operator's own-domain inbox
 *  first. Capped to avoid dumping a harvested address list. */
export function extractEmails(html: string, siteHostname?: string): DiscoveredEmail[] {
  if (!html) return [];
  const root = siteRoot(siteHostname);
  const seen = new Set<string>();
  const out: DiscoveredEmail[] = [];
  for (const raw of html.matchAll(EMAIL_RE)) {
    const email = raw[0].toLowerCase();
    if (seen.has(email)) continue;
    if (ASSET_EXT.test(email)) continue;
    const [local, domain] = email.split("@");
    if (!local || !domain) continue;
    if (JUNK_LOCAL.test(local)) continue;
    if (JUNK_DOMAIN.test(domain)) continue;
    seen.add(email);
    out.push({ email, same_domain: root.length > 0 && domain.replace(/^www\./, "") === root });
  }
  // Own-domain inboxes first, then insertion order.
  out.sort((a, b) => Number(b.same_domain) - Number(a.same_domain));
  return out.slice(0, 10);
}

export interface ContactDiscoveryResult extends ContactInfo {
  emails: DiscoveredEmail[];
}

/** Combine the homepage phone/person extractor with email harvesting over a page's HTML. */
export function extractAllContacts(html: string, siteHostname?: string): ContactDiscoveryResult {
  const info = extractContactInfo(html);
  return { ...info, emails: extractEmails(html, siteHostname) };
}
