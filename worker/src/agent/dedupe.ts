import type { Candidate } from "../types";

const BLOCKED_DOMAINS = new Set([
  "linkedin.com", "facebook.com", "twitter.com", "x.com", "instagram.com",
  "youtube.com", "tiktok.com", "wikipedia.org", "crunchbase.com",
  "yelp.com", "indeed.com", "glassdoor.com", "google.com", "bing.com",
  "reddit.com", "quora.com", "medium.com", "substack.com", "github.com",
  "pinterest.com"
]);

export function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function registrableRoot(domain: string): string {
  const parts = domain.split(".");
  if (parts.length <= 2) return domain;
  return parts.slice(-2).join(".");
}

export function dedupeCandidates(candidates: Candidate[]): Candidate[] {
  const seen = new Map<string, Candidate>();
  for (const c of candidates) {
    const domain = extractDomain(c.url);
    const root = registrableRoot(domain);
    if (BLOCKED_DOMAINS.has(root)) continue;
    if (!seen.has(root)) seen.set(root, c);
  }
  return [...seen.values()];
}
