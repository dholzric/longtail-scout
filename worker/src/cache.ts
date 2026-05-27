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
