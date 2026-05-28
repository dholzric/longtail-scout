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
  "spacex.com", "blueorigin.com", "airbus.com", "honeywell.com",
  // Roofing-manufacturer directories (NOT the contractors we want)
  "gaf.com", "certainteed.com", "iko.com", "owenscorning.com", "tamko.com",
  "malarkey.com", "atlasroofing.com", "carlislesyntec.com", "firestonebpco.com",
  // Cost guides, lead-gen aggregators, comparison sites
  "fixr.com", "homeadvisor.com", "angi.com", "angieslist.com",
  "thumbtack.com", "porch.com", "houzz.com", "buildzoom.com",
  "roofingcalculator.org", "downtobid.com", "modernize.com",
  "googlereviews.com", "consumeraffairs.com", "trustpilot.com",
  // Generic "near me" / "best of" SEO content farms
  "homeguide.com", "nearby.help", "expertise.com"
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

/** Tracking / referral params we strip during canonicalization. */
const NOISE_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "fbclid", "gclid", "msclkid", "ref", "ref_src", "referrer", "_ga", "_gl",
  "mc_cid", "mc_eid", "yclid", "campaign_id", "source", "trk", "trk_q"
]);

/**
 * Normalize an operator URL so equivalents dedupe AND so we render the homepage during enrichment,
 * not a deep landing-path SERP hit. Strips UTM/clid query params, lowercases hostname, collapses to
 * the root path (`/`). If the input URL is already deep into a useful path (e.g. /locations/houston),
 * keep that path — only collapse the obvious "noise" paths.
 */
export function canonicalizeUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    u.protocol = "https:";
    u.port = "";
    u.hash = "";
    // Strip noise params
    const keepParams = new URLSearchParams();
    for (const [k, v] of u.searchParams) {
      if (!NOISE_PARAMS.has(k.toLowerCase())) keepParams.append(k, v);
    }
    u.search = keepParams.toString() ? `?${keepParams.toString()}` : "";
    // Collapse trailing slash + index.html on the path
    let path = u.pathname;
    path = path.replace(/\/index\.html?$/i, "/");
    path = path.replace(/\/+$/, "");
    if (!path) path = "/";
    u.pathname = path;
    return u.toString();
  } catch {
    return rawUrl;
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
    // Canonicalize the URL we keep, so enrichment renders the homepage rather than a deep
    // landing-path SERP hit. Preserves any first-class /locations/<city> path, strips noise.
    const canonical = canonicalizeUrl(c.url);
    if (!seen.has(root)) seen.set(root, { ...c, url: canonical });
  }
  return [...seen.values()];
}
