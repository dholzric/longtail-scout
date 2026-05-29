/**
 * Decision-maker classifier — the pure half of v1.7.0.
 *
 * Closes the GTM loop: who, specifically, do I contact? Parses the results of a
 * `"<company>" (owner OR founder …) site:linkedin.com/in` search (run through Bright Data by the
 * handler) into named people with their LinkedIn profile + title, validates each belongs to THIS
 * company (or matches a known contact name), and ranks owner/founder/CEO roles first.
 */
import { nameMatchesText, normalizeBizName } from "./linkedinPresence";

export interface Person {
  name: string;
  title: string | null;
  profile_url: string | null;
  source_host: string;
}

interface SerpLikeResult { title: string; link: string; snippet: string; position: number }

/** A LinkedIn personal profile (/in/…) — not a company page, not a post. */
export function isLinkedInPersonUrl(url: string): boolean {
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return false;
  return /^\/in\//i.test(u.pathname);
}

/** LinkedIn person titles read "Name - Role - Company | LinkedIn" (any dash variant). */
export function parseLinkedInPersonTitle(title: string): { name: string; role: string | null } {
  const t = title.replace(/\s*[|｜]\s*LinkedIn\s*$/i, "").trim();
  const parts = t.split(/\s+[-–—]\s+/).map(s => s.trim()).filter(Boolean);
  return { name: parts[0] ?? "", role: parts.length > 1 ? (parts[1] ?? null) : null };
}

/** 2–4 capitalized word-ish tokens — enough to reject "acme roofing houston tx" as a name. */
function looksLikePersonName(s: string): boolean {
  return /^[A-Z][A-Za-z.'’-]+(?:\s+[A-Z][A-Za-z.'’-]+){1,3}$/.test(s.trim());
}

const DECISION_ROLE_RE = /(owner|founder|co-?founder|ceo|president|principal|managing\s+(partner|director)|partner|proprietor)/i;

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
}

export function classifyPeopleResults(company: string, results: SerpLikeResult[], knownName?: string): Person[] {
  const seen = new Set<string>();
  const people: Person[] = [];
  for (const r of results) {
    if (!isLinkedInPersonUrl(r.link)) continue;
    const { name, role } = parseLinkedInPersonTitle(r.title);
    if (!looksLikePersonName(name)) continue;
    const text = `${r.title} ${r.snippet}`;
    const companyMatch = nameMatchesText(company, text);
    const knownMatch = knownName ? nameMatchesText(knownName, name) : false;
    if (!companyMatch && !knownMatch) continue;
    const key = normalizeBizName(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    people.push({ name, title: role, profile_url: r.link, source_host: hostOf(r.link) });
  }
  // Decision-maker roles first, otherwise preserve discovery order.
  people.sort((a, b) => (DECISION_ROLE_RE.test(b.title ?? "") ? 1 : 0) - (DECISION_ROLE_RE.test(a.title ?? "") ? 1 : 0));
  return people.slice(0, 5);
}
