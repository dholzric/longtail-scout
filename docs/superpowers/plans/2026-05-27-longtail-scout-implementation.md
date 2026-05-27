# LongTail Scout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public Cloudflare-hosted demo of an AI agent that takes a niche × city query and returns a ranked, cited list of long-tail operators — for submission to Bright Data's "Web Data UNLOCKED" hackathon by 2026-05-30.

**Architecture:** Single TypeScript Cloudflare Worker hosts an SSE endpoint that orchestrates a 3-phase hybrid agent pipeline (LLM-driven discovery → deterministic enrichment → LLM synthesis) using Bright Data REST APIs and an OpenAI-compatible LLM client with provider fallback. Frontend is a Preact + Tailwind SPA bundled by Vite and served by the Worker via static asset binding. KV caches tool results. The user's existing demand-signal API at `192.168.1.29:8080` is exposed via a Cloudflare Tunnel hostname (`demand.longtailscout.com`).

**Tech Stack:**
- Runtime: Cloudflare Workers (paid plan), TypeScript, wrangler 3.x
- LLM: OpenAI-compatible client (`openai` npm) with provider fallback chain — **primary: AI/ML API** (`api.aimlapi.com`, hackathon partner promo credits, supports Claude models), **fallback: Z.AI GLM** (`api.z.ai`, user's coding-plan credits, GLM-4.6)
- Bright Data: SERP API + Web Scraper API + Web Unlocker + Scraping Browser (called via fetch); MCP integration pattern via tool-use loop
- Frontend: Preact + Tailwind + Vite
- Storage: Cloudflare KV (cache), Cloudflare Tunnel (demand API)
- Tests: Vitest
- Package manager: pnpm
- Repo hosting: GitHub (public, MIT)
- Domain: `longtailscout.com` + `demand.longtailscout.com`

**Reference:** Design spec at `docs/superpowers/specs/2026-05-27-longtail-scout-design.md`.

---

## File Structure

```
E:\hack2\
├── .gitignore
├── README.md                                  # MCP-pattern integration code snippet up top
├── LICENSE                                    # MIT
├── package.json                               # Root orchestrator scripts
├── docs\superpowers\
│   ├── specs\2026-05-27-longtail-scout-design.md
│   └── plans\2026-05-27-longtail-scout-implementation.md   # this file
├── scripts\
│   └── snapshot-demand.ts                     # Pulls demand-signal data into KV as fallback
├── worker\
│   ├── package.json
│   ├── tsconfig.json
│   ├── wrangler.toml
│   ├── vitest.config.ts
│   ├── .dev.vars.example
│   ├── src\
│   │   ├── index.ts                           # Worker entry: routes
│   │   ├── env.ts                             # Env typing
│   │   ├── stream.ts                          # SSE helpers
│   │   ├── cache.ts                           # KV cache with TTL + key hashing
│   │   ├── types.ts                           # Shared types
│   │   ├── llm\
│   │   │   └── client.ts                      # OpenAI-compatible client with AI/ML API → GLM fallback
│   │   ├── brightdata\
│   │   │   ├── client.ts
│   │   │   ├── serp.ts
│   │   │   ├── webScraper.ts
│   │   │   ├── webUnlocker.ts
│   │   │   └── scrapingBrowser.ts
│   │   ├── demand\
│   │   │   └── client.ts
│   │   ├── agent\
│   │   │   ├── discovery.ts                   # Phase 1: tool-use loop
│   │   │   ├── enrich.ts                      # Phase 2: deterministic fan-out
│   │   │   ├── synthesize.ts                  # Phase 3: structured output
│   │   │   ├── prompts.ts
│   │   │   └── dedupe.ts
│   │   └── handlers\
│   │       ├── scout.ts                       # POST /api/scout SSE handler
│   │       ├── health.ts                      # GET /api/health
│   │       └── smoke.ts                       # GET /api/smoke (Day 1 verification)
│   └── tests\
│       ├── cache.test.ts
│       ├── dedupe.test.ts
│       ├── stream.test.ts
│       └── prompts.test.ts
└── web\
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    ├── src\
    │   ├── main.tsx
    │   ├── App.tsx
    │   ├── sse.ts
    │   ├── styles.css
    │   ├── types.ts
    │   └── components\
    │       ├── QueryForm.tsx
    │       ├── AgentTrace.tsx
    │       ├── ResultTable.tsx
    │       ├── DrillDown.tsx
    │       └── CitationLink.tsx
    └── public\
        └── favicon.svg
```

---

# Phase A — Day 1 (Wed 5/27): scaffolding + external dependencies proven

Goal by end of Phase A: a deployed Worker URL that returns real SERP results from Bright Data and a real demand-signal record.

## Task A1: Initialize repository and scaffolding

**Files:**
- Create: `E:\hack2\.gitignore`
- Create: `E:\hack2\README.md`
- Create: `E:\hack2\LICENSE`

- [ ] **Step 1: Initialize git**

```bash
cd E:/hack2
git init
git branch -M main
```

Expected: `Initialized empty Git repository in E:/hack2/.git/`

- [ ] **Step 2: Write `.gitignore`**

```
node_modules/
.wrangler/
dist/
.dev.vars
.env
.env.local
*.log
.DS_Store
coverage/
demand-snapshot.json
```

- [ ] **Step 3: Write `LICENSE` (MIT)**

```
MIT License

Copyright (c) 2026 Dan Holzrichter

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 4: Write a stub `README.md`**

```markdown
# LongTail Scout

Apollo for the long tail. Built for the Bright Data "Web Data UNLOCKED" hackathon (May 2026).

Demo: https://longtailscout.com

## Stack
- Cloudflare Workers + Pages assets
- AI/ML API (Claude via partner credits) with Z.AI GLM-4.6 fallback
- Bright Data: MCP-pattern + SERP API + Web Scraper API + Web Unlocker + Scraping Browser
- Cloudflare KV cache, Cloudflare Tunnel for the demand-signal source

Full integration snippet added in Phase C.
```

- [ ] **Step 5: Commit**

```bash
git add .gitignore README.md LICENSE
git commit -m "chore: initial scaffolding"
```

## Task A2: Sign up for Bright Data and verify SERP

**Files:** none — account setup.

- [ ] **Step 1:** Sign up at https://brightdata.com using `dholzric@gmail.com`.
- [ ] **Step 2:** Billing → Overview → Apply promo code `unlocked`. Confirm $250 credit.
- [ ] **Step 3:** Enable products in this order — write the resulting zone names + API token to your scratch file:
  - **SERP API** — zone name + API token
  - **Web Scraper API** — zone name + API token
  - **Web Unlocker** — zone name + API token
  - **Scraping Browser** — zone name (Bright Data renders via the same `/request` endpoint with `render: true`)

  Note: the API token already saved in memory is `<BRIGHTDATA_API_KEY>`. Verify it matches the one in the dashboard; if so, reuse it for all zones (Bright Data typically shares the token across products).

- [ ] **Step 4:** Locate the MCP Server endpoint (Bright Data dashboard → AI Agents / MCP). Record whether it is:
  - A public HTTPS endpoint with bearer token (preferred), OR
  - A `npx @brightdata/mcp-server` stdio install (won't work from Workers; we use REST instead).

  In practice the plan uses Bright Data's REST APIs directly and labels the integration as "MCP-pattern" — Bright Data's MCP server is a thin wrapper over the same REST endpoints.

- [ ] **Step 5:** Curl-verify SERP API:

```bash
curl -s "https://api.brightdata.com/serp/req" \
  -H "Authorization: Bearer <BRIGHTDATA_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"zone":"<your-serp-zone>","url":"https://www.google.com/search?q=aerospace+companies+Houston","format":"json"}' | head -c 500
```

Expected: JSON containing `organic` results. If 401/403, double-check the zone name and that the SERP product is activated.

## Task A3: Bind demand-signal API to a public hostname

**Files:** none — Cloudflare dashboard work.

- [ ] **Step 1:** Cloudflare Zero Trust → Tunnels → the existing tunnel exposing `192.168.1.29`.
- [ ] **Step 2:** Add a public hostname:
  - Subdomain: `demand`
  - Domain: `longtailscout.com`
  - Service: HTTP, URL: `192.168.1.29:8080`
- [ ] **Step 3:** Save. CF auto-issues the cert.
- [ ] **Step 4:** Verify:

```bash
curl -s "https://demand.longtailscout.com/api/research?q=test&tlds=com&limit=3" | head -c 500
```

Expected: JSON with `query`, `tlds_selected`, `demand`, `results`.

## Task A4: Create the Cloudflare Worker project

**Files:**
- Create: `E:\hack2\worker\package.json`
- Create: `E:\hack2\worker\tsconfig.json`
- Create: `E:\hack2\worker\wrangler.toml`
- Create: `E:\hack2\worker\src\index.ts`

- [ ] **Step 1: Scaffold**

```bash
cd E:/hack2
mkdir worker
cd worker
pnpm init
pnpm add -D wrangler@^3 typescript@^5 @cloudflare/workers-types vitest@^1 tsx
pnpm add openai@^4
```

Note: we install the `openai` SDK (not Anthropic's) because both AI/ML API and Z.AI GLM expose OpenAI-compatible endpoints. One SDK, two providers, with a fallback wrapper we add in Phase B.

- [ ] **Step 2: Write `worker/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "WebWorker"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

- [ ] **Step 3: Write `worker/wrangler.toml`**

```toml
name = "longtail-scout"
main = "src/index.ts"
compatibility_date = "2026-05-27"
compatibility_flags = ["nodejs_compat"]

[[kv_namespaces]]
binding = "CACHE"
id = "<fill-in-after-task-A5>"
```

- [ ] **Step 4: Write `worker/src/index.ts` (hello world)**

```ts
export interface Env {
  CACHE: KVNamespace;
  ASSETS?: Fetcher;
  AIMLAPI_KEY?: string;
  GLM_API_KEY?: string;
  BRIGHTDATA_API_KEY: string;
  BRIGHTDATA_SERP_ZONE: string;
  BRIGHTDATA_WEB_UNLOCKER_ZONE: string;
  BRIGHTDATA_SCRAPER_ZONE: string;
  DEMAND_API_BASE: string;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/api/health") {
      return Response.json({ ok: true, ts: Date.now() });
    }
    return new Response("LongTail Scout — Worker is up", {
      headers: { "content-type": "text/plain" }
    });
  }
};
```

- [ ] **Step 5: Add scripts to `worker/package.json`**

```json
"scripts": {
  "dev": "wrangler dev --port 8787",
  "deploy": "wrangler deploy",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 6: Smoke test locally**

```bash
pnpm dev
```

In another terminal:
```bash
curl http://127.0.0.1:8787/api/health
```

Expected: `{"ok":true,"ts":<number>}`. Ctrl+C to stop.

- [ ] **Step 7: Commit**

```bash
cd E:/hack2
git add worker/
git commit -m "feat(worker): scaffold cloudflare worker with health endpoint"
```

## Task A5: Create KV namespaces

**Files:**
- Modify: `E:\hack2\worker\wrangler.toml`

- [ ] **Step 1:** From `worker/`:

```bash
pnpm wrangler kv:namespace create CACHE
```

Expected: output containing `id = "<production-id>"`.

- [ ] **Step 2:**

```bash
pnpm wrangler kv:namespace create CACHE --preview
```

- [ ] **Step 3:** Update the `[[kv_namespaces]]` block in `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "CACHE"
id = "<production-id>"
preview_id = "<preview-id>"
```

- [ ] **Step 4: Commit**

```bash
cd E:/hack2
git add worker/wrangler.toml
git commit -m "feat(worker): bind CACHE KV namespace"
```

## Task A6: Configure secrets

**Files:**
- Create: `E:\hack2\worker\.dev.vars`

- [ ] **Step 1: Write `worker/.dev.vars` (gitignored, NEVER committed)**

```
AIMLAPI_KEY=<paste-when-redeemed-from-hackathon-partner>
GLM_API_KEY=<paste-from-z.ai-coding-plan-dashboard>
BRIGHTDATA_API_KEY=<BRIGHTDATA_API_KEY>
BRIGHTDATA_SERP_ZONE=<zone-name>
BRIGHTDATA_WEB_UNLOCKER_ZONE=<zone-name>
BRIGHTDATA_SCRAPER_ZONE=<zone-name>
DEMAND_API_BASE=https://demand.longtailscout.com
```

- [ ] **Step 2: Push to the deployed Worker**

From `worker/`, run for each secret:

```bash
pnpm wrangler secret put AIMLAPI_KEY
pnpm wrangler secret put GLM_API_KEY
pnpm wrangler secret put BRIGHTDATA_API_KEY
pnpm wrangler secret put BRIGHTDATA_SERP_ZONE
pnpm wrangler secret put BRIGHTDATA_WEB_UNLOCKER_ZONE
pnpm wrangler secret put BRIGHTDATA_SCRAPER_ZONE
pnpm wrangler secret put DEMAND_API_BASE
```

Each command prompts for the value. Note: `AIMLAPI_KEY` may be empty until the partner shares the promo code — that's fine; the fallback chain in the LLM client will use GLM if AI/ML API is absent.

Expected for each: `Success!`

## Task A7: Bright Data HTTP client

**Files:**
- Create: `E:\hack2\worker\src\brightdata\client.ts`

- [ ] **Step 1: Write `worker/src/brightdata/client.ts`**

```ts
export interface BrightDataAuth {
  apiKey: string;
}

export class BrightDataError extends Error {
  constructor(public status: number, public bodyExcerpt: string) {
    super(`Bright Data error ${status}: ${bodyExcerpt.slice(0, 200)}`);
  }
}

export async function brightDataFetch(
  endpoint: string,
  body: unknown,
  auth: BrightDataAuth
): Promise<unknown> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${auth.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new BrightDataError(res.status, text);
  }
  return await res.json();
}
```

- [ ] **Step 2: Commit**

```bash
cd E:/hack2
git add worker/src/brightdata/client.ts
git commit -m "feat(brightdata): http client"
```

## Task A8: SERP API wrapper

**Files:**
- Create: `E:\hack2\worker\src\brightdata\serp.ts`

- [ ] **Step 1: Write the wrapper**

```ts
import { brightDataFetch, BrightDataAuth } from "./client";

export interface SerpResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

export interface SerpResponse {
  query: string;
  results: SerpResult[];
}

export async function serpSearch(
  query: string,
  zone: string,
  auth: BrightDataAuth,
  opts: { num?: number; country?: string } = {}
): Promise<SerpResponse> {
  const num = opts.num ?? 20;
  const params = new URLSearchParams({
    q: query,
    num: String(num),
    brd_json: "1"
  });
  if (opts.country) params.set("gl", opts.country);
  const targetUrl = `https://www.google.com/search?${params.toString()}`;

  const raw = await brightDataFetch(
    "https://api.brightdata.com/serp/req",
    { zone, url: targetUrl, format: "json" },
    auth
  ) as { organic?: Array<{ title: string; link: string; description?: string }> };

  const results: SerpResult[] = (raw.organic ?? []).map((r, i) => ({
    title: r.title,
    link: r.link,
    snippet: r.description ?? "",
    position: i + 1
  }));

  return { query, results };
}
```

- [ ] **Step 2: Commit**

```bash
cd E:/hack2
git add worker/src/brightdata/serp.ts
git commit -m "feat(brightdata): serp api wrapper"
```

## Task A9: Demand-signal client

**Files:**
- Create: `E:\hack2\worker\src\demand\client.ts`

- [ ] **Step 1: Write the client (KV-fallback path is added in Phase C)**

```ts
export interface DemandResult {
  domain: string;
  registrable: boolean;
  register_cost?: number;
  renewal_cost?: number;
  score?: number;
  score_components?: { length: number; pronounceability: number; tld: number; demand: number };
}

export interface DemandResponse {
  query: string;
  tlds_selected: string[];
  demand: number;
  results: DemandResult[];
}

export async function demandLookup(
  query: string,
  apiBase: string,
  kv?: KVNamespace
): Promise<DemandResponse | null> {
  const url = `${apiBase}/api/research?q=${encodeURIComponent(query)}&tlds=com&limit=5`;
  try {
    const res = await fetch(url, { headers: { "accept": "application/json" } });
    if (res.ok) return await res.json() as DemandResponse;
  } catch {
    // fall through to snapshot lookup
  }
  if (kv) {
    const snap = await kv.get(`demand_snapshot:${query.toLowerCase()}`, "json");
    if (snap) return snap as DemandResponse;
  }
  return null;
}
```

- [ ] **Step 2: Commit**

```bash
cd E:/hack2
git add worker/src/demand/client.ts
git commit -m "feat(demand): client with snapshot fallback hook"
```

## Task A10: Day-1 smoke handler

**Files:**
- Create: `E:\hack2\worker\src\handlers\smoke.ts`
- Modify: `E:\hack2\worker\src\index.ts`

- [ ] **Step 1: Write `worker/src/handlers/smoke.ts`**

```ts
import type { Env } from "../index";
import { serpSearch } from "../brightdata/serp";
import { demandLookup } from "../demand/client";

export async function smokeHandler(env: Env): Promise<Response> {
  const auth = { apiKey: env.BRIGHTDATA_API_KEY };
  const [serp, demand] = await Promise.allSettled([
    serpSearch("aerospace companies Houston", env.BRIGHTDATA_SERP_ZONE, auth, { num: 5 }),
    demandLookup("aerospace", env.DEMAND_API_BASE, env.CACHE)
  ]);
  return Response.json({
    serp: serp.status === "fulfilled"
      ? { ok: true, count: serp.value.results.length, first: serp.value.results[0] ?? null }
      : { ok: false, error: String(serp.reason) },
    demand: demand.status === "fulfilled"
      ? { ok: true, data: demand.value }
      : { ok: false, error: String(demand.reason) }
  });
}
```

- [ ] **Step 2: Wire into the router** — replace `worker/src/index.ts` with:

```ts
import { smokeHandler } from "./handlers/smoke";

export interface Env {
  CACHE: KVNamespace;
  ASSETS?: Fetcher;
  AIMLAPI_KEY?: string;
  GLM_API_KEY?: string;
  BRIGHTDATA_API_KEY: string;
  BRIGHTDATA_SERP_ZONE: string;
  BRIGHTDATA_WEB_UNLOCKER_ZONE: string;
  BRIGHTDATA_SCRAPER_ZONE: string;
  DEMAND_API_BASE: string;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/api/health") return Response.json({ ok: true, ts: Date.now() });
    if (url.pathname === "/api/smoke") return smokeHandler(env);
    return new Response("LongTail Scout — Worker is up", { headers: { "content-type": "text/plain" } });
  }
};
```

- [ ] **Step 3: Smoke test locally**

```bash
cd worker
pnpm dev
```

In another terminal:
```bash
curl -s http://127.0.0.1:8787/api/smoke | head -c 1000
```

Expected: JSON with both `serp.ok: true` and `demand.ok: true`. If `serp.ok: false`, recheck the zone name. If `demand.ok: false`, recheck the tunnel.

- [ ] **Step 4: Deploy and smoke**

```bash
pnpm deploy
```

Note the URL printed. Then:
```bash
curl -s https://longtail-scout.<your-subdomain>.workers.dev/api/smoke | head -c 1000
```

Expected: same as Step 3, but from the deployed Worker.

- [ ] **Step 5: Commit**

```bash
cd E:/hack2
git add worker/src/handlers/smoke.ts worker/src/index.ts
git commit -m "feat(worker): day-1 smoke endpoint"
```

**End of Phase A.** The deployed Worker calls Bright Data SERP and the demand API end-to-end.

---

# Phase B — Day 2 (Thu 5/28): agent pipeline end-to-end

Goal by end of Phase B: posting the demo query to `/api/scout` streams progress over ~60s and returns JSON with 10+ enriched operators and sales angles.

## Task B1: SSE stream helper (TDD)

**Files:**
- Create: `E:\hack2\worker\vitest.config.ts`
- Create: `E:\hack2\worker\src\stream.ts`
- Create: `E:\hack2\worker\tests\stream.test.ts`

- [ ] **Step 1: Write `worker/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
});
```

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { formatSseEvent } from "../src/stream";

describe("formatSseEvent", () => {
  it("formats event + JSON data with double-newline terminator", () => {
    const out = formatSseEvent("phase", { phase: "discovery" });
    expect(out).toBe('event: phase\ndata: {"phase":"discovery"}\n\n');
  });

  it("escapes newlines inside data values", () => {
    const out = formatSseEvent("progress", { message: "line1\nline2" });
    expect(out.split("\n\n").length).toBe(2);
    expect(out).toContain('"line1\\nline2"');
  });
});
```

- [ ] **Step 3: Verify it fails**

```bash
cd worker
pnpm test
```

Expected: FAIL with `Cannot find module '../src/stream'`.

- [ ] **Step 4: Implement**

`worker/src/stream.ts`:
```ts
export function formatSseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export class SseEmitter {
  private encoder = new TextEncoder();
  constructor(private writer: WritableStreamDefaultWriter<Uint8Array>) {}

  async emit(event: string, data: unknown): Promise<void> {
    await this.writer.write(this.encoder.encode(formatSseEvent(event, data)));
  }

  async close(): Promise<void> {
    await this.writer.close();
  }
}

export function createSseResponse(): { response: Response; emitter: SseEmitter } {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const emitter = new SseEmitter(writer);
  const response = new Response(readable, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      "x-accel-buffering": "no"
    }
  });
  return { response, emitter };
}
```

- [ ] **Step 5: Verify it passes**

```bash
pnpm test
```

Expected: PASS for both tests.

- [ ] **Step 6: Commit**

```bash
cd E:/hack2
git add worker/vitest.config.ts worker/src/stream.ts worker/tests/stream.test.ts
git commit -m "feat(worker): sse stream emitter"
```

## Task B2: KV cache with stable-key hashing (TDD)

**Files:**
- Create: `E:\hack2\worker\src\cache.ts`
- Create: `E:\hack2\worker\tests\cache.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { cacheKey } from "../src/cache";

describe("cacheKey", () => {
  it("produces a stable hex hash for the same args", async () => {
    const a = await cacheKey("serp", { q: "aerospace Houston", num: 10 });
    const b = await cacheKey("serp", { q: "aerospace Houston", num: 10 });
    expect(a).toBe(b);
    expect(a).toMatch(/^tool:serp:[0-9a-f]{64}$/);
  });

  it("differs for different args", async () => {
    const a = await cacheKey("serp", { q: "aerospace Houston" });
    const b = await cacheKey("serp", { q: "aerospace Dallas" });
    expect(a).not.toBe(b);
  });

  it("normalizes object key order", async () => {
    const a = await cacheKey("serp", { q: "x", num: 5 });
    const b = await cacheKey("serp", { num: 5, q: "x" });
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
cd worker && pnpm test
```

Expected: FAIL.

- [ ] **Step 3: Implement**

`worker/src/cache.ts`:
```ts
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + stableStringify((value as Record<string, unknown>)[k])).join(",") + "}";
}

export async function cacheKey(tool: string, args: unknown): Promise<string> {
  const enc = new TextEncoder().encode(stableStringify(args));
  const digest = await crypto.subtle.digest("SHA-256", enc);
  const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
  return `tool:${tool}:${hex}`;
}

export interface CacheOpts {
  ttlSeconds: number;
}

export async function cachedFetch<T>(
  kv: KVNamespace,
  tool: string,
  args: unknown,
  opts: CacheOpts,
  fetcher: () => Promise<T>
): Promise<T> {
  const key = await cacheKey(tool, args);
  const cached = await kv.get(key, "json");
  if (cached !== null) return cached as T;
  const fresh = await fetcher();
  await kv.put(key, JSON.stringify(fresh), { expirationTtl: opts.ttlSeconds });
  return fresh;
}
```

- [ ] **Step 4: Verify pass**

```bash
pnpm test
```

Expected: PASS for all three.

- [ ] **Step 5: Commit**

```bash
cd E:/hack2
git add worker/src/cache.ts worker/tests/cache.test.ts
git commit -m "feat(worker): kv cache with stable hashing"
```

## Task B3: Cached SERP variant

**Files:**
- Modify: `E:\hack2\worker\src\brightdata\serp.ts`

- [ ] **Step 1: Append**

```ts
import { cachedFetch } from "../cache";

export async function serpSearchCached(
  query: string,
  zone: string,
  auth: BrightDataAuth,
  kv: KVNamespace,
  opts: { num?: number; country?: string } = {}
): Promise<SerpResponse> {
  return cachedFetch(
    kv,
    "serp",
    { query, num: opts.num ?? 20, country: opts.country ?? null },
    { ttlSeconds: 86400 },
    () => serpSearch(query, zone, auth, opts)
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd E:/hack2
git add worker/src/brightdata/serp.ts
git commit -m "feat(brightdata): cached serp variant"
```

## Task B4: Web Unlocker wrapper

**Files:**
- Create: `E:\hack2\worker\src\brightdata\webUnlocker.ts`

- [ ] **Step 1: Write**

```ts
import { brightDataFetch, BrightDataAuth } from "./client";
import { cachedFetch } from "../cache";

export interface UnlockedPage {
  url: string;
  status: number;
  html: string;
  fetched_at: string;
}

export async function webUnlocker(
  url: string,
  zone: string,
  auth: BrightDataAuth
): Promise<UnlockedPage> {
  const raw = await brightDataFetch(
    "https://api.brightdata.com/request",
    { zone, url, format: "raw" },
    auth
  ) as { body?: string; status_code?: number };
  return {
    url,
    status: raw.status_code ?? 200,
    html: raw.body ?? "",
    fetched_at: new Date().toISOString()
  };
}

export async function webUnlockerCached(
  url: string,
  zone: string,
  auth: BrightDataAuth,
  kv: KVNamespace
): Promise<UnlockedPage> {
  return cachedFetch(
    kv,
    "web_unlocker",
    { url },
    { ttlSeconds: 604800 },
    () => webUnlocker(url, zone, auth)
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd E:/hack2
git add worker/src/brightdata/webUnlocker.ts
git commit -m "feat(brightdata): web unlocker wrapper"
```

## Task B5: Web Scraper wrapper

**Files:**
- Create: `E:\hack2\worker\src\brightdata\webScraper.ts`

- [ ] **Step 1: Write**

```ts
import { brightDataFetch, BrightDataAuth } from "./client";
import { cachedFetch } from "../cache";

export interface ScrapedPage {
  url: string;
  fields: Record<string, unknown>;
}

export async function webScraperGeneric(
  url: string,
  zone: string,
  auth: BrightDataAuth,
  extractFields: string[]
): Promise<ScrapedPage> {
  const raw = await brightDataFetch(
    "https://api.brightdata.com/request",
    { zone, url, format: "json", extract: extractFields },
    auth
  ) as { extracted?: Record<string, unknown> };
  return { url, fields: raw.extracted ?? {} };
}

export async function webScraperCached(
  url: string,
  zone: string,
  auth: BrightDataAuth,
  kv: KVNamespace,
  extractFields: string[]
): Promise<ScrapedPage> {
  return cachedFetch(
    kv,
    "web_scraper",
    { url, fields: extractFields },
    { ttlSeconds: 604800 },
    () => webScraperGeneric(url, zone, auth, extractFields)
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd E:/hack2
git add worker/src/brightdata/webScraper.ts
git commit -m "feat(brightdata): web scraper wrapper"
```

## Task B6: Scraping Browser wrapper with JS-heavy heuristic

**Files:**
- Create: `E:\hack2\worker\src\brightdata\scrapingBrowser.ts`

- [ ] **Step 1: Write**

```ts
import { cachedFetch } from "../cache";

export function needsBrowser(url: string): boolean {
  return /greenhouse\.io|lever\.co|workday\.com|ashbyhq\.com|myworkdayjobs\.com/i.test(url);
}

export interface BrowserPage {
  url: string;
  text: string;
  links: string[];
}

export async function scrapingBrowserFetch(
  url: string,
  zone: string,
  apiKey: string
): Promise<BrowserPage> {
  const res = await fetch("https://api.brightdata.com/request", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ zone, url, format: "raw", render: true })
  });
  if (!res.ok) throw new Error(`scrapingBrowserFetch ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json() as { body?: string };
  const html = data.body ?? "";
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const links = Array.from(html.matchAll(/href=["']([^"']+)["']/g)).map(m => m[1] as string).slice(0, 100);
  return { url, text, links };
}

export async function scrapingBrowserCached(
  url: string,
  zone: string,
  apiKey: string,
  kv: KVNamespace
): Promise<BrowserPage> {
  return cachedFetch(
    kv,
    "scraping_browser",
    { url },
    { ttlSeconds: 604800 },
    () => scrapingBrowserFetch(url, zone, apiKey)
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd E:/hack2
git add worker/src/brightdata/scrapingBrowser.ts
git commit -m "feat(brightdata): scraping browser wrapper with js-heavy heuristic"
```

## Task B7: Shared types

**Files:**
- Create: `E:\hack2\worker\src\types.ts`

- [ ] **Step 1: Write**

```ts
export interface Citation {
  field: string;
  tool: string;
  url: string;
}

export interface Operator {
  name: string;
  url: string;
  sources: Citation[];
  about: string | null;
  size_estimate: "1-10" | "11-50" | "51-100" | "100+" | null;
  hiring: {
    count: number | null;
    roles: string[];
    source: string | null;
  };
  recent_activity: { headline: string; date: string; source: string }[];
  demand_signal: { score: number; nearby_count: number } | null;
  sales_angle: string;
  rank: number;
}

export interface Candidate {
  name: string;
  url: string;
  origin_query: string;
}

export interface ScoutQuery {
  niche: string;
  city: string;
  raw: string;
}
```

- [ ] **Step 2: Commit**

```bash
cd E:/hack2
git add worker/src/types.ts
git commit -m "feat(worker): shared types"
```

## Task B8: Dedupe + aggregator filter (TDD)

**Files:**
- Create: `E:\hack2\worker\src\agent\dedupe.ts`
- Create: `E:\hack2\worker\tests\dedupe.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { dedupeCandidates, extractDomain } from "../src/agent/dedupe";

describe("extractDomain", () => {
  it("strips protocol, www, and trailing slash", () => {
    expect(extractDomain("https://www.foo.com/about")).toBe("foo.com");
    expect(extractDomain("http://Foo.com")).toBe("foo.com");
    expect(extractDomain("https://bar.foo.com/")).toBe("bar.foo.com");
  });
  it("returns lowercased input on parse failure", () => {
    expect(extractDomain("not a url")).toBe("not a url");
  });
});

describe("dedupeCandidates", () => {
  it("merges candidates that share a registrable domain", () => {
    const input = [
      { name: "Foo Aerospace", url: "https://www.fooaero.com/about", origin_query: "q1" },
      { name: "Foo Aerospace Inc", url: "https://fooaero.com/contact", origin_query: "q2" },
      { name: "Bar Avionics", url: "https://baravionics.com", origin_query: "q1" }
    ];
    const out = dedupeCandidates(input);
    expect(out).toHaveLength(2);
    expect(out.map(c => c.name).sort()).toEqual(["Bar Avionics", "Foo Aerospace"]);
  });
  it("filters out social media + aggregator domains", () => {
    const input = [
      { name: "Some LinkedIn page", url: "https://linkedin.com/in/somebody", origin_query: "q" },
      { name: "Crunchbase listing", url: "https://crunchbase.com/organization/x", origin_query: "q" },
      { name: "Real Co", url: "https://realco.com", origin_query: "q" }
    ];
    const out = dedupeCandidates(input);
    expect(out).toHaveLength(1);
    expect(out[0]?.name).toBe("Real Co");
  });
});
```

- [ ] **Step 2: Verify fail**

```bash
cd worker && pnpm test
```

Expected: FAIL.

- [ ] **Step 3: Implement**

`worker/src/agent/dedupe.ts`:
```ts
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
```

- [ ] **Step 4: Verify pass**

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd E:/hack2
git add worker/src/agent/dedupe.ts worker/tests/dedupe.test.ts
git commit -m "feat(agent): dedupe + aggregator filter"
```

## Task B9: Prompts (TDD)

**Files:**
- Create: `E:\hack2\worker\src\agent\prompts.ts`
- Create: `E:\hack2\worker\tests\prompts.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { buildDiscoveryPrompt, buildSynthesisPrompt } from "../src/agent/prompts";

describe("buildDiscoveryPrompt", () => {
  it("includes niche and city in user message", () => {
    const out = buildDiscoveryPrompt({ niche: "aerospace", city: "Houston", raw: "aerospace in Houston" });
    expect(out.user).toContain("aerospace");
    expect(out.user).toContain("Houston");
  });
  it("system instructs the model to diversify SERP queries", () => {
    const out = buildDiscoveryPrompt({ niche: "x", city: "y", raw: "..." });
    expect(out.system.toLowerCase()).toContain("serp");
    expect(out.system.toLowerCase()).toContain("diverse");
  });
});

describe("buildSynthesisPrompt", () => {
  it("forbids inventing facts", () => {
    const out = buildSynthesisPrompt({ niche: "x", city: "y", raw: "..." }, []);
    expect(out.system.toLowerCase()).toContain("never invent");
  });
});
```

- [ ] **Step 2: Fail**

```bash
cd worker && pnpm test
```

Expected: FAIL.

- [ ] **Step 3: Implement**

`worker/src/agent/prompts.ts`:
```ts
import type { ScoutQuery } from "../types";

export interface PromptPair {
  system: string;
  user: string;
}

export function buildDiscoveryPrompt(q: ScoutQuery): PromptPair {
  const system = `You are an expert GTM researcher specializing in finding small, local, long-tail businesses that Apollo/ZoomInfo/Clay miss.

Your job: given a niche x city query, generate 3-6 diverse SERP queries that will surface small operators (NOT directory aggregators, NOT big-name corporations).

Call the \`serp_search\` tool for each query. Aim for diverse coverage:
- One direct query ("<niche> companies <city>")
- One supplier/contractor angle ("<niche> suppliers <city>", "<niche> contractors <city>")
- One hiring angle ("<niche> hiring <city>" - surfaces actively-growing operators)
- One news/press angle ("<niche> startup <city>")
- One adjacent vertical if appropriate (e.g., for "aerospace" -> "avionics", "RF engineering", "machine shop")

After gathering results, call \`finalize_candidates\` with the deduped list of {name, url} pairs that look like real operators.

Rules:
- Skip LinkedIn, Crunchbase, Wikipedia, news aggregators - we want the operator's actual website.
- Skip Fortune-500 / publicly-traded primes - we want the long tail.
- 30-60 candidates is the right size; we'll filter further downstream.`;

  const user = `Find long-tail operators for this query:

Niche: ${q.niche}
City: ${q.city}
Raw input: "${q.raw}"

Generate diverse SERP queries, call serp_search for each, then call finalize_candidates with your deduped list.`;

  return { system, user };
}

export function buildSynthesisPrompt(q: ScoutQuery, enriched: unknown[]): PromptPair {
  const system = `You are a GTM analyst ranking long-tail business operators and writing a single-sentence sales angle for each.

For each operator, output:
- rank (1 = strongest fit for the query)
- sales_angle: ONE sentence, specific, evidence-grounded. Reference a concrete fact from the enrichment data.

Rules:
- NEVER invent facts. Only use data present in the enrichment record.
- If hiring data is empty, do NOT say "actively hiring".
- Rank by: relevance to query > evidence of recent activity > size-fit (smaller = better for "long tail") > demand signal.
- Output strictly the JSON schema. No prose.`;

  const user = `Query:
Niche: ${q.niche}
City: ${q.city}

Enriched candidates (JSON):
${JSON.stringify(enriched, null, 2)}

Output JSON: { "operators": [ { "name": "...", "url": "...", "rank": 1, "sales_angle": "..." }, ... ] }`;

  return { system, user };
}
```

- [ ] **Step 4: Verify pass**

```bash
pnpm test
```

- [ ] **Step 5: Commit**

```bash
cd E:/hack2
git add worker/src/agent/prompts.ts worker/tests/prompts.test.ts
git commit -m "feat(agent): discovery and synthesis prompts"
```

## Task B10: LLM client with provider fallback

**Files:**
- Create: `E:\hack2\worker\src\llm\client.ts`

- [ ] **Step 1: Write the client**

```ts
import OpenAI from "openai";
import type { ChatCompletion, ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";

export interface LlmEnv {
  AIMLAPI_KEY?: string;
  GLM_API_KEY?: string;
}

interface Provider {
  name: string;
  baseURL: string;
  apiKey: string | undefined;
  model: string;
}

function getProviders(env: LlmEnv): Provider[] {
  return [
    { name: "aimlapi", baseURL: "https://api.aimlapi.com/v1", apiKey: env.AIMLAPI_KEY, model: "claude-sonnet-4-6" },
    { name: "glm", baseURL: "https://api.z.ai/api/paas/v4", apiKey: env.GLM_API_KEY, model: "glm-4.6" }
  ].filter(p => p.apiKey);
}

export interface LlmCallOpts {
  system: string;
  messages: ChatCompletionMessageParam[];
  tools?: ChatCompletionTool[];
  toolChoice?: "auto" | "required";
  responseFormat?: "json_object" | "text";
  maxTokens?: number;
}

export interface LlmResult {
  response: ChatCompletion;
  provider: string;
  model: string;
}

export async function llmCall(env: LlmEnv, opts: LlmCallOpts): Promise<LlmResult> {
  const providers = getProviders(env);
  if (providers.length === 0) throw new Error("No LLM provider configured (set AIMLAPI_KEY or GLM_API_KEY)");

  const errors: string[] = [];
  for (const p of providers) {
    try {
      const client = new OpenAI({ apiKey: p.apiKey!, baseURL: p.baseURL });
      const payload: Parameters<typeof client.chat.completions.create>[0] = {
        model: p.model,
        messages: [{ role: "system", content: opts.system }, ...opts.messages],
        max_tokens: opts.maxTokens ?? 4096
      };
      if (opts.tools && opts.tools.length > 0) {
        payload.tools = opts.tools;
        payload.tool_choice = opts.toolChoice ?? "auto";
      }
      if (opts.responseFormat === "json_object") {
        payload.response_format = { type: "json_object" };
      }
      const resp = await client.chat.completions.create(payload);
      return { response: resp, provider: p.name, model: p.model };
    } catch (err) {
      errors.push(`${p.name}: ${(err as Error).message}`);
    }
  }
  throw new Error(`All LLM providers failed: ${errors.join(" | ")}`);
}
```

Note: GLM-4.6 may not support `response_format: json_object` reliably. The synthesis prompt asks for raw JSON anyway and the synthesize handler tolerates code-fenced output.

- [ ] **Step 2: Commit**

```bash
cd E:/hack2
git add worker/src/llm/client.ts
git commit -m "feat(llm): openai-compatible client with aimlapi+glm fallback"
```

## Task B11: Phase 1 — discovery

**Files:**
- Create: `E:\hack2\worker\src\agent\discovery.ts`

- [ ] **Step 1: Write discovery**

```ts
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import type { Env } from "../index";
import type { Candidate, ScoutQuery } from "../types";
import { serpSearchCached } from "../brightdata/serp";
import { dedupeCandidates } from "./dedupe";
import { buildDiscoveryPrompt } from "./prompts";
import { llmCall } from "../llm/client";
import type { SseEmitter } from "../stream";

const DISCOVERY_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "serp_search",
      description: "Search the web via Bright Data SERP API. Returns up to 20 organic results.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "The search query." } },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "finalize_candidates",
      description: "Submit the deduped candidate list and end discovery.",
      parameters: {
        type: "object",
        properties: {
          candidates: {
            type: "array",
            items: {
              type: "object",
              properties: { name: { type: "string" }, url: { type: "string" } },
              required: ["name", "url"]
            }
          }
        },
        required: ["candidates"]
      }
    }
  }
];

export async function discoverCandidates(
  q: ScoutQuery,
  env: Env,
  emit: SseEmitter
): Promise<Candidate[]> {
  await emit.emit("phase", { phase: "discovery" });
  const auth = { apiKey: env.BRIGHTDATA_API_KEY };
  const { system, user } = buildDiscoveryPrompt(q);

  const messages: ChatCompletionMessageParam[] = [{ role: "user", content: user }];
  const rawCandidates: Candidate[] = [];

  for (let turn = 0; turn < 4; turn++) {
    const { response, provider } = await llmCall(env, {
      system,
      messages,
      tools: DISCOVERY_TOOLS,
      toolChoice: "auto"
    });
    await emit.emit("progress", { message: `Discovery turn ${turn + 1} via ${provider}` });

    const choice = response.choices[0];
    if (!choice) throw new Error("LLM returned no choices");
    const msg = choice.message;
    messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });

    if (!msg.tool_calls || msg.tool_calls.length === 0) break;

    let finalized = false;
    for (const tc of msg.tool_calls) {
      if (tc.type !== "function") continue;
      const args = JSON.parse(tc.function.arguments) as Record<string, unknown>;

      if (tc.function.name === "serp_search") {
        const query = String(args.query ?? "");
        await emit.emit("tool", { tool: "serp", args: { query }, url: null });
        try {
          const result = await serpSearchCached(query, env.BRIGHTDATA_SERP_ZONE, auth, env.CACHE, { num: 15 });
          for (const r of result.results) {
            rawCandidates.push({ name: r.title, url: r.link, origin_query: query });
            await emit.emit("candidate", { name: r.title, url: r.link });
          }
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ count: result.results.length, results: result.results.slice(0, 10).map(r => ({ title: r.title, link: r.link, snippet: r.snippet })) })
          });
        } catch (err) {
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: `Error: ${(err as Error).message}`
          });
        }
      } else if (tc.function.name === "finalize_candidates") {
        finalized = true;
        const candidates = (args.candidates as Array<{ name: string; url: string }>) ?? [];
        for (const c of candidates) {
          rawCandidates.push({ name: c.name, url: c.url, origin_query: "model_finalized" });
        }
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: `accepted ${candidates.length} candidates`
        });
      }
    }

    if (finalized) break;
  }

  const deduped = dedupeCandidates(rawCandidates).slice(0, 25);
  await emit.emit("progress", { message: `Discovered ${deduped.length} candidates after dedupe.` });
  return deduped;
}
```

- [ ] **Step 2: Commit**

```bash
cd E:/hack2
git add worker/src/agent/discovery.ts
git commit -m "feat(agent): phase 1 discovery via openai-compatible tool-use loop"
```

## Task B12: Phase 2 — enrichment

**Files:**
- Create: `E:\hack2\worker\src\agent\enrich.ts`

- [ ] **Step 1: Write enrichment**

```ts
import type { Env } from "../index";
import type { Candidate, Citation, Operator } from "../types";
import { serpSearchCached } from "../brightdata/serp";
import { webUnlockerCached } from "../brightdata/webUnlocker";
import { needsBrowser, scrapingBrowserCached } from "../brightdata/scrapingBrowser";
import { demandLookup } from "../demand/client";
import type { SseEmitter } from "../stream";

type Partial = Pick<Operator, "name" | "url" | "sources" | "about" | "size_estimate" | "hiring" | "recent_activity" | "demand_signal">;

function extractAbout(html: string): string | null {
  const meta = /<meta\s+name=["']description["']\s+content=["']([^"']{20,400})["']/i.exec(html);
  if (meta) return meta[1] ?? null;
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.slice(0, 400) || null;
}

function estimateSize(html: string): Operator["size_estimate"] {
  const t = html.toLowerCase();
  if (/\b(global|fortune|enterprise|thousands of employees|10,000\+|nasdaq|nyse)\b/.test(t)) return "100+";
  if (/\b(team of \d{2,3}|50\+ employees|growing team)\b/.test(t)) return "51-100";
  if (/\b(small team|boutique|family-owned|founded|startup|seed|series a)\b/.test(t)) return "11-50";
  return null;
}

function extractRoles(text: string): string[] {
  const roles = new Set<string>();
  const patterns = [/(engineer)/gi, /(technician)/gi, /(machinist)/gi, /(developer)/gi, /(designer)/gi, /(manager)/gi, /(sales)/gi, /(operations)/gi];
  for (const p of patterns) {
    for (const m of text.matchAll(p)) roles.add((m[1] ?? "").toLowerCase());
  }
  return [...roles];
}

async function enrichOne(c: Candidate, env: Env, emit: SseEmitter): Promise<Partial | null> {
  const auth = { apiKey: env.BRIGHTDATA_API_KEY };
  const sources: Citation[] = [];

  let homepageHtml = "";
  try {
    const page = await webUnlockerCached(c.url, env.BRIGHTDATA_WEB_UNLOCKER_ZONE, auth, env.CACHE);
    homepageHtml = page.html;
    sources.push({ field: "about", tool: "web_unlocker", url: c.url });
    await emit.emit("enrich", { name: c.name, field: "homepage", status: "ok" });
  } catch (err) {
    await emit.emit("enrich", { name: c.name, field: "homepage", status: "fail", error: (err as Error).message });
    return null;
  }

  const about = extractAbout(homepageHtml);
  const size_estimate = estimateSize(homepageHtml);

  let hiring: Operator["hiring"] = { count: null, roles: [], source: null };
  try {
    const hiringSerp = await serpSearchCached(`"${c.name}" hiring careers`, env.BRIGHTDATA_SERP_ZONE, auth, env.CACHE, { num: 10 });
    const careersHit = hiringSerp.results.find(r => /career|jobs|hiring/i.test(r.link + r.title));
    if (careersHit) {
      hiring.source = careersHit.link;
      sources.push({ field: "hiring", tool: "serp", url: careersHit.link });
      if (needsBrowser(careersHit.link)) {
        try {
          const page = await scrapingBrowserCached(careersHit.link, env.BRIGHTDATA_SCRAPER_ZONE, env.BRIGHTDATA_API_KEY, env.CACHE);
          hiring.roles = extractRoles(page.text);
          hiring.count = hiring.roles.length || null;
        } catch (err) {
          await emit.emit("enrich", { name: c.name, field: "hiring-browser", status: "fail", error: (err as Error).message });
        }
      } else {
        try {
          const page = await webUnlockerCached(careersHit.link, env.BRIGHTDATA_WEB_UNLOCKER_ZONE, auth, env.CACHE);
          hiring.roles = extractRoles(page.html);
          hiring.count = hiring.roles.length || null;
        } catch {
          // tolerate
        }
      }
    }
    await emit.emit("enrich", { name: c.name, field: "hiring", status: "ok", roles: hiring.roles.length });
  } catch (err) {
    await emit.emit("enrich", { name: c.name, field: "hiring", status: "fail", error: (err as Error).message });
  }

  const recent_activity: Operator["recent_activity"] = [];
  try {
    const newsSerp = await serpSearchCached(`"${c.name}" news`, env.BRIGHTDATA_SERP_ZONE, auth, env.CACHE, { num: 5 });
    for (const r of newsSerp.results.slice(0, 3)) {
      recent_activity.push({ headline: r.title, date: "", source: r.link });
      sources.push({ field: "recent_activity", tool: "serp", url: r.link });
    }
    await emit.emit("enrich", { name: c.name, field: "news", status: "ok", count: recent_activity.length });
  } catch {
    await emit.emit("enrich", { name: c.name, field: "news", status: "fail" });
  }

  let demand_signal: Operator["demand_signal"] = null;
  try {
    const d = await demandLookup(c.name.split(/\s+/)[0] ?? c.name, env.DEMAND_API_BASE, env.CACHE);
    if (d) {
      demand_signal = { score: d.results[0]?.score ?? 0, nearby_count: d.demand };
      sources.push({ field: "demand_signal", tool: "demand_api", url: `${env.DEMAND_API_BASE}/api/research?q=${encodeURIComponent(c.name)}` });
    }
    await emit.emit("enrich", { name: c.name, field: "demand", status: "ok" });
  } catch {
    await emit.emit("enrich", { name: c.name, field: "demand", status: "fail" });
  }

  return { name: c.name, url: c.url, sources, about, size_estimate, hiring, recent_activity, demand_signal };
}

export async function enrichCandidates(
  candidates: Candidate[],
  env: Env,
  emit: SseEmitter
): Promise<Partial[]> {
  await emit.emit("phase", { phase: "enrichment" });
  const capped = candidates.slice(0, 15);
  await emit.emit("progress", { message: `Enriching ${capped.length} candidates in parallel...` });

  const settled = await Promise.allSettled(capped.map(c => enrichOne(c, env, emit)));
  const out: Partial[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled" && r.value) out.push(r.value);
  }
  await emit.emit("progress", { message: `Enriched ${out.length} of ${capped.length}.` });
  return out;
}
```

- [ ] **Step 2: Commit**

```bash
cd E:/hack2
git add worker/src/agent/enrich.ts
git commit -m "feat(agent): phase 2 deterministic enrichment fan-out"
```

## Task B13: Phase 3 — synthesis

**Files:**
- Create: `E:\hack2\worker\src\agent\synthesize.ts`

- [ ] **Step 1: Write synthesis**

```ts
import type { Env } from "../index";
import type { Operator, ScoutQuery } from "../types";
import { buildSynthesisPrompt } from "./prompts";
import { llmCall } from "../llm/client";
import type { SseEmitter } from "../stream";

type EnrichmentInput = Omit<Operator, "rank" | "sales_angle">;

export async function synthesize(
  q: ScoutQuery,
  enriched: EnrichmentInput[],
  env: Env,
  emit: SseEmitter
): Promise<Operator[]> {
  await emit.emit("phase", { phase: "synthesis" });

  const { system, user } = buildSynthesisPrompt(q, enriched);
  const { response, provider } = await llmCall(env, {
    system,
    messages: [{ role: "user", content: user }],
    responseFormat: "json_object"
  });
  await emit.emit("progress", { message: `Synthesis via ${provider}` });

  const text = response.choices[0]?.message.content ?? "";
  let jsonStr = text.trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(jsonStr);
  if (fence) jsonStr = (fence[1] ?? "").trim();

  let parsed: { operators: Array<{ name: string; url: string; rank: number; sales_angle: string }> };
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    throw new Error(`Synthesis JSON parse failed: ${(err as Error).message}\nRaw: ${jsonStr.slice(0, 500)}`);
  }

  const byName = new Map(enriched.map(e => [e.name, e]));
  const operators: Operator[] = parsed.operators.map(o => {
    const base = byName.get(o.name);
    if (!base) {
      return {
        name: o.name,
        url: o.url,
        sources: [],
        about: null,
        size_estimate: null,
        hiring: { count: null, roles: [], source: null },
        recent_activity: [],
        demand_signal: null,
        sales_angle: o.sales_angle,
        rank: o.rank
      };
    }
    return { ...base, sales_angle: o.sales_angle, rank: o.rank };
  });

  operators.sort((a, b) => a.rank - b.rank);
  return operators;
}
```

- [ ] **Step 2: Commit**

```bash
cd E:/hack2
git add worker/src/agent/synthesize.ts
git commit -m "feat(agent): phase 3 synthesis via openai-compatible structured output"
```

## Task B14: Wire `/api/scout` SSE handler

**Files:**
- Create: `E:\hack2\worker\src\handlers\scout.ts`
- Modify: `E:\hack2\worker\src\index.ts`

- [ ] **Step 1: Write the handler**

```ts
import type { Env } from "../index";
import type { ScoutQuery } from "../types";
import { createSseResponse } from "../stream";
import { discoverCandidates } from "../agent/discovery";
import { enrichCandidates } from "../agent/enrich";
import { synthesize } from "../agent/synthesize";

function parseQuery(raw: string): ScoutQuery {
  const inIdx = raw.toLowerCase().lastIndexOf(" in ");
  if (inIdx > 0) {
    return { niche: raw.slice(0, inIdx).trim(), city: raw.slice(inIdx + 4).trim(), raw };
  }
  return { niche: raw, city: "", raw };
}

export async function scoutHandler(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  let body: { query?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (!body.query || typeof body.query !== "string") return new Response("Missing 'query'", { status: 400 });

  const q = parseQuery(body.query);
  const { response, emitter } = createSseResponse();

  ctx.waitUntil((async () => {
    try {
      await emitter.emit("progress", { message: `Parsed query - niche="${q.niche}", city="${q.city}".` });
      const candidates = await discoverCandidates(q, env, emitter);
      const enriched = await enrichCandidates(candidates, env, emitter);
      const operators = await synthesize(q, enriched, env, emitter);
      await emitter.emit("result", { operators });
      await emitter.emit("done", {});
    } catch (err) {
      await emitter.emit("error", { message: (err as Error).message, recoverable: false });
    } finally {
      await emitter.close();
    }
  })());

  return response;
}
```

- [ ] **Step 2: Wire into router** — replace `worker/src/index.ts` `fetch` body:

```ts
import { smokeHandler } from "./handlers/smoke";
import { scoutHandler } from "./handlers/scout";

export interface Env {
  CACHE: KVNamespace;
  ASSETS?: Fetcher;
  AIMLAPI_KEY?: string;
  GLM_API_KEY?: string;
  BRIGHTDATA_API_KEY: string;
  BRIGHTDATA_SERP_ZONE: string;
  BRIGHTDATA_WEB_UNLOCKER_ZONE: string;
  BRIGHTDATA_SCRAPER_ZONE: string;
  DEMAND_API_BASE: string;
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/api/health") return Response.json({ ok: true, ts: Date.now() });
    if (url.pathname === "/api/smoke") return smokeHandler(env);
    if (url.pathname === "/api/scout") return scoutHandler(req, env, ctx);
    return new Response("LongTail Scout - Worker is up", { headers: { "content-type": "text/plain" } });
  }
};
```

- [ ] **Step 3: Test locally**

```bash
cd worker
pnpm dev
```

In another terminal:
```bash
curl -N -X POST http://127.0.0.1:8787/api/scout \
  -H "Content-Type: application/json" \
  -d '{"query":"aerospace and space-tech companies in Houston"}'
```

Expected: SSE stream of `phase`, `tool`, `candidate`, `enrich`, ending with `result` (operators array) then `done`. Total runtime ~60-120s.

- [ ] **Step 4: Deploy and test**

```bash
pnpm deploy
curl -N -X POST https://longtail-scout.<your-subdomain>.workers.dev/api/scout \
  -H "Content-Type: application/json" \
  -d '{"query":"aerospace and space-tech companies in Houston"}'
```

Expected: same as Step 3.

- [ ] **Step 5: Commit**

```bash
cd E:/hack2
git add worker/src/handlers/scout.ts worker/src/index.ts
git commit -m "feat(worker): /api/scout sse pipeline end-to-end"
```

## Task B15: Minimal HTML test page

**Files:**
- Create: `E:\hack2\worker\src\static\index.html`
- Modify: `E:\hack2\worker\src\index.ts`
- Modify: `E:\hack2\worker\wrangler.toml`

- [ ] **Step 1: Write `worker/src/static/index.html`**

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>LongTail Scout - Phase B test</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; max-width: 920px; margin: 2rem auto; padding: 0 1rem; }
    #trace { background: #111; color: #ddd; padding: 1rem; height: 320px; overflow: auto; font-family: ui-monospace, monospace; font-size: 12px; white-space: pre-wrap; }
    pre { background: #f6f6f6; padding: 1rem; overflow: auto; }
    input { width: 60%; padding: 0.5rem; font-size: 1rem; }
    button { padding: 0.5rem 1rem; font-size: 1rem; }
  </style>
</head>
<body>
  <h1>LongTail Scout - Phase B test page</h1>
  <input id="q" value="aerospace and space-tech companies in Houston" />
  <button id="go">Run</button>
  <h2>Trace</h2>
  <div id="trace"></div>
  <h2>Result</h2>
  <pre id="result"></pre>
  <script>
    const trace = document.getElementById('trace');
    const result = document.getElementById('result');
    document.getElementById('go').onclick = async () => {
      trace.textContent = '';
      result.textContent = '';
      const resp = await fetch('/api/scout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: document.getElementById('q').value })
      });
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const evLine = chunk.split('\n').find(l => l.startsWith('event: '));
          const dataLine = chunk.split('\n').find(l => l.startsWith('data: '));
          if (!evLine || !dataLine) continue;
          const ev = evLine.slice(7);
          const data = JSON.parse(dataLine.slice(6));
          trace.textContent += '[' + ev + '] ' + JSON.stringify(data) + '\n';
          trace.scrollTop = trace.scrollHeight;
          if (ev === 'result') result.textContent = JSON.stringify(data, null, 2);
        }
      }
    };
  </script>
</body>
</html>
```

- [ ] **Step 2: Add a Text-import rule in `wrangler.toml`**

Append to `worker/wrangler.toml`:
```toml
rules = [
  { type = "Text", globs = ["**/*.html"], fallthrough = false }
]
```

- [ ] **Step 3: Serve the HTML** — modify `worker/src/index.ts`:

Add at the top:
```ts
import indexHtml from "./static/index.html";
```

Replace the fallback line `return new Response("LongTail Scout - Worker is up", ...)` with:
```ts
return new Response(indexHtml, { headers: { "content-type": "text/html; charset=utf-8" } });
```

- [ ] **Step 4: Smoke test**

```bash
cd worker
pnpm dev
```

Open http://127.0.0.1:8787/. Click Run. Wait ~60-120s. The result `<pre>` should populate.

- [ ] **Step 5: Deploy**

```bash
pnpm deploy
```

Open https://longtail-scout.<your-subdomain>.workers.dev/. Click Run. Verify end-to-end.

- [ ] **Step 6: Commit**

```bash
cd E:/hack2
git add worker/src/static/index.html worker/src/index.ts worker/wrangler.toml
git commit -m "feat(worker): phase-b html test page"
```

**End of Phase B.** Demo query produces 10+ enriched operators end-to-end with live streaming progress.

---

# Phase C — Day 3 (Fri 5/29): UI, reliability, custom domain

Goal by end of Phase C: polished demo URL at `longtailscout.com`, query returns ranked + cited results in <90s on warm cache, public GitHub repo.

## Task C1: Scaffold Vite + Preact + Tailwind

**Files:**
- Create: `E:\hack2\web\package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `src\main.tsx`, `src\styles.css`

- [ ] **Step 1: Init**

```bash
cd E:/hack2
mkdir web
cd web
pnpm init
pnpm add preact
pnpm add -D vite @preact/preset-vite typescript tailwindcss postcss autoprefixer
```

- [ ] **Step 2: `web/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [preact()],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false
  }
});
```

- [ ] **Step 3: `web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "jsx": "preserve",
    "jsxImportSource": "preact",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

- [ ] **Step 4: Init Tailwind**

```bash
pnpm dlx tailwindcss init -p
```

`web/tailwind.config.js`:
```js
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: []
};
```

- [ ] **Step 5: `web/index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <title>LongTail Scout</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 6: `web/src/styles.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 7: `web/src/main.tsx` (stub)**

```tsx
import { render } from "preact";
import "./styles.css";

function App() {
  return <div class="p-8 text-2xl">LongTail Scout - Phase C stub</div>;
}

render(<App />, document.getElementById("app")!);
```

- [ ] **Step 8: Scripts** — edit `web/package.json` `"scripts"`:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build"
}
```

- [ ] **Step 9: Smoke test**

```bash
pnpm dev
```

Visit http://localhost:5173. Verify the stub renders. Stop.

- [ ] **Step 10: Commit**

```bash
cd E:/hack2
git add web/
git commit -m "feat(web): vite + preact + tailwind scaffold"
```

## Task C2: Types + SSE reader

**Files:**
- Create: `E:\hack2\web\src\types.ts`
- Create: `E:\hack2\web\src\sse.ts`

- [ ] **Step 1: `web/src/types.ts`**

```ts
export interface Citation { field: string; tool: string; url: string }

export interface Operator {
  name: string;
  url: string;
  sources: Citation[];
  about: string | null;
  size_estimate: "1-10" | "11-50" | "51-100" | "100+" | null;
  hiring: { count: number | null; roles: string[]; source: string | null };
  recent_activity: { headline: string; date: string; source: string }[];
  demand_signal: { score: number; nearby_count: number } | null;
  sales_angle: string;
  rank: number;
}

export type SseEvent =
  | { event: "phase"; data: { phase: "discovery" | "enrichment" | "synthesis" } }
  | { event: "progress"; data: { message: string } }
  | { event: "tool"; data: { tool: string; args: Record<string, unknown>; url: string | null } }
  | { event: "candidate"; data: { name: string; url: string } }
  | { event: "enrich"; data: { name: string; field: string; status: "ok" | "fail"; [k: string]: unknown } }
  | { event: "result"; data: { operators: Operator[] } }
  | { event: "done"; data: Record<string, never> }
  | { event: "error"; data: { message: string; recoverable: boolean } };
```

- [ ] **Step 2: `web/src/sse.ts`**

```ts
import type { SseEvent } from "./types";

export async function* readSse(resp: Response): AsyncGenerator<SseEvent> {
  if (!resp.body) throw new Error("No body");
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) return;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const evLine = chunk.split("\n").find(l => l.startsWith("event: "));
      const dataLine = chunk.split("\n").find(l => l.startsWith("data: "));
      if (!evLine || !dataLine) continue;
      const event = evLine.slice(7) as SseEvent["event"];
      const data = JSON.parse(dataLine.slice(6));
      yield { event, data } as SseEvent;
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd E:/hack2
git add web/src/types.ts web/src/sse.ts
git commit -m "feat(web): types and sse reader"
```

## Task C3: App state machine

**Files:**
- Create: `E:\hack2\web\src\App.tsx`
- Modify: `E:\hack2\web\src\main.tsx`

- [ ] **Step 1: `web/src/App.tsx`**

```tsx
import { useState } from "preact/hooks";
import { readSse } from "./sse";
import type { Operator, SseEvent } from "./types";
import { QueryForm } from "./components/QueryForm";
import { AgentTrace, type TraceEntry } from "./components/AgentTrace";
import { ResultTable } from "./components/ResultTable";

type Status = "idle" | "running" | "done" | "error";

export function App() {
  const [query, setQuery] = useState("aerospace and space-tech companies in Houston");
  const [status, setStatus] = useState<Status>("idle");
  const [trace, setTrace] = useState<TraceEntry[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setStatus("running");
    setTrace([]);
    setOperators([]);
    setError(null);

    const resp = await fetch("/api/scout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query })
    });
    if (!resp.ok) {
      setError(`HTTP ${resp.status}`);
      setStatus("error");
      return;
    }
    try {
      for await (const ev of readSse(resp)) {
        ingest(ev);
      }
    } catch (err) {
      setError((err as Error).message);
      setStatus("error");
    }
  }

  function ingest(ev: SseEvent) {
    if (ev.event === "result") {
      setOperators(ev.data.operators);
      return;
    }
    if (ev.event === "done") {
      setStatus("done");
      return;
    }
    if (ev.event === "error") {
      setError(ev.data.message);
      setStatus("error");
      return;
    }
    setTrace(t => [...t, { event: ev.event, data: ev.data, ts: Date.now() }]);
  }

  return (
    <div class="min-h-screen bg-slate-50 text-slate-900">
      <header class="border-b border-slate-200 bg-white">
        <div class="mx-auto max-w-6xl px-6 py-5">
          <h1 class="text-2xl font-semibold tracking-tight">LongTail Scout</h1>
          <p class="text-sm text-slate-600">Apollo for the long tail - built on Bright Data, AI/ML API, and your existing infra.</p>
        </div>
      </header>

      <main class="mx-auto max-w-6xl px-6 py-8 space-y-6">
        <QueryForm value={query} onChange={setQuery} onRun={run} disabled={status === "running"} />
        {error && <div class="rounded border border-red-300 bg-red-50 p-4 text-red-800">Error: {error}</div>}
        {(status === "running" || trace.length > 0) && (
          <AgentTrace entries={trace} running={status === "running"} />
        )}
        {operators.length > 0 && (
          <ResultTable operators={operators} />
        )}
      </main>

      <footer class="mx-auto max-w-6xl px-6 py-12 text-xs text-slate-500">
        Built for the Bright Data Web Data UNLOCKED hackathon, May 2026 .
        <a class="underline ml-1" href="https://github.com/dholzrich/longtail-scout" target="_blank">Source</a>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Update `web/src/main.tsx`**

```tsx
import { render } from "preact";
import "./styles.css";
import { App } from "./App";

render(<App />, document.getElementById("app")!);
```

- [ ] **Step 3: Commit**

```bash
cd E:/hack2
git add web/src/App.tsx web/src/main.tsx
git commit -m "feat(web): app state machine and layout"
```

## Task C4: QueryForm

**Files:**
- Create: `E:\hack2\web\src\components\QueryForm.tsx`

- [ ] **Step 1: Write**

```tsx
interface Props {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  disabled: boolean;
}

const PRESETS = [
  "aerospace and space-tech companies in Houston",
  "solar installers in Texas",
  "AI consulting firms in San Francisco"
];

export function QueryForm({ value, onChange, onRun, disabled }: Props) {
  return (
    <div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <label class="block text-sm font-medium text-slate-700 mb-2">Niche x city</label>
      <div class="flex gap-2">
        <input
          class="flex-1 rounded border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
          type="text"
          value={value}
          onInput={(e) => onChange((e.target as HTMLInputElement).value)}
          placeholder="aerospace companies in Houston"
          disabled={disabled}
        />
        <button
          class="rounded bg-slate-900 px-4 py-2 text-white disabled:bg-slate-300"
          onClick={onRun}
          disabled={disabled}
        >
          {disabled ? "Running..." : "Run"}
        </button>
      </div>
      <div class="mt-3 flex flex-wrap gap-2 text-xs">
        {PRESETS.map(p => (
          <button
            class="rounded-full bg-slate-100 px-3 py-1 text-slate-700 hover:bg-slate-200 disabled:opacity-50"
            onClick={() => onChange(p)}
            disabled={disabled}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd E:/hack2
git add web/src/components/QueryForm.tsx
git commit -m "feat(web): query form with presets"
```

## Task C5: AgentTrace

**Files:**
- Create: `E:\hack2\web\src\components\AgentTrace.tsx`

- [ ] **Step 1: Write**

```tsx
import { useEffect, useRef } from "preact/hooks";

export interface TraceEntry {
  event: string;
  data: unknown;
  ts: number;
}

interface Props {
  entries: TraceEntry[];
  running: boolean;
}

function summarize(entry: TraceEntry): string {
  const d = entry.data as Record<string, unknown>;
  switch (entry.event) {
    case "phase": return `>> Phase: ${d.phase}`;
    case "progress": return `. ${d.message}`;
    case "tool": return `-> Tool: ${d.tool}(${JSON.stringify(d.args).slice(0, 80)})`;
    case "candidate": return `+ Candidate: ${d.name}`;
    case "enrich": return `  ${d.status === "ok" ? "[ok]" : "[fail]"} ${d.name} - ${d.field}`;
    default: return `[${entry.event}] ${JSON.stringify(d).slice(0, 100)}`;
  }
}

export function AgentTrace({ entries, running }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [entries.length]);

  return (
    <div class="rounded-lg border border-slate-200 bg-slate-900 text-slate-100 shadow-sm">
      <div class="flex items-center justify-between border-b border-slate-700 px-4 py-2">
        <span class="text-xs font-medium uppercase tracking-wider text-slate-300">
          Agent trace {running && <span class="ml-2 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />}
        </span>
        <span class="text-xs text-slate-400">{entries.length} events</span>
      </div>
      <div ref={ref} class="h-72 overflow-auto px-4 py-2 font-mono text-xs">
        {entries.map((e, i) => (
          <div key={i} class="whitespace-pre-wrap">{summarize(e)}</div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd E:/hack2
git add web/src/components/AgentTrace.tsx
git commit -m "feat(web): live agent trace pane"
```

## Task C6: CitationLink + DrillDown + ResultTable

**Files:**
- Create: `E:\hack2\web\src\components\CitationLink.tsx`
- Create: `E:\hack2\web\src\components\DrillDown.tsx`
- Create: `E:\hack2\web\src\components\ResultTable.tsx`

- [ ] **Step 1: `CitationLink.tsx`**

```tsx
import type { Citation } from "../types";

export function CitationLink({ citations, field }: { citations: Citation[]; field: string }) {
  const match = citations.find(c => c.field === field);
  if (!match) return null;
  return (
    <a class="ml-1 text-slate-400 hover:text-slate-700" href={match.url} target="_blank" title={`source: ${match.tool}`}>
      (i)
    </a>
  );
}
```

- [ ] **Step 2: `DrillDown.tsx`**

```tsx
import type { Operator } from "../types";

export function DrillDown({ op }: { op: Operator }) {
  return (
    <div class="rounded border border-slate-200 bg-slate-50 p-4">
      <h3 class="text-lg font-semibold">{op.name}</h3>
      <p class="text-sm text-slate-600">{op.about ?? "-"}</p>
      <div class="mt-3 grid grid-cols-2 gap-4 text-sm">
        <div>
          <div class="text-xs font-medium uppercase text-slate-500">Hiring</div>
          {op.hiring.source ? (
            <a class="text-blue-700 underline" href={op.hiring.source} target="_blank">
              {op.hiring.count ?? 0} role-signals: {op.hiring.roles.join(", ") || "-"}
            </a>
          ) : <span class="text-slate-400">No signal</span>}
        </div>
        <div>
          <div class="text-xs font-medium uppercase text-slate-500">Demand</div>
          {op.demand_signal ? <span>score {op.demand_signal.score} . nearby {op.demand_signal.nearby_count}</span> : <span class="text-slate-400">-</span>}
        </div>
      </div>
      <div class="mt-3">
        <div class="text-xs font-medium uppercase text-slate-500">Recent activity</div>
        <ul class="mt-1 space-y-1 text-sm">
          {op.recent_activity.length === 0 && <li class="text-slate-400">-</li>}
          {op.recent_activity.map((a, i) => (
            <li key={i}><a class="text-blue-700 underline" href={a.source} target="_blank">{a.headline}</a></li>
          ))}
        </ul>
      </div>
      <div class="mt-3">
        <div class="text-xs font-medium uppercase text-slate-500">Sources used</div>
        <ul class="mt-1 space-y-1 text-xs text-slate-600">
          {op.sources.map((s, i) => (
            <li key={i}>
              <span class="inline-block w-32 text-slate-500">{s.field}</span>
              <a class="text-blue-700 underline" href={s.url} target="_blank">{s.tool}</a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `ResultTable.tsx`**

```tsx
import { useState } from "preact/hooks";
import type { Operator } from "../types";
import { CitationLink } from "./CitationLink";
import { DrillDown } from "./DrillDown";

export function ResultTable({ operators }: { operators: Operator[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div class="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div class="border-b border-slate-200 px-6 py-3">
        <h2 class="text-base font-semibold">Results - {operators.length} operators</h2>
      </div>
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th class="px-4 py-2 text-left">#</th>
            <th class="px-4 py-2 text-left">Operator</th>
            <th class="px-4 py-2 text-left">Size</th>
            <th class="px-4 py-2 text-left">Hiring</th>
            <th class="px-4 py-2 text-left">Sales angle</th>
          </tr>
        </thead>
        <tbody>
          {operators.map(op => (
            <>
              <tr key={op.url} class="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => setOpen(open === op.url ? null : op.url)}>
                <td class="px-4 py-3 align-top text-slate-500">{op.rank}</td>
                <td class="px-4 py-3 align-top">
                  <div class="font-medium">{op.name}</div>
                  <a class="text-xs text-blue-700 underline" href={op.url} target="_blank" onClick={(e) => e.stopPropagation()}>{op.url}</a>
                </td>
                <td class="px-4 py-3 align-top text-slate-700">{op.size_estimate ?? "-"}<CitationLink citations={op.sources} field="about" /></td>
                <td class="px-4 py-3 align-top text-slate-700">
                  {op.hiring.count ? <>{op.hiring.count} roles<CitationLink citations={op.sources} field="hiring" /></> : <span class="text-slate-400">-</span>}
                </td>
                <td class="px-4 py-3 align-top text-slate-800">{op.sales_angle}</td>
              </tr>
              {open === op.url && (
                <tr><td colSpan={5} class="px-4 pb-4"><DrillDown op={op} /></td></tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Smoke test against local Worker**

In one terminal:
```bash
cd worker
pnpm dev
```

In another:
```bash
cd web
pnpm dev
```

Open http://localhost:5173/. Vite proxies `/api` to the local Worker on 8787. Click Run; verify trace + table.

- [ ] **Step 5: Commit**

```bash
cd E:/hack2
git add web/src/components/
git commit -m "feat(web): result table with drill-down and citations"
```

## Task C7: Wire frontend into Worker as static assets

**Files:**
- Create: `E:\hack2\package.json`
- Modify: `E:\hack2\worker\wrangler.toml`
- Modify: `E:\hack2\worker\src\index.ts`
- Delete: `E:\hack2\worker\src\static\index.html`

- [ ] **Step 1: Root `package.json`**

```json
{
  "name": "longtail-scout",
  "private": true,
  "scripts": {
    "build:web": "pnpm -C web build",
    "deploy": "pnpm build:web && pnpm -C worker deploy",
    "dev:worker": "pnpm -C worker dev",
    "dev:web": "pnpm -C web dev"
  }
}
```

- [ ] **Step 2: Enable assets binding in `worker/wrangler.toml`** — remove the `rules = [...]` block (HTML import no longer needed) and add:

```toml
[assets]
directory = "../web/dist"
binding = "ASSETS"
```

- [ ] **Step 3: Update `worker/src/index.ts`** — remove `import indexHtml from "./static/index.html";` and the inline `return new Response(indexHtml, ...)`. Replace the fallback with:

```ts
if (env.ASSETS) return env.ASSETS.fetch(req);
return new Response("Not Found", { status: 404 });
```

- [ ] **Step 4: Delete the obsolete static file**

```bash
rm worker/src/static/index.html
rmdir worker/src/static
```

- [ ] **Step 5: Build and deploy**

```bash
cd E:/hack2
pnpm build:web
pnpm deploy
```

- [ ] **Step 6: Verify**

Open https://longtail-scout.<your-subdomain>.workers.dev/. Verify the Preact UI loads. Run a query end-to-end.

- [ ] **Step 7: Commit**

```bash
git add package.json worker/wrangler.toml worker/src/index.ts
git rm worker/src/static/index.html
git commit -m "feat: serve preact frontend from worker assets binding"
```

## Task C8: Demand snapshot fallback into KV

**Files:**
- Create: `E:\hack2\scripts\snapshot-demand.ts`

- [ ] **Step 1: Write the snapshot script**

```ts
// Pulls demand-signal data for a fixed seed list, writes a wrangler kv:bulk JSON to stdout.
// Usage: pnpm tsx scripts/snapshot-demand.ts > demand-snapshot.json

const BASE = process.env.DEMAND_API_BASE ?? "https://demand.longtailscout.com";

const SEEDS = [
  "aerospace", "avionics", "rocket", "satellite", "drone", "robotics",
  "solar", "wind", "hvac", "plumbing", "roofing", "electrician",
  "childcare", "preschool", "tutoring", "ems", "ambulance", "clinic",
  "machine shop", "fabrication", "welding", "cnc"
];

async function main() {
  const entries: Array<{ key: string; value: string; expiration_ttl: number }> = [];
  for (const s of SEEDS) {
    const url = `${BASE}/api/research?q=${encodeURIComponent(s)}&tlds=com&limit=5`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error("skip", s, res.status);
      continue;
    }
    const data = await res.json();
    entries.push({
      key: `demand_snapshot:${s.toLowerCase()}`,
      value: JSON.stringify(data),
      expiration_ttl: 604800
    });
    console.error("ok", s);
  }
  console.log(JSON.stringify(entries, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Generate the snapshot**

```bash
cd E:/hack2
pnpm -C worker tsx ../scripts/snapshot-demand.ts > demand-snapshot.json
```

Expected: `demand-snapshot.json` populated with ~20 entries.

- [ ] **Step 3: Push to KV**

```bash
cd worker
pnpm wrangler kv:bulk put --binding=CACHE ../demand-snapshot.json
```

Expected: `Success! Uploaded N keys to Workers KV.`

- [ ] **Step 4: Test fallback path** — temporarily disable the CF Tunnel hostname in the dashboard. Run a query that hits a snapshot seed root word (e.g., "aerospace machine shops in Houston"). Verify the demand pane populates from snapshot. Re-enable the tunnel.

- [ ] **Step 5: Commit**

```bash
cd E:/hack2
git add scripts/snapshot-demand.ts
git commit -m "feat(demand): kv snapshot generator for tunnel-outage fallback"
```

## Task C9: Pre-warm cache for demo query

**Files:** none.

- [ ] **Step 1:** Run the demo query 3 times against the deployed Worker to populate KV:

```bash
for i in 1 2 3; do
  curl -s -X POST https://longtail-scout.<your-subdomain>.workers.dev/api/scout \
    -H "Content-Type: application/json" \
    -d '{"query":"aerospace and space-tech companies in Houston"}' > /dev/null
  echo "warm $i done"
done
```

- [ ] **Step 2:** Time a fresh run from a different network (phone tether or VPN):

```bash
time curl -s -X POST https://longtail-scout.<your-subdomain>.workers.dev/api/scout \
  -H "Content-Type: application/json" \
  -d '{"query":"aerospace and space-tech companies in Houston"}' > /tmp/scout-out.txt
```

Expected: under 30s on cache hit. If still >60s, inspect which tool calls aren't caching.

## Task C10: Polished README with integration snippet

**Files:**
- Modify: `E:\hack2\README.md`
- Create: `E:\hack2\worker\.dev.vars.example`

- [ ] **Step 1: Replace `README.md`**

````markdown
# LongTail Scout

**Apollo for the long tail** - an AI agent that finds small, local, niche businesses that Apollo/ZoomInfo/Clay can't see. Type a niche x city query; get a ranked, cited list of operators with hiring signals and a generated sales angle.

Live demo: https://longtailscout.com
Demo video: [link added Day 4]

Built for the **Bright Data "Web Data UNLOCKED" hackathon** (May 2026), Track 1 - GTM Intelligence.

## What it does

```
You type:    "aerospace and space-tech companies in Houston"
You get:     15 ranked operators with hiring, size, recent activity,
             demand score, and a per-row sales angle - every fact cited.
```

## How it uses Bright Data

The agent runs as a 3-phase hybrid pipeline. Bright Data powers every phase.

```ts
// Phase 1 - Discovery (LLM picks SERP queries via tool-use loop)
const serp = await serpSearchCached(query, env.BRIGHTDATA_SERP_ZONE, auth, env.CACHE);

// Phase 2 - Enrichment (deterministic fan-out, parallel)
const homepage = await webUnlockerCached(candidate.url, env.BRIGHTDATA_WEB_UNLOCKER_ZONE, auth, env.CACHE);
const careers  = needsBrowser(careersUrl)
  ? await scrapingBrowserCached(careersUrl, env.BRIGHTDATA_SCRAPER_ZONE, env.BRIGHTDATA_API_KEY, env.CACHE)
  : await webUnlockerCached(careersUrl, env.BRIGHTDATA_WEB_UNLOCKER_ZONE, auth, env.CACHE);

// Phase 3 - Synthesis (LLM ranks + writes sales angles, every fact cited)
```

**Bright Data products used:**
- **SERP API** - discovery + hiring/news queries
- **Web Unlocker** - homepage + careers pages on standard sites
- **Scraping Browser** - JS-heavy ATS pages (Greenhouse, Lever, Workday, Ashby)
- **Web Scraper API** - structured extraction (where applicable)
- **MCP-pattern integration** - tools registered with the LLM via the OpenAI tool-use API, mirroring the surface Bright Data's MCP Server exposes

## Architecture

- **Cloudflare Worker** (TypeScript) - agent pipeline + Server-Sent Events
- **Preact + Tailwind SPA** served via Worker assets binding
- **Cloudflare KV** - caches Bright Data tool results (24h SERP, 7d static pages)
- **Cloudflare Tunnel** - exposes a private 4M-business demand-signal API as `demand.longtailscout.com`
- **AI/ML API** (primary) and **Z.AI GLM** (fallback) - OpenAI-compatible LLM providers
- All LLM access via a single provider-fallback wrapper at `worker/src/llm/client.ts`

See `docs/superpowers/specs/2026-05-27-longtail-scout-design.md` for the full design.

## Run it yourself

```bash
git clone https://github.com/<your-user>/longtail-scout
cd longtail-scout
pnpm -C worker install
pnpm -C web install

# Copy worker/.dev.vars.example to worker/.dev.vars and fill in keys
pnpm -C worker dev          # backend on :8787
pnpm -C web dev             # frontend on :5173 (proxies /api -> :8787)
```

Deploy: `pnpm deploy` from the repo root.

## License

MIT - see [LICENSE](./LICENSE).
````

- [ ] **Step 2: `worker/.dev.vars.example`**

```
AIMLAPI_KEY=
GLM_API_KEY=
BRIGHTDATA_API_KEY=
BRIGHTDATA_SERP_ZONE=
BRIGHTDATA_WEB_UNLOCKER_ZONE=
BRIGHTDATA_SCRAPER_ZONE=
DEMAND_API_BASE=https://demand.longtailscout.com
```

- [ ] **Step 3: Commit**

```bash
cd E:/hack2
git add README.md worker/.dev.vars.example
git commit -m "docs: polished readme with mcp-pattern integration snippet"
```

## Task C11: Bind `longtailscout.com` to the Worker

**Files:**
- Modify: `E:\hack2\worker\wrangler.toml`

- [ ] **Step 1: Append to `wrangler.toml`**

```toml
routes = [
  { pattern = "longtailscout.com", custom_domain = true },
  { pattern = "www.longtailscout.com", custom_domain = true }
]
```

- [ ] **Step 2: Deploy**

```bash
cd worker
pnpm deploy
```

Wrangler may prompt to create the custom domain. Accept. Alternatively use the Cloudflare dashboard: Workers & Pages -> longtail-scout -> Triggers -> Add Custom Domain.

- [ ] **Step 3: Verify** — wait 30-60s for the cert. Open:
```
https://longtailscout.com/
```

Expected: the Preact UI loads. Run the demo query; verify end-to-end.

- [ ] **Step 4: Commit**

```bash
cd E:/hack2
git add worker/wrangler.toml
git commit -m "feat: bind longtailscout.com custom domain"
```

## Task C12: Push to public GitHub repo

**Files:** none.

- [ ] **Step 1:** Create the public repo at https://github.com/new — name `longtail-scout`, no README, no .gitignore (we have them).

- [ ] **Step 2:**

```bash
cd E:/hack2
git remote add origin https://github.com/<your-user>/longtail-scout.git
git push -u origin main
```

- [ ] **Step 3:** Update README clone-URL placeholder with the real URL and push:

```bash
git add README.md
git commit -m "docs: real clone url"
git push
```

## Task C13: Iterate on demo query quality

**Files:**
- Possibly modify: `E:\hack2\worker\src\agent\prompts.ts`
- Possibly modify: `E:\hack2\worker\src\agent\dedupe.ts`

Highest-impact task in Phase C - the demo lives or dies on whether the canonical query reliably surfaces juicy operators. Budget 90+ minutes.

- [ ] **Step 1:** Open https://longtailscout.com/. Run "aerospace and space-tech companies in Houston" twice (warm cache).

- [ ] **Step 2:** Review each row critically:
  - Is this a real long-tail operator (small, hard to find), or a Fortune-500 prime to filter?
  - Is the sales angle specific and evidence-backed, or generic?
  - Is the hiring/news signal real, or noise?

- [ ] **Step 3:** Adjust as needed:
  - Too many big-corp results -> add to `BLOCKED_DOMAINS` in `worker/src/agent/dedupe.ts` (e.g., `boeing.com`, `lockheedmartin.com`, `raytheon.com`, `nasa.gov`).
  - Generic sales angles -> tighten the synthesis system prompt with few-shot examples of a GOOD vs BAD angle.
  - Discovery misses interesting operators -> add seed terms in the discovery system prompt ("for aerospace, also try: avionics, satellite manufacturers, NASA SBIR awardees").
  - Too few results -> loosen the registrable-domain merge if collapsing distinct businesses.

- [ ] **Step 4:** Each iteration: `pnpm deploy`, re-warm cache, re-run. Aim for >= 5 obviously-cool operators reliably.

- [ ] **Step 5: Commit and push**

```bash
cd E:/hack2
git add worker/src/agent/prompts.ts worker/src/agent/dedupe.ts
git commit -m "tune: dial in aerospace-houston demo quality"
git push
```

**End of Phase C.** Demo URL polished and stable. Public repo live.

---

# Phase D — Day 4 (Sat 5/30): submission

## Task D1: 90-second demo video

- [ ] **Step 1:** Open a screen recorder (OBS, Loom, ScreenToGif Pro). Set 1920x1080 canvas. Mic check.
- [ ] **Step 2:** Open https://longtailscout.com in a clean browser window.
- [ ] **Step 3:** Record 3-5 takes following the storyline:
  - 0:00-0:10: Title overlay + voice intro: *"Apollo and ZoomInfo can't see the long tail. We can. This is LongTail Scout."*
  - 0:10-0:25: Type/paste the query, describe what the agent will do.
  - 0:25-0:55: Watch the trace fill, narrate the phases.
  - 0:55-1:20: Result table renders. Click a row. Show drill-down with citations.
  - 1:20-1:30: End card: *"Built on Bright Data MCP-pattern + SERP + Web Scraper + Web Unlocker. Code on GitHub."*
- [ ] **Step 4:** Pick best take. Trim. Export H.264 MP4 1080p.
- [ ] **Step 5:** Upload to YouTube (unlisted). Copy URL.

## Task D2: Cover image

- [ ] **Step 1:** Open Figma or Canva. 1920x1080 (verify aspect on submission page).
- [ ] **Step 2:** Place title "LongTail Scout", tagline "Apollo for the long tail", screenshot of the result table, attribution: "Built on Bright Data + AI/ML API + Cloudflare."
- [ ] **Step 3:** Export PNG.

## Task D3: 5-8 slides

- [ ] **Step 1:** Slide outline:
  1. Title + tagline
  2. Problem (Venn: Apollo's view vs everyone else)
  3. Product (one-line + screenshot)
  4. Architecture diagram from spec §3
  5. Hybrid agent pipeline (3 phases)
  6. Demo screenshot or animated GIF
  7. Why this wins / what's next (CRM export, alerts, multi-city)
  8. Team + thanks
- [ ] **Step 2:** Export PDF or share Google Slides link.

## Task D4: Submit on lablab.ai

- [ ] **Step 1:** Go to https://lablab.ai/event/brightdata-ai-agents-web-data-hackathon. Sign in. Click submission.
- [ ] **Step 2:** Fill the form:
  - Title: **LongTail Scout**
  - Short description: *"Apollo for the long tail. An AI agent that finds small, local, niche operators Apollo can't see - built on Bright Data MCP-pattern + SERP + Web Scraper + Web Unlocker + AI/ML API."* (trim to fit char limit)
  - Long description: paste from README, emphasize Bright Data integration + demand-signal differentiation
  - Tech tags: **Bright Data**, **AI/ML API**, **Cloudflare Workers**, **TypeScript**, **Preact**
  - Category: **GTM Intelligence**
  - Cover image: from D2
  - Video: YouTube URL from D1
  - Slides: PDF or Google Slides URL from D3
  - GitHub: `https://github.com/<your-user>/longtail-scout`
  - Demo URL: `https://longtailscout.com`
- [ ] **Step 3:** Submit.
- [ ] **Step 4:** Verify the public submission page renders correctly.
- [ ] **Step 5: Final empty commit**

```bash
cd E:/hack2
git commit --allow-empty -m "submission: lablab.ai for bright data web data unlocked hackathon"
git push
```

**End of Phase D.** Submitted.

---

## Spec coverage check

| Spec section | Covered by tasks |
|---|---|
| §1 Goals (track 1 win, public demo URL, four+ Bright Data products, fundability) | A1-A10, B1-B15, C1-C12 |
| §1 Non-goals | Enforced by omission |
| §2 Demo storyline | D1 |
| §2 Demo vertical (aerospace Houston) | C13, D1 |
| §3 Architecture | A4 (worker), C1 (web), C7 (assets binding), C11 (custom domain) |
| §3 Stack | A4, B10 (LLM), B3-B6 (BD wrappers), A3 (tunnel), A5 (KV), C1 (frontend) |
| §3 Reuse/rebuild | A3 (demand tunnel reused), no pinchtab/OverlordNG2 touched |
| §4 Hybrid pipeline | B11 (discovery), B12 (enrich), B13 (synthesize) |
| §4 Enriched record schema | B7 (types) |
| §4 Cache strategy | B2, B3-B6, C9 (pre-warm) |
| §4 SSE protocol | B1 (helper), B14 (handler) |
| §4 Conditional Scraping Browser rule | B6 (needsBrowser heuristic) |
| §5 Day 1 / 2 / 3 / 4 deliverables | Phases A / B / C / D respectively |
| §6 Risk: MCP latency | C9 (pre-warm), B2-B6 (caching) |
| §6 Risk: tool 5xx mid-run | B12 (Promise.allSettled) |
| §6 Risk: LLM rate limit | B10 (AI/ML API -> GLM fallback chain) |
| §6 Risk: tunnel outage | C8 (snapshot fallback) |
| §6 Risk: demo query quality | C13 (iterate) |
| §7 Submission checklist | D1-D4 |
| §10 Resolved decisions (name, domain, hostnames) | A3, C11 |

All spec requirements have at least one task.
