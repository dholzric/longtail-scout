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

function looksLikeRoleTitle(s: string): boolean {
  if (!s || s.length < 3 || s.length > 100) return false;
  if (COMMON_TITLE_NOISE.test(s.trim())) return false;
  return ROLE_HINTS.test(s);
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

/** Generic fallback: any anchor inside a list whose text looks like a job title. */
function parseGeneric(html: string): ParsedJobs | null {
  const titles: string[] = [];
  // (1) Anchors with /jobs/, /job/, /careers/, /apply, /positions/
  for (const m of html.matchAll(/<a[^>]+href=["'][^"']*(?:\/jobs?\/|\/careers\/|\/apply|\/positions?\/|\/openings?\/|\/job_listings?\/)[^"']*["'][^>]*>([\s\S]{3,120}?)<\/a>/gi)) {
    const t = cleanTitle(m[1] ?? "");
    if (looksLikeRoleTitle(t)) titles.push(t);
  }
  // (2) Article-level titles on careers landing pages
  if (titles.length < 3) {
    for (const m of html.matchAll(/<(?:h2|h3|h4)[^>]*>([^<]{3,100})<\/(?:h2|h3|h4)>/gi)) {
      const t = cleanTitle(m[1] ?? "");
      if (looksLikeRoleTitle(t)) titles.push(t);
    }
  }
  // (3) List items
  if (titles.length < 3) {
    for (const m of html.matchAll(/<li[^>]*>([\s\S]{3,140}?)<\/li>/gi)) {
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
