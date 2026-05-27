import type { Candidate } from "../types";

const BLOCKED_DOMAINS = new Set([
  // Social
  "linkedin.com", "facebook.com", "twitter.com", "x.com", "instagram.com",
  "youtube.com", "tiktok.com", "pinterest.com",
  // Reference / knowledge
  "wikipedia.org", "quora.com", "medium.com", "substack.com",
  // Code / repos
  "github.com",
  // Search / dirs / job boards
  "google.com", "bing.com", "yandex.com", "yahoo.com",
  "yelp.com", "indeed.com", "glassdoor.com", "ziprecruiter.com",
  "reddit.com", "scholar.google.com",
  // Business / startup directories + listing sites
  "crunchbase.com", "builtin.com", "tracxn.com", "wellfound.com", "angellist.com",
  "globalspec.com", "thomasnet.com", "europages.com", "kompass.com",
  "owler.com", "rocketreach.co", "zoominfo.com", "apollo.io",
  "manta.com", "bbb.org", "yellowpages.com", "dnb.com",
  // News / press / blogs / aggregators
  "techcrunch.com", "prnewswire.com", "businesswire.com",
  "bizjournals.com", "innovationmap.com", "spacenews.com",
  "texasstandard.org", "khou.com", "click2houston.com", "abc13.com",
  "houstonchronicle.com", "houstoniamag.com",
  "auvsi.org", "skywatch.ai", "ascendurepro.com", "fifthlevelconsulting.com",
  "thedroneu.com", "afd-systems.com", "flypix.ai", "landbase.com",
  "modalai.com", "econsortium.com", "sciencedirect.com",
  // Gov + EDU + chambers
  "nasa.gov", "houston.org", "fly2houston.com", "bayareahouston.com",
  "businessintexas.com", "gov.texas.gov", "uh.edu", "edu",
  // Fortune-500 primes (we want long tail, not them)
  "boeing.com", "lockheedmartin.com", "raytheon.com", "northropgrumman.com",
  "spacex.com", "blueorigin.com", "airbus.com", "honeywell.com"
]);

const BLOCKED_URL_PATTERNS = [
  /\/list\b|\/top-\d+|\/best-|\/companies-in-|\/startups-in-/i,
  /\/news\/|\/blog\/|\/article\//i,
  /-comprehensive-list|-companies-and-startups/i,
  /#:~:text=/  // Google text-fragment results — usually deep-link list/news pages
];

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
    if (BLOCKED_URL_PATTERNS.some(p => p.test(c.url))) continue;
    if (!seen.has(root)) seen.set(root, c);
  }
  return [...seen.values()];
}
