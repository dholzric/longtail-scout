/**
 * /api/mcp — Model Context Protocol server (Streamable HTTP transport).
 *
 * Exposes LongTail Scout's core API as MCP tools so any MCP-aware client
 * (Claude Desktop, ChatGPT MCP, Cursor, etc.) can drive scouts directly.
 *
 * Twelve tools:
 *   - scout                 → run a full scout (sample by default to avoid burning credits)
 *   - find_businesses       → demand-API geotagged businesses for a niche+city
 *   - demand_count          → integer count of businesses matching a niche
 *   - operator_screenshot   → base64 PNG of an operator's homepage
 *   - draft_email           → AI-personalized cold email for one operator
 *   - niche_recon           → reverse the funnel: product description → top long-tail verticals
 *   - linkedin_check        → Apollo-blind verification: is the operator on LinkedIn? (via BD)
 *   - find_contacts         → email/phone/contact harvested from contact+about pages (via BD)
 *   - account_brief         → one-page Markdown dossier for an operator
 *   - rank_triggers         → re-rank operators by buying-signal strength ("act first")
 *   - signal_radar          → live third-party news/funding/expansion triggers (via BD)
 *   - decision_maker        → find the operator's owner/founder + LinkedIn profile (via BD)
 *
 * Authentication: Bearer <DEMO_PASSWORD> in the Authorization header (same as
 * the rest of /api/*). The MCP client passes the demo password as the
 * bearer token in its server config.
 *
 * Protocol: JSON-RPC 2.0 over HTTP. POST one request, get one response.
 * SSE for the full server lifecycle is intentionally NOT implemented —
 * single-request mode is enough for the hackathon demo and keeps Workers
 * stateless. Compliant clients (Claude Desktop, etc.) handle it fine.
 */
import type { Env } from "../index";
import { findSample } from "../samples";
import type { Operator } from "../types";
import { VERSION } from "../version";

const PROTOCOL_VERSION = "2025-03-26";
const SERVER_NAME = "longtailscout";
const SERVER_VERSION = VERSION;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

const TOOLS: ToolDefinition[] = [
  {
    name: "scout",
    description: "Run a long-tail prospect scout for a niche × city. Returns a ranked, citation-linked list of small operators whose primary signal is their own website (not LinkedIn). 'sample' mode returns cached results in ~140ms with zero BD/LLM cost; 'live' mode burns real credits (~$0.20) and takes 2-4 min.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Niche × city query, e.g. 'roofing contractors in Houston'" },
        mode: { type: "string", enum: ["sample", "live"], description: "Sample (free, cached) or live (real BD+LLM cost). Default sample.", default: "sample" }
      },
      required: ["query"]
    }
  },
  {
    name: "find_businesses",
    description: "Look up geotagged businesses in the 7M-record demand index for a niche + city. Returns lat/lng + rating + review_count + address per match. Use this to find candidates outside of an operator scout — e.g. 'how many roofing businesses are in Dallas?'",
    inputSchema: {
      type: "object",
      properties: {
        niche: { type: "string", description: "Niche keyword like 'roofing', 'dental', 'hvac'." },
        city: { type: "string", description: "City name, optional." },
        limit: { type: "number", description: "Max records to return (1-200). Default 50.", default: 50 }
      },
      required: ["niche"]
    }
  },
  {
    name: "demand_count",
    description: "Single-integer demand count for a niche — how many businesses match this keyword in the 7M-record demand index, nationally. Faster than find_businesses when you only need the size.",
    inputSchema: {
      type: "object",
      properties: {
        niche: { type: "string", description: "Niche keyword." }
      },
      required: ["niche"]
    }
  },
  {
    name: "operator_screenshot",
    description: "Capture a live homepage screenshot of an operator URL via Bright Data Browser API. Returns the image as a base64 PNG. Cached in KV for 30 days.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Operator homepage URL (must be http/https, public hostname)." },
        width: { type: "number", description: "Viewport width 320-1920. Default 1024.", default: 1024 },
        height: { type: "number", description: "Viewport height 240-1080. Default 640.", default: 640 }
      },
      required: ["url"]
    }
  },
  {
    name: "draft_email",
    description: "Generate a personalized cold email for one operator. References their about + hiring + recent activity. Returns subject + body + provider + estimated cost. ~$0.0002 per call.",
    inputSchema: {
      type: "object",
      properties: {
        operator: { type: "object", description: "Operator object (from scout) — must include name, url, and ideally about, hiring, recent_activity, icp_fit_reason, sales_angle." },
        buyer: {
          type: "object",
          description: "Optional buyer context for the cold email's framing.",
          properties: {
            product: { type: "string", description: "What you're selling, e.g. 'AccuLynx field-service SaaS'." },
            vertical: { type: "string", description: "Vertical you target, e.g. 'roofing contractors'." }
          }
        }
      },
      required: ["operator"]
    }
  },
  {
    name: "decision_maker",
    description: "Find the operator's decision-maker. Runs a `\"<company>\" (owner OR founder ...) site:linkedin.com/in` search through Bright Data and returns named people with their LinkedIn profile + title, owner/founder/CEO roles first. Pass a known contact name to look that specific person up. Cached 30d.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Operator business name." },
        city: { type: "string", description: "City, optional." },
        contact: { type: "string", description: "A known contact name to look up directly, optional (e.g. from find_contacts)." }
      },
      required: ["name"]
    }
  },
  {
    name: "signal_radar",
    description: "Live buying-trigger radar. Runs a news search through Bright Data and returns fresh THIRD-PARTY headlines about an operator, categorized as funding / expansion / leadership / award / launch / hiring — each with a citation. The timeliest 'why now' for outreach. Cached 24h.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Operator business name." },
        city: { type: "string", description: "City, optional — biases the search." },
        url: { type: "string", description: "Operator homepage URL, optional — excludes their own domain from results." }
      },
      required: ["name"]
    }
  },
  {
    name: "rank_triggers",
    description: "Re-rank a set of operators (from a scout result) by buying-signal strength — who to contact FIRST. Scores open roles (premium for growth/ops hires), recent expansion/funding/award headlines weighted by recency, and multi-vertical presence. Returns each operator with a 0-100 trigger_score and the reasons.",
    inputSchema: {
      type: "object",
      properties: {
        operators: { type: "array", description: "Array of operator objects from the scout tool.", items: { type: "object" } }
      },
      required: ["operators"]
    }
  },
  {
    name: "account_brief",
    description: "Render a one-page Markdown account brief for an operator (from a scout result) — who they are, why they fit, signals, contacts, draft email, and the numbered Bright Data sources behind every claim. Paste-ready for a CRM note or email.",
    inputSchema: {
      type: "object",
      properties: {
        operator: { type: "object", description: "Operator object from the scout tool (name + url required)." },
        linkedin: { type: "object", description: "Optional linkedin_check result to embed.", properties: { on_linkedin: { type: "boolean" }, evidence_url: { type: "string" } } },
        contacts: { type: "object", description: "Optional find_contacts result to embed." },
        email: { type: "object", description: "Optional draft_email result to embed.", properties: { subject: { type: "string" }, body: { type: "string" } } }
      },
      required: ["operator"]
    }
  },
  {
    name: "find_contacts",
    description: "Discover a reachable email, phone, and named contact for an operator by walking its contact/about pages via Bright Data. Returns the operator's own-domain inbox first (the highest-value address), with the pages fetched as citations. Cost-capped and cached 7 days.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Operator homepage URL." },
        name: { type: "string", description: "Operator business name, optional." }
      },
      required: ["url"]
    }
  },
  {
    name: "linkedin_check",
    description: "Apollo-blind verification: run a `site:linkedin.com/company` search through Bright Data and report whether an operator has a LinkedIn company page. A confirmed absence is hard proof the operator is invisible to LinkedIn-graph tools (Apollo/ZoomInfo/Clay) — the core LongTail Scout thesis. Cached 30 days.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Operator business name, e.g. 'Acme Roofing'." },
        city: { type: "string", description: "City, optional — biases the match." },
        url: { type: "string", description: "Operator homepage URL, optional — used for context." }
      },
      required: ["name"]
    }
  },
  {
    name: "niche_recon",
    description: "Reverse the GTM funnel: given a product description, suggest the top long-tail verticals to hunt in. An LLM expands the description into ~6 candidate verticals, then we cross-reference each against the 7M-business demand index. Ranks by demand density × Apollo-thinness (share of businesses whose only URL is a booking-platform / Google profile / Facebook page — i.e. they don't have their own domain for Apollo to enrich from). Returns top 5 niches with demand counts, thinness %, sample cities, and a one-click `suggested_query` you can pipe into the scout tool. Use this when a GTM team isn't sure which verticals their product fits. Takes 30-60s (LLM + demand index calls).",
    inputSchema: {
      type: "object",
      properties: {
        product_description: { type: "string", description: "1-3 sentences about your product — what it does, who it's for. 10-800 chars." }
      },
      required: ["product_description"]
    }
  }
];

function makeResponse(id: number | string | null, result: any): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function makeError(id: number | string | null, code: number, message: string, data?: any): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message, ...(data !== undefined ? { data } : {}) } };
}

/** Format an MCP tool result as a content block. */
function textContent(s: string) {
  return { content: [{ type: "text", text: s }] };
}

function jsonContent(o: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(o, null, 2) }] };
}

function imageContent(base64: string, mimeType = "image/png") {
  return { content: [{ type: "image", data: base64, mimeType }] };
}

/** Auth gate — same Bearer token as the rest of /api/*. */
function authorized(req: Request, env: Env): boolean {
  if (!env.DEMO_PASSWORD) return true;
  const h = req.headers.get("authorization") ?? "";
  return h === `Bearer ${env.DEMO_PASSWORD}`;
}

export async function mcpHandler(req: Request, env: Env): Promise<Response> {
  if (req.method === "GET") {
    // Public discovery — what is this endpoint, what tools does it expose.
    return Response.json({
      protocol: "Model Context Protocol",
      protocolVersion: PROTOCOL_VERSION,
      server: { name: SERVER_NAME, version: SERVER_VERSION },
      transport: "streamable-http (single-request mode)",
      auth: "Bearer <DEMO_PASSWORD>",
      tools: TOOLS.map(t => ({ name: t.name, description: t.description })),
      docs: "https://longtailscout.com/mcp"
    });
  }
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  if (!authorized(req, env)) {
    return Response.json(
      makeError(null, -32001, "unauthorized — set Authorization: Bearer <DEMO_PASSWORD>"),
      { status: 401 }
    );
  }

  let body: JsonRpcRequest | JsonRpcRequest[];
  try { body = await req.json(); } catch {
    return Response.json(makeError(null, -32700, "parse error"), { status: 400 });
  }
  const isBatch = Array.isArray(body);
  const requests: JsonRpcRequest[] = isBatch ? body as JsonRpcRequest[] : [body as JsonRpcRequest];

  const responses: JsonRpcResponse[] = [];
  for (const r of requests) {
    if (r.jsonrpc !== "2.0" || typeof r.method !== "string") {
      responses.push(makeError(r.id ?? null, -32600, "invalid request"));
      continue;
    }
    responses.push(await handleMethod(r, env, req));
  }

  return Response.json(isBatch ? responses : responses[0]);
}

async function handleMethod(r: JsonRpcRequest, env: Env, req: Request): Promise<JsonRpcResponse> {
  const id = r.id ?? null;
  // Derive origin from the inbound request rather than hard-coding the production hostname.
  // Lets the MCP server run correctly on preview/staging deployments AND on the production
  // Worker — same code, no env var, no drift. Falls back to the prod host if the request URL
  // is unparseable (shouldn't happen on Workers but keeps us safe).
  let origin: string;
  try { origin = new URL(req.url).origin; }
  catch { origin = "https://longtailscout.com"; }
  try {
    switch (r.method) {
      case "initialize":
        return makeResponse(id, {
          protocolVersion: PROTOCOL_VERSION,
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
          capabilities: { tools: {} }
        });
      case "tools/list":
        return makeResponse(id, { tools: TOOLS });
      case "tools/call":
        return await callTool(id, r.params, env, origin);
      case "notifications/initialized":
      case "notifications/cancelled":
        // No-op; per spec these don't expect a response.
        return makeResponse(id, {});
      case "ping":
        return makeResponse(id, {});
      default:
        return makeError(id, -32601, `method not found: ${r.method}`);
    }
  } catch (err) {
    return makeError(id, -32603, "internal error", (err as Error).message?.slice(0, 200));
  }
}

async function callTool(id: number | string | null, params: any, env: Env, origin: string): Promise<JsonRpcResponse> {
  const name = params?.name;
  const args = params?.arguments ?? {};
  if (!name) return makeError(id, -32602, "missing tool name");

  switch (name) {
    case "scout":              return makeResponse(id, await toolScout(args, env, origin));
    case "find_businesses":    return makeResponse(id, await toolFindBusinesses(args, env));
    case "demand_count":       return makeResponse(id, await toolDemandCount(args, env));
    case "operator_screenshot":return makeResponse(id, await toolScreenshot(args, env, origin));
    case "draft_email":        return makeResponse(id, await toolDraftEmail(args, env, origin));
    case "niche_recon":        return makeResponse(id, await toolNicheRecon(args, env, origin));
    case "linkedin_check":     return makeResponse(id, await toolLinkedInCheck(args, env, origin));
    case "find_contacts":      return makeResponse(id, await toolFindContacts(args, env, origin));
    case "account_brief":      return makeResponse(id, await toolAccountBrief(args, env, origin));
    case "rank_triggers":      return makeResponse(id, await toolRankTriggers(args, env, origin));
    case "signal_radar":       return makeResponse(id, await toolSignalRadar(args, env, origin));
    case "decision_maker":     return makeResponse(id, await toolDecisionMaker(args, env, origin));
    default:                   return makeError(id, -32602, `unknown tool: ${name}`);
  }
}

// ─── Tool implementations ────────────────────────────────────────────────────

async function toolScout(args: any, env: Env, origin: string) {
  const query = String(args?.query ?? "").trim();
  if (!query) return textContent("ERROR: missing query");
  const mode = args?.mode === "live" ? "live" : "sample";

  // Sample path — quick, deterministic, free.
  if (mode === "sample") {
    const sample = findSample(query);
    if (!sample) {
      return textContent(`No cached sample for "${query}". Use mode: "live" to run a real scout (costs real BD+LLM credits).`);
    }
    return jsonContent({
      query,
      mode: "sample",
      sample_label: sample.label,
      operators: sample.operators.map(simplifyOperator),
      note: "Sample data — replayed from cache. For a live scout, set mode: 'live'."
    });
  }

  // Live mode — burn credits. We call our own /api/scout SSE endpoint server-side and
  // collect the final operators. This routes through every part of the agent pipeline.
  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (env.DEMO_PASSWORD) headers.authorization = `Bearer ${env.DEMO_PASSWORD}`;
    const resp = await fetch(`${origin}/api/scout`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query })
    });
    if (!resp.ok || !resp.body) {
      return textContent(`live scout failed: HTTP ${resp.status}`);
    }
    const operators: Operator[] = await collectFinalOperators(resp.body);
    return jsonContent({
      query,
      mode: "live",
      operators: operators.map(simplifyOperator),
      operator_count: operators.length
    });
  } catch (err) {
    return textContent(`live scout error: ${(err as Error).message}`);
  }
}

/** Strip down an Operator to what an MCP client probably wants. */
function simplifyOperator(o: Operator) {
  return {
    rank: o.rank,
    confidence: o.confidence,
    name: o.name,
    url: o.url,
    about: o.about,
    size_estimate: o.size_estimate,
    icp_fit_reason: o.icp_fit_reason,
    sales_angle: o.sales_angle,
    hiring: o.hiring,
    geo: o.geo,
    recent_activity: o.recent_activity,
    memory_state: o.memory?.memory_state,
    cross_niche: o.memory?.cross_niche,
    sources: o.sources,
    city: o.city
  };
}

/** Read the SSE stream from /api/scout, return the final operators array. */
async function collectFinalOperators(body: ReadableStream): Promise<Operator[]> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let lastEvent = "";
  let final: Operator[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nlIdx: number;
    while ((nlIdx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nlIdx);
      buf = buf.slice(nlIdx + 1);
      if (line.startsWith("event: ")) {
        lastEvent = line.slice("event: ".length).trim();
      } else if (line.startsWith("data: ")) {
        const dataStr = line.slice("data: ".length);
        try {
          const data = JSON.parse(dataStr);
          if (lastEvent === "result" && Array.isArray(data.operators)) {
            final = data.operators;
          } else if (lastEvent === "operator" && final.length === 0) {
            // Accumulate incrementally so we still have something if `result` never arrives.
            final.push(data);
          }
        } catch { /* ignore non-JSON data lines */ }
      }
    }
  }
  return final;
}

async function toolFindBusinesses(args: any, env: Env) {
  const niche = String(args?.niche ?? "").trim();
  if (!niche) return textContent("ERROR: missing niche");
  const limit = Math.min(Math.max(Number(args?.limit ?? 50), 1), 200);
  const city = args?.city ? String(args.city).trim() : null;
  const upstream = new URL("/api/businesses", env.DEMAND_API_BASE);
  upstream.searchParams.set("q", niche.toLowerCase());
  if (city) upstream.searchParams.set("city", city);
  upstream.searchParams.set("limit", String(limit));
  try {
    const r = await fetch(upstream.toString(), { headers: { "user-agent": "longtailscout-mcp/1.0" } });
    if (!r.ok) return textContent(`demand API error: HTTP ${r.status}`);
    const j = await r.json();
    return jsonContent(j);
  } catch (err) {
    return textContent(`demand API unreachable: ${(err as Error).message}`);
  }
}

async function toolDemandCount(args: any, env: Env) {
  const niche = String(args?.niche ?? "").trim();
  if (!niche) return textContent("ERROR: missing niche");
  const upstream = new URL("/api/research", env.DEMAND_API_BASE);
  upstream.searchParams.set("q", niche.toLowerCase());
  upstream.searchParams.set("tlds", "com");
  upstream.searchParams.set("limit", "1");
  try {
    const r = await fetch(upstream.toString(), { headers: { "user-agent": "longtailscout-mcp/1.0" } });
    if (!r.ok) return textContent(`demand API error: HTTP ${r.status}`);
    const j = await r.json() as { demand?: number };
    return jsonContent({ niche, demand: j.demand ?? 0 });
  } catch (err) {
    return textContent(`demand API unreachable: ${(err as Error).message}`);
  }
}

async function toolScreenshot(args: any, env: Env, origin: string) {
  const url = String(args?.url ?? "").trim();
  if (!url) return textContent("ERROR: missing url");
  const width = Math.min(Math.max(Number(args?.width ?? 1024), 320), 1920);
  const height = Math.min(Math.max(Number(args?.height ?? 640), 240), 1080);
  try {
    const headers: Record<string, string> = {};
    if (env.DEMO_PASSWORD) headers.authorization = `Bearer ${env.DEMO_PASSWORD}`;
    const r = await fetch(`${origin}/api/screenshot?url=${encodeURIComponent(url)}&w=${width}&h=${height}`, { headers });
    if (!r.ok) return textContent(`screenshot failed: HTTP ${r.status}`);
    const ab = await r.arrayBuffer();
    const bytes = new Uint8Array(ab);
    // Base64-encode the PNG. Use btoa via chunked binary string to stay Worker-safe.
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return imageContent(btoa(binary), "image/png");
  } catch (err) {
    return textContent(`screenshot error: ${(err as Error).message}`);
  }
}

async function toolNicheRecon(args: any, env: Env, origin: string) {
  const desc = String(args?.product_description ?? "").trim();
  if (!desc || desc.length < 10) return textContent("ERROR: product_description required (10-800 chars)");
  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (env.DEMO_PASSWORD) headers.authorization = `Bearer ${env.DEMO_PASSWORD}`;
    const r = await fetch(`${origin}/api/niche-recon`, {
      method: "POST",
      headers,
      body: JSON.stringify({ product_description: desc })
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      return textContent(`niche-recon failed: HTTP ${r.status} ${errText.slice(0, 200)}`);
    }
    const j = await r.json();
    return jsonContent(j);
  } catch (err) {
    return textContent(`niche-recon error: ${(err as Error).message}`);
  }
}

async function toolDecisionMaker(args: any, env: Env, origin: string) {
  const name = String(args?.name ?? "").trim();
  if (!name) return textContent("ERROR: missing name");
  const params = new URLSearchParams({ name });
  if (args?.city) params.set("city", String(args.city).trim());
  if (args?.contact) params.set("contact", String(args.contact).trim());
  try {
    const headers: Record<string, string> = {};
    if (env.DEMO_PASSWORD) headers.authorization = `Bearer ${env.DEMO_PASSWORD}`;
    const r = await fetch(`${origin}/api/decision-maker?${params.toString()}`, { headers });
    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      return textContent(`decision-maker failed: HTTP ${r.status} ${errText.slice(0, 200)}`);
    }
    return jsonContent(await r.json());
  } catch (err) {
    return textContent(`decision-maker error: ${(err as Error).message}`);
  }
}

async function toolSignalRadar(args: any, env: Env, origin: string) {
  const name = String(args?.name ?? "").trim();
  if (!name) return textContent("ERROR: missing name");
  const params = new URLSearchParams({ name });
  if (args?.city) params.set("city", String(args.city).trim());
  if (args?.url) params.set("url", String(args.url).trim());
  try {
    const headers: Record<string, string> = {};
    if (env.DEMO_PASSWORD) headers.authorization = `Bearer ${env.DEMO_PASSWORD}`;
    const r = await fetch(`${origin}/api/signal-radar?${params.toString()}`, { headers });
    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      return textContent(`signal-radar failed: HTTP ${r.status} ${errText.slice(0, 200)}`);
    }
    return jsonContent(await r.json());
  } catch (err) {
    return textContent(`signal-radar error: ${(err as Error).message}`);
  }
}

async function toolRankTriggers(args: any, env: Env, origin: string) {
  const operators = Array.isArray(args?.operators) ? args.operators : null;
  if (!operators) return textContent("ERROR: operators array required");
  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (env.DEMO_PASSWORD) headers.authorization = `Bearer ${env.DEMO_PASSWORD}`;
    const r = await fetch(`${origin}/api/triggers`, { method: "POST", headers, body: JSON.stringify({ operators }) });
    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      return textContent(`rank-triggers failed: HTTP ${r.status} ${errText.slice(0, 200)}`);
    }
    return jsonContent(await r.json());
  } catch (err) {
    return textContent(`rank-triggers error: ${(err as Error).message}`);
  }
}

async function toolAccountBrief(args: any, env: Env, origin: string) {
  if (!args?.operator?.name || !args?.operator?.url) return textContent("ERROR: operator.name and operator.url required");
  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (env.DEMO_PASSWORD) headers.authorization = `Bearer ${env.DEMO_PASSWORD}`;
    const r = await fetch(`${origin}/api/brief`, {
      method: "POST",
      headers,
      body: JSON.stringify({ operator: args.operator, linkedin: args.linkedin, contacts: args.contacts, email: args.email })
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      return textContent(`account-brief failed: HTTP ${r.status} ${errText.slice(0, 200)}`);
    }
    const j = await r.json() as { markdown?: string };
    // The brief itself is the useful payload — return it as text so MCP clients render the Markdown.
    return textContent(j.markdown ?? "(empty brief)");
  } catch (err) {
    return textContent(`account-brief error: ${(err as Error).message}`);
  }
}

async function toolFindContacts(args: any, env: Env, origin: string) {
  const url = String(args?.url ?? "").trim();
  if (!url) return textContent("ERROR: missing url");
  const params = new URLSearchParams({ url });
  if (args?.name) params.set("name", String(args.name).trim());
  try {
    const headers: Record<string, string> = {};
    if (env.DEMO_PASSWORD) headers.authorization = `Bearer ${env.DEMO_PASSWORD}`;
    const r = await fetch(`${origin}/api/contact-discovery?${params.toString()}`, { headers });
    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      return textContent(`find-contacts failed: HTTP ${r.status} ${errText.slice(0, 200)}`);
    }
    return jsonContent(await r.json());
  } catch (err) {
    return textContent(`find-contacts error: ${(err as Error).message}`);
  }
}

async function toolLinkedInCheck(args: any, env: Env, origin: string) {
  const name = String(args?.name ?? "").trim();
  if (!name) return textContent("ERROR: missing name");
  const params = new URLSearchParams({ name });
  if (args?.city) params.set("city", String(args.city).trim());
  if (args?.url) params.set("url", String(args.url).trim());
  try {
    const headers: Record<string, string> = {};
    if (env.DEMO_PASSWORD) headers.authorization = `Bearer ${env.DEMO_PASSWORD}`;
    const r = await fetch(`${origin}/api/linkedin-check?${params.toString()}`, { headers });
    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      return textContent(`linkedin-check failed: HTTP ${r.status} ${errText.slice(0, 200)}`);
    }
    return jsonContent(await r.json());
  } catch (err) {
    return textContent(`linkedin-check error: ${(err as Error).message}`);
  }
}

async function toolDraftEmail(args: any, env: Env, origin: string) {
  const operator = args?.operator;
  if (!operator?.name || !operator?.url) return textContent("ERROR: operator.name and operator.url required");
  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (env.DEMO_PASSWORD) headers.authorization = `Bearer ${env.DEMO_PASSWORD}`;
    const r = await fetch(`${origin}/api/draft-email`, {
      method: "POST",
      headers,
      body: JSON.stringify({ operator, buyer: args?.buyer })
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      return textContent(`draft-email failed: HTTP ${r.status} ${errText.slice(0, 200)}`);
    }
    const j = await r.json();
    return jsonContent(j);
  } catch (err) {
    return textContent(`draft-email error: ${(err as Error).message}`);
  }
}
