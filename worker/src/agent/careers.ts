/**
 * Parse a careers page into a real list of job postings.
 *
 * Strategy: ATS detection first (Greenhouse, Lever, Workday, Ashby, BambooHR, Workable —
 * those have predictable URL patterns AND inlined posting elements), then generic patterns
 * (repeated <li>/<article>/<a> structures with role-like text). Returns 0 confidently if no
 * structure matches.
 */

export interface ParsedJobs {
  /** Real count of distinct postings found on the page. 0 = "page looks empty / fallback". */
  count: number;
  /** First N role titles, cleaned. */
  roles: string[];
  /** Which ATS pattern matched, or "generic"/"fallback" — surfaced as a citation tool. */
  pattern: string;
}

const COMMON_TITLE_NOISE = /^(?:learn more|apply now|view (?:all|details|job)|see (?:more|all)|read more|open positions?|careers?|jobs?|all jobs|join (?:our|the) team|view position|details)$/i;
const ROLE_HINTS = /\b(engineer|developer|designer|manager|director|architect|sales|marketing|technician|installer|estimator|foreman|roofer|electrician|plumber|hvac|driver|operator|specialist|consultant|coordinator|analyst|administrator|representative|associate|assistant|supervisor|lead|account|customer|product|support|service|chef|cook|server|nurse|hygienist|paralegal|attorney|architect|accountant|bookkeeper|teacher|trainer)\b/i;

// Patterns that disqualify a candidate string from being a job title — phone country codes,
// emails, "see more", calendar headings, etc. Catches the contact-form phone dropdown that
// otherwise matched ("Cook Islands +682"-shaped strings).
const NOT_A_TITLE = /\+\d{1,4}\b|\(\d{3}\)\s*\d{3}|@[\w.-]+\.[a-z]{2,}|^\d{4}\b|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i;

function looksLikeRoleTitle(s: string): boolean {
  const trimmed = s.trim();
  if (!trimmed || trimmed.length < 5 || trimmed.length > 80) return false;
  if (COMMON_TITLE_NOISE.test(trimmed)) return false;
  if (NOT_A_TITLE.test(trimmed)) return false;
  // First character must be a letter (titles look like "Roofing Estimator", not "+682" or "$50/hr")
  if (!/^[A-Za-z]/.test(trimmed)) return false;
  // Role keyword must be a substantial fraction of the text — guards against multi-paragraph
  // <li>s that happen to contain a role word somewhere ("Get a free estimate from our manager…")
  const m = trimmed.match(ROLE_HINTS);
  if (!m) return false;
  if (trimmed.length > m[0].length * 6) return false; // role keyword should be ≥ 1/6 of the title
  return true;
}

function cleanTitle(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function dedupe<T extends string>(xs: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of xs) {
    const k = x.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

/** Greenhouse: <div class="opening">…<a>Title</a></div> or job-board iframe lists. */
function parseGreenhouse(html: string): ParsedJobs | null {
  if (!/greenhouse|boards\.greenhouse\.io/i.test(html)) return null;
  const titles: string[] = [];
  for (const m of html.matchAll(/<div[^>]+class=["'][^"']*opening[^"']*["'][^>]*>[\s\S]*?<a[^>]*>([^<]{3,100})<\/a>/gi)) {
    const t = cleanTitle(m[1] ?? "");
    if (t && !COMMON_TITLE_NOISE.test(t)) titles.push(t);
  }
  if (titles.length === 0) return null;
  const roles = dedupe(titles).slice(0, 12);
  return { count: roles.length, roles, pattern: "greenhouse" };
}

/** Lever: <a class="posting-title">…<h5>Title</h5></a> on jobs.lever.co. */
function parseLever(html: string): ParsedJobs | null {
  if (!/lever\.co|posting-title/i.test(html)) return null;
  const titles: string[] = [];
  for (const m of html.matchAll(/<h5[^>]*>([^<]{3,100})<\/h5>/gi)) {
    const t = cleanTitle(m[1] ?? "");
    if (t && !COMMON_TITLE_NOISE.test(t)) titles.push(t);
  }
  if (titles.length === 0) return null;
  const roles = dedupe(titles).slice(0, 12);
  return { count: roles.length, roles, pattern: "lever" };
}

/** Workday: data-automation-id="jobTitle" links. */
function parseWorkday(html: string): ParsedJobs | null {
  if (!/workday|myworkdayjobs/i.test(html)) return null;
  const titles: string[] = [];
  for (const m of html.matchAll(/data-automation-id=["']jobTitle["'][^>]*>([^<]{3,100})</gi)) {
    const t = cleanTitle(m[1] ?? "");
    if (t) titles.push(t);
  }
  if (titles.length === 0) return null;
  const roles = dedupe(titles).slice(0, 12);
  return { count: roles.length, roles, pattern: "workday" };
}

/** Ashby: <a href="/jobs/…"><h3>Title</h3></a> on jobs.ashbyhq.com. */
function parseAshby(html: string): ParsedJobs | null {
  if (!/ashby|ashbyhq/i.test(html)) return null;
  const titles: string[] = [];
  for (const m of html.matchAll(/<h3[^>]*>([^<]{3,100})<\/h3>/gi)) {
    const t = cleanTitle(m[1] ?? "");
    if (t && looksLikeRoleTitle(t)) titles.push(t);
  }
  if (titles.length === 0) return null;
  const roles = dedupe(titles).slice(0, 12);
  return { count: roles.length, roles, pattern: "ashby" };
}

/** Workable / Recruitee / JazzHR: posting-anchor structures. */
function parseWorkable(html: string): ParsedJobs | null {
  if (!/workable|recruitee|jazzhr/i.test(html)) return null;
  const titles: string[] = [];
  for (const m of html.matchAll(/<a[^>]+(?:posting|job-title|jobOpenItem)[^>]*>([^<]{3,100})<\/a>/gi)) {
    const t = cleanTitle(m[1] ?? "");
    if (t) titles.push(t);
  }
  if (titles.length === 0) return null;
  const roles = dedupe(titles).slice(0, 12);
  return { count: roles.length, roles, pattern: "workable" };
}

/**
 * Generic fallback: only fires when the page actually looks like a careers/jobs page (page-level
 * hiring signal present). This guards against contact pages being mistaken for job listings —
 * the homepage→careers-link heuristic upstream sometimes follows a /contact link, and contact
 * pages have phone-country dropdowns that the prior parser happily mistook for "roles" like
 * "Cook Islands +682".
 */
function parseGeneric(html: string): ParsedJobs | null {
  // Require the page itself to look hiring-shaped before we go scraping list items.
  const text = html.toLowerCase();
  const pageLooksHiring = /\b(?:open positions?|job openings?|we['']re hiring|now hiring|apply now|join our team|current openings|career opportunities)\b/.test(text);
  if (!pageLooksHiring) return null;

  const titles: string[] = [];
  // (1) Anchors whose href clearly points at a specific job page
  for (const m of html.matchAll(/<a[^>]+href=["'][^"']*(?:\/jobs?\/|\/careers\/|\/apply|\/positions?\/|\/openings?\/|\/job_listings?\/)[^"']*["'][^>]*>([\s\S]{3,120}?)<\/a>/gi)) {
    const t = cleanTitle(m[1] ?? "");
    if (looksLikeRoleTitle(t)) titles.push(t);
  }
  // (2) Article-level titles
  if (titles.length < 3) {
    for (const m of html.matchAll(/<(?:h2|h3|h4)[^>]*>([^<]{3,100})<\/(?:h2|h3|h4)>/gi)) {
      const t = cleanTitle(m[1] ?? "");
      if (looksLikeRoleTitle(t)) titles.push(t);
    }
  }
  // (3) List items — but only short ones that are plausibly a single title, not a paragraph
  if (titles.length < 3) {
    for (const m of html.matchAll(/<li[^>]*>([\s\S]{3,80}?)<\/li>/gi)) {
      const t = cleanTitle(m[1] ?? "");
      if (looksLikeRoleTitle(t)) titles.push(t);
    }
  }
  const roles = dedupe(titles).slice(0, 12);
  if (roles.length === 0) return null;
  return { count: roles.length, roles, pattern: "generic" };
}

export function parseCareersPage(html: string): ParsedJobs {
  return (
    parseGreenhouse(html) ??
    parseLever(html) ??
    parseWorkday(html) ??
    parseAshby(html) ??
    parseWorkable(html) ??
    parseGeneric(html) ?? {
      count: 0,
      roles: [],
      pattern: "no_postings_detected"
    }
  );
}
