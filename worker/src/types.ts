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
