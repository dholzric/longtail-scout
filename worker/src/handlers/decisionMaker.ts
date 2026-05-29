/**
 * /api/decision-maker?name=<biz>&city=<city>&contact=<knownName>  (v1.7.0)
 *
 * Finds the operator's decision-maker. Runs a `"<company>" (owner OR founder …) site:linkedin.com/in`
 * search THROUGH the Bright Data bridge and returns named people with their LinkedIn profile +
 * title, owner/founder roles ranked first. Pairs with contact-discovery (the inbox) to answer
 * "who, specifically, do I email?" KV-cached 30 days.
 */
import type { Env } from "../index";
import { bridgeSerp } from "../bridge/client";
import { classifyPeopleResults, type Person } from "../agent/decisionMaker";
import { normalizeBizName } from "../agent/linkedinPresence";

interface DecisionMakerResponse {
  people: Person[];
  serp_query: string;
  via: "bright_data_serp";
  cached?: boolean;
  error?: string;
}

function authorized(req: Request, env: Env): boolean {
  if (!env.DEMO_PASSWORD) return true;
  const h = req.headers.get("authorization") ?? "";
  if (h === `Bearer ${env.DEMO_PASSWORD}`) return true;
  return new URL(req.url).searchParams.get("key") === env.DEMO_PASSWORD;
}

export async function decisionMakerHandler(req: Request, env: Env): Promise<Response> {
  if (!authorized(req, env)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const name = (url.searchParams.get("name") ?? "").trim().slice(0, 160);
  const city = (url.searchParams.get("city") ?? "").trim().slice(0, 80);
  const knownContact = (url.searchParams.get("contact") ?? "").trim().slice(0, 120);
  if (!name || normalizeBizName(name).length < 2) {
    return Response.json({ error: "missing or too-short name" }, { status: 400 });
  }

  const cacheKey = `dm:v1:${normalizeBizName(name)}:${city.toLowerCase()}:${normalizeBizName(knownContact)}`;
  const cached = await env.CACHE.get(cacheKey, "json") as DecisionMakerResponse | null;
  if (cached) return Response.json({ ...cached, cached: true }, { headers: { "cache-control": "public, max-age=3600" } });

  // If we already know a contact name (from contact-discovery), search for THAT person directly;
  // otherwise hunt for the decision-maker by role.
  const serpQuery = knownContact
    ? `"${knownContact}" "${name}" site:linkedin.com/in`
    : `"${name}"${city ? ` ${city}` : ""} (owner OR founder OR president OR CEO OR principal) site:linkedin.com/in`;

  if (!env.BRIDGE_BASE) {
    return Response.json({ people: [], serp_query: serpQuery, via: "bright_data_serp", error: "bridge not configured" } satisfies DecisionMakerResponse, { status: 502 });
  }

  let people: Person[];
  try {
    const serp = await bridgeSerp(serpQuery, { num: 10 }, { base: env.BRIDGE_BASE.replace(/\/$/, ""), token: env.BRIDGE_AUTH_TOKEN });
    people = classifyPeopleResults(name, serp.results, knownContact || undefined);
  } catch (err) {
    return Response.json({ people: [], serp_query: serpQuery, via: "bright_data_serp", error: (err as Error).message.slice(0, 160) } satisfies DecisionMakerResponse, { status: 502 });
  }

  const out: DecisionMakerResponse = { people, serp_query: serpQuery, via: "bright_data_serp" };
  await env.CACHE.put(cacheKey, JSON.stringify(out), { expirationTtl: 30 * 86400 });
  return Response.json(out, { headers: { "cache-control": "public, max-age=3600" } });
}
