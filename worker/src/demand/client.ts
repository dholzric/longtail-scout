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

/** Merge the demand-index bearer token into outbound headers when configured. No-op when the
 *  token is unset, so it's safe to ship before the secret exists (the service stays open until
 *  enforcement is turned on). Used by every worker → demand-API call. */
export function demandHeaders(
  token: string | undefined,
  extra: Record<string, string> = {}
): Record<string, string> {
  return token ? { ...extra, authorization: `Bearer ${token}` } : { ...extra };
}

export async function demandLookup(
  query: string,
  apiBase: string,
  kv?: KVNamespace,
  token?: string
): Promise<DemandResponse | null> {
  const url = `${apiBase}/api/research?q=${encodeURIComponent(query)}&tlds=com&limit=5`;
  try {
    const res = await fetch(url, { headers: demandHeaders(token, { "accept": "application/json" }) });
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
