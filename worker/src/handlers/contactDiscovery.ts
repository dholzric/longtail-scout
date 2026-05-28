/**
 * /api/contact-discovery?url=<homepage>&name=<biz>  (v1.3.0)
 *
 * Walks an operator's contact/about pages via the Bright Data bridge and extracts a real email,
 * phone, and named contact — the deliverable an SDR needs to actually reach out. Lazy (the
 * drill-down fires it on a button press, never during the scout), cost-capped at MAX_FETCHES
 * Bright Data renders, and KV-cached 7 days. Stops early the moment it has an own-domain inbox.
 */
import type { Env } from "../index";
import { bridgeRender } from "../bridge/client";
import { extractEmails, type DiscoveredEmail } from "../agent/contactDiscovery";
import { extractContactInfo } from "../agent/contact";
import { validateTargetUrl } from "./screenshot";

interface Citation { field: string; tool: string; url: string }

interface ContactDiscoveryResponse {
  emails: DiscoveredEmail[];
  phone: string | null;
  contact: { name: string; role: string } | null;
  /** Which pages we actually fetched, as citations. */
  sources: Citation[];
  pages_fetched: number;
  via: "bright_data_render";
  cached?: boolean;
  error?: string;
}

const MAX_FETCHES = 3;
/** Paths tried after the homepage, in priority order. */
const CONTACT_PATHS = ["/contact", "/contact-us", "/about", "/about-us", "/team"];

function authorized(req: Request, env: Env): boolean {
  if (!env.DEMO_PASSWORD) return true;
  const h = req.headers.get("authorization") ?? "";
  if (h === `Bearer ${env.DEMO_PASSWORD}`) return true;
  return new URL(req.url).searchParams.get("key") === env.DEMO_PASSWORD;
}

/** Homepage first, then a few likely contact paths — deduped, capped at MAX_FETCHES. */
export function contactPageCandidates(homepageUrl: string): string[] {
  let base: URL;
  try { base = new URL(homepageUrl); } catch { return []; }
  const origin = base.origin;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of [base.toString(), ...CONTACT_PATHS.map(p => origin + p)]) {
    const norm = u.replace(/\/$/, "");
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(u);
    if (out.length >= MAX_FETCHES) break;
  }
  return out;
}

export async function contactDiscoveryHandler(req: Request, env: Env): Promise<Response> {
  if (!authorized(req, env)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const target = (url.searchParams.get("url") ?? "").trim();
  if (!validateTargetUrl(target)) return Response.json({ error: "invalid url" }, { status: 400 });

  let hostname = "";
  try { hostname = new URL(target).hostname; } catch { /* validated above */ }

  const cacheKey = `contacts:v1:${target.replace(/\/$/, "")}`;
  const cached = await env.CACHE.get(cacheKey, "json") as ContactDiscoveryResponse | null;
  if (cached) return Response.json({ ...cached, cached: true }, { headers: { "cache-control": "public, max-age=3600" } });

  if (!env.BRIDGE_BASE) {
    return Response.json({ emails: [], phone: null, contact: null, sources: [], pages_fetched: 0, via: "bright_data_render", error: "bridge not configured" } satisfies ContactDiscoveryResponse, { status: 502 });
  }
  const auth = { base: env.BRIDGE_BASE.replace(/\/$/, ""), token: env.BRIDGE_AUTH_TOKEN };

  const emails = new Map<string, DiscoveredEmail>();
  let phone: string | null = null;
  let contact: { name: string; role: string } | null = null;
  const sources: Citation[] = [];
  let pages_fetched = 0;
  let lastError: string | undefined;

  for (const pageUrl of contactPageCandidates(target)) {
    if (!validateTargetUrl(pageUrl)) continue;
    try {
      const r = await bridgeRender(pageUrl, { waitMs: 1500 }, auth);
      pages_fetched++;
      sources.push({ field: "contact", tool: "bright_data_render", url: r.final_url || pageUrl });
      for (const e of extractEmails(r.html, hostname)) {
        if (!emails.has(e.email)) emails.set(e.email, e);
      }
      const info = extractContactInfo(r.html);
      if (!phone && info.phone) phone = info.phone;
      if (!contact && info.contact) contact = info.contact;
      // Early exit: we already have the high-value combo (own-domain inbox + phone).
      const haveOwnInbox = Array.from(emails.values()).some(e => e.same_domain);
      if (haveOwnInbox && phone) break;
    } catch (err) {
      lastError = (err as Error).message.slice(0, 160);
      // keep trying the remaining candidate pages
    }
  }

  const ranked = Array.from(emails.values()).sort((a, b) => Number(b.same_domain) - Number(a.same_domain)).slice(0, 10);
  const out: ContactDiscoveryResponse = {
    emails: ranked,
    phone,
    contact,
    sources,
    pages_fetched,
    via: "bright_data_render",
    ...(pages_fetched === 0 && lastError ? { error: lastError } : {})
  };
  // Only cache a result that actually fetched something — don't poison the cache with a transient
  // all-pages-failed run.
  if (pages_fetched > 0) {
    await env.CACHE.put(cacheKey, JSON.stringify(out), { expirationTtl: 7 * 86400 });
  }
  return Response.json(out, { status: pages_fetched === 0 ? 502 : 200, headers: { "cache-control": "public, max-age=3600" } });
}
