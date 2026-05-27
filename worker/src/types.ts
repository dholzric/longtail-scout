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
  /** Short evidence-grounded reason this operator fits the buyer's ICP for the query. */
  icp_fit_reason: string;
  /** Draft outreach angle the SDR can lift, edit, and send. NOT a fact — a starting point. */
  sales_angle: string;
  rank: number;
  /** Optional geocoded location for the map view. */
  geo: { lat: number; lng: number; display_name?: string } | null;
  /** Memory annotation — has this URL been surfaced by prior queries? */
  memory: { memory_state: "new" | "familiar" | "frequent"; first_seen_ts: number; seen_count: number } | null;
  /** 0-100 confidence the agent has in this row — derived from citation count + data depth + domain-match heuristics. NOT the rank. */
  confidence: number;
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
