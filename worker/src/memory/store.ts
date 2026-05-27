/**
 * Operator memory store — KV-backed remembered-account index.
 *
 * Records every operator the agent has surfaced across queries. On subsequent runs we can answer:
 *   - "Is this a new operator we've never seen, or a familiar one?"
 *   - "When did we first see it?"
 *   - "How many times has it appeared in our scouts?"
 *
 * The interface is intentionally aligned with what Cognee / Pinecone / a vector DB would expose so we can
 * swap the implementation later without touching the agent code.
 *
 * Storage layout (KV):
 *   memory:op:<sha256 of operator url>  →  { url, name, first_seen_ts, last_seen_ts, seen_count, last_query }
 */
import { cacheKey } from "../cache";

export interface RememberedOperator {
  url: string;
  name: string;
  first_seen_ts: number;
  last_seen_ts: number;
  seen_count: number;
  last_query: string;
}

export interface OperatorMemoryAnnotation {
  memory_state: "new" | "familiar" | "frequent";
  first_seen_ts: number;
  seen_count: number;
}

async function opKey(url: string): Promise<string> {
  return (await cacheKey("memory:op", { url: url.replace(/\/$/, "") })).replace(/^tool:/, "");
}

export async function recordOperator(kv: KVNamespace, url: string, name: string, query: string): Promise<OperatorMemoryAnnotation> {
  const key = await opKey(url);
  const now = Date.now();
  const existing = await kv.get(key, "json") as RememberedOperator | null;
  let record: RememberedOperator;
  if (existing) {
    record = {
      ...existing,
      name: existing.name || name,
      last_seen_ts: now,
      seen_count: existing.seen_count + 1,
      last_query: query
    };
  } else {
    record = { url, name, first_seen_ts: now, last_seen_ts: now, seen_count: 1, last_query: query };
  }
  // 90-day retention
  await kv.put(key, JSON.stringify(record), { expirationTtl: 90 * 86400 });
  const state: OperatorMemoryAnnotation["memory_state"] =
    record.seen_count === 1 ? "new" :
    record.seen_count <= 3 ? "familiar" :
    "frequent";
  return { memory_state: state, first_seen_ts: record.first_seen_ts, seen_count: record.seen_count };
}
