export interface BridgeAuth {
  base: string;
  token?: string;
}

async function bridgeFetch<T>(path: string, body: unknown, auth: BridgeAuth): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (auth.token) headers.authorization = `Bearer ${auth.token}`;
  const res = await fetch(`${auth.base}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    throw new Error(`bridge ${path} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return await res.json() as T;
}

export interface BridgeRenderResult {
  url: string;
  final_url: string;
  status: number;
  html: string;
  title: string | null;
  fetched_at: string;
  duration_ms: number;
}

export async function bridgeRender(
  url: string,
  opts: { waitMs?: number; selector?: string },
  auth: BridgeAuth
): Promise<BridgeRenderResult> {
  return bridgeFetch("/render", { url, ...opts }, auth);
}

export interface BridgeSerpResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

export interface BridgeSerpResponse {
  query: string;
  results: BridgeSerpResult[];
  duration_ms: number;
}

export async function bridgeSerp(
  query: string,
  opts: { num?: number },
  auth: BridgeAuth
): Promise<BridgeSerpResponse> {
  return bridgeFetch("/serp", { query, ...opts }, auth);
}
