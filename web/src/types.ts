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
  icp_fit_reason: string;
  sales_angle: string;
  rank: number;
  geo: { lat: number; lng: number; display_name?: string } | null;
  memory: { memory_state: "new" | "familiar" | "frequent"; first_seen_ts: number; seen_count: number } | null;
}

export interface CostSnapshot {
  bd_renders: number;
  llm_calls: number;
  llm_input_tokens: number;
  llm_output_tokens: number;
  bd_usd: number;
  llm_usd: number;
  total_usd: number;
}

export type SseEvent =
  | { event: "phase"; data: { phase: "discovery" | "enrichment" | "synthesis" } }
  | { event: "progress"; data: { message: string } }
  | { event: "tool"; data: { tool: string; args: Record<string, unknown>; url: string | null } }
  | { event: "candidate"; data: { name: string; url: string } }
  | { event: "enrich"; data: { name: string; field: string; status: "ok" | "fail"; [k: string]: unknown } }
  | { event: "cost"; data: CostSnapshot & { phase?: string } }
  | { event: "result"; data: { operators: Operator[] } }
  | { event: "done"; data: { cost?: CostSnapshot } }
  | { event: "error"; data: { message: string; recoverable: boolean } };
