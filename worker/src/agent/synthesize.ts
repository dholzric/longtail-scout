import type { Env } from "../index";
import type { Operator, ScoutQuery } from "../types";
import { buildSynthesisPrompt } from "./prompts";
import { llmCall } from "../llm/client";
import { demandLookup } from "../demand/client";
import { recordOperator } from "../memory/store";
import { computeConfidence } from "./confidence";
import type { SseEmitter } from "../stream";
import type { CostTally } from "../cost";

type EnrichmentInput = Omit<Operator, "rank" | "sales_angle" | "icp_fit_reason" | "memory" | "confidence">;

export async function synthesize(q: ScoutQuery, enriched: EnrichmentInput[], env: Env, emit: SseEmitter, tally?: CostTally): Promise<Operator[]> {
  await emit.emit("phase", { phase: "synthesis" });

  // Niche-level demand context — one lookup against the ~7M-business demand index for the *niche keyword* the user typed.
  // This is the correct interpretation of the demand API; per-operator brandability scores were misleading.
  let nicheDemand: { count: number; rank_signal: number | null } | null = null;
  try {
    // Use just the niche (first 1-2 words) for the lookup
    const nicheKey = q.niche.replace(/\b(companies|firms|operators|businesses|in|the|a|an)\b/gi, "").trim().split(/\s+/).slice(0, 2).join(" ") || q.niche;
    const d = await demandLookup(nicheKey, env.DEMAND_API_BASE, env.CACHE);
    if (d) {
      nicheDemand = { count: d.demand, rank_signal: d.results[0]?.score_components?.demand ?? null };
      await emit.emit("progress", { message: `Niche "${nicheKey}" has ${d.demand} matching businesses in the demand index.` });
    }
  } catch (err) {
    await emit.emit("progress", { message: `Demand lookup failed (continuing): ${(err as Error).message.slice(0, 100)}` });
  }

  const { system, user } = buildSynthesisPrompt(q, enriched, nicheDemand);
  const { response, provider } = await llmCall(env, {
    system,
    messages: [{ role: "user", content: user }],
    responseFormat: "json_object"
  });
  if (tally) {
    tally.llm_calls += 1;
    tally.llm_input_tokens += response.usage?.prompt_tokens ?? 0;
    tally.llm_output_tokens += response.usage?.completion_tokens ?? 0;
  }
  await emit.emit("progress", { message: `Synthesis via ${provider}` });

  const text = response.choices[0]?.message.content ?? "";
  let jsonStr = text.trim();
  const fenceRe = /```(?:json)?\s*([\s\S]*?)```/;
  const fenceMatch = fenceRe.exec(jsonStr);
  if (fenceMatch) jsonStr = (fenceMatch[1] ?? "").trim();

  let parsed: { operators: Array<{ name: string; url: string; rank: number; icp_fit_reason?: string; sales_angle: string }> };
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    throw new Error(`Synthesis JSON parse failed: ${(err as Error).message}\nRaw: ${jsonStr.slice(0, 500)}`);
  }

  const byName = new Map(enriched.map(e => [e.name, e]));
  const operators: Operator[] = parsed.operators.map(o => {
    const base = byName.get(o.name);
    const icp_fit_reason = (o.icp_fit_reason ?? "").trim() || "Long-tail operator, web-first";
    if (!base) {
      const stub: Operator = {
        name: o.name,
        url: o.url,
        sources: [],
        about: null,
        size_estimate: null,
        hiring: { count: null, roles: [], source: null },
        recent_activity: [],
        demand_signal: null,
        icp_fit_reason,
        sales_angle: o.sales_angle,
        rank: o.rank,
        geo: null,
        memory: null,
        confidence: 0
      };
      stub.confidence = computeConfidence(stub);
      return stub;
    }
    const op: Operator = { ...base, icp_fit_reason, sales_angle: o.sales_angle, rank: o.rank, memory: null, confidence: 0 };
    op.confidence = computeConfidence(op);
    return op;
  });

  // Geo via overlord/demand-index match — PRIMARY source. Our 7M-record scraper DB has exact
  // lat/lng per business name; that beats Nominatim's POI database (which only has ~1 in 6
  // Houston roofers indexed). Run for ALL operators and prefer overlord whenever it matches —
  // if it doesn't, keep whatever Nominatim resolved in enrich.
  const opsNeedingGeo = operators; // run for all — overlord match beats Nominatim when available
  if (opsNeedingGeo.length > 0) {
    try {
      const upstream = new URL("/api/businesses", env.DEMAND_API_BASE);
      const nicheKey = q.niche.replace(/\b(companies|firms|operators|businesses|in|the|a|an)\b/gi, "").trim().split(/\s+/).slice(0, 3).join(" ") || q.niche;
      upstream.searchParams.set("q", nicheKey);
      if (q.city) upstream.searchParams.set("city", q.city);
      upstream.searchParams.set("limit", "1000"); // pull full niche+city slice so name match has the most options
      const r = await fetch(upstream.toString(), { headers: { "user-agent": "longtailscout-worker/1.0" } });
      if (r.ok) {
        const data = await r.json() as { businesses?: Array<{ name?: string; website?: string; lat?: number; lng?: number; address?: string }> };
        const normalizedNiche = nicheKey.toLowerCase();
        const normalizeName = (s: string): string => s
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ")
          .replace(new RegExp(`\\b(${normalizedNiche}|llc|inc|corp|co|services?|company|contractors?)\\b`, "g"), "")
          .replace(/\s+/g, " ")
          .trim();
        const byName = new Map<string, { lat: number; lng: number; display_name?: string }>();
        const byHost = new Map<string, { lat: number; lng: number; display_name?: string }>();
        for (const b of (data.businesses ?? [])) {
          if (typeof b.lat !== "number" || typeof b.lng !== "number" || !b.name) continue;
          const display = `${b.name}${b.address ? " · " + b.address : ""}`;
          const key = normalizeName(b.name);
          if (key && !byName.has(key)) byName.set(key, { lat: b.lat, lng: b.lng, display_name: display });
          // Also index by hostname when website looks like a real homepage (not a Google booking redirect)
          if (b.website && !/servicetitan|book\.|rwg_token/i.test(b.website)) {
            try {
              const host = new URL(b.website).hostname.replace(/^www\./, "").toLowerCase();
              if (host && !byHost.has(host)) byHost.set(host, { lat: b.lat, lng: b.lng, display_name: display });
            } catch { /* skip */ }
          }
        }
        let matched = 0;
        for (const op of opsNeedingGeo) {
          // 1. Try hostname match first (most precise when available)
          let hit: { lat: number; lng: number; display_name?: string } | undefined;
          try {
            const host = new URL(op.url).hostname.replace(/^www\./, "").toLowerCase();
            hit = byHost.get(host);
          } catch { /* skip malformed url */ }
          // 2. Fall back to fuzzy name match (normalized exact)
          if (!hit) {
            const opKey = normalizeName(op.name);
            if (opKey) {
              hit = byName.get(opKey);
              if (!hit) {
                // Try prefix match: operator name starts with a known business name (or vice versa)
                for (const [k, v] of byName.entries()) {
                  if (k.length >= 4 && (opKey.startsWith(k) || k.startsWith(opKey))) { hit = v; break; }
                }
              }
            }
          }
          if (hit) {
            op.geo = hit;
            op.sources.push({ field: "geo", tool: "demand_index_match", url: `${env.DEMAND_API_BASE}/api/businesses?q=${encodeURIComponent(nicheKey)}` });
            matched++;
          }
        }
        if (matched > 0) await emit.emit("progress", { message: `Geo fallback: matched ${matched}/${opsNeedingGeo.length} operators to demand-index lat/lng (hostname + name).` });
      }
    } catch (err) {
      await emit.emit("progress", { message: `Demand-index geo fallback failed: ${(err as Error).message.slice(0, 80)}` });
    }
  }

  // Record each operator in the memory store + annotate with seen-count/new-vs-familiar.
  // 1 KV read + 1 KV write per operator. Cheap; runs after synthesis (post-rank).
  for (const op of operators) {
    try {
      const m = await recordOperator(env.CACHE, op.url, op.name, q.raw);
      op.memory = m;
    } catch (err) {
      // Memory is best-effort; failure should not break the response.
      await emit.emit("progress", { message: `memory annotation failed for ${op.name}: ${(err as Error).message.slice(0, 80)}` });
    }
  }

  operators.sort((a, b) => a.rank - b.rank);
  return operators;
}
