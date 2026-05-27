import { cachedFetch } from "../cache";

export interface GeocodeResult {
  lat: number;
  lng: number;
  display_name?: string;
}

/**
 * Geocode a free-text query (e.g. "Bob's Roofing Houston TX") against a local Nominatim instance.
 * Designed for the hackathon user's self-hosted Nominatim at https://nominatim.quiltmap.com (no rate limits).
 *
 * Returns null if no result.
 */
export async function geocode(query: string, base: string, kv?: KVNamespace): Promise<GeocodeResult | null> {
  const fetcher = async (): Promise<GeocodeResult | null> => {
    const url = `${base}/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=0`;
    try {
      const res = await fetch(url, { headers: { "accept": "application/json", "user-agent": "longtail-scout/0.1" } });
      if (!res.ok) return null;
      const data = await res.json() as Array<{ lat: string; lon: string; display_name?: string }>;
      const first = data[0];
      if (!first) return null;
      const lat = Number.parseFloat(first.lat);
      const lng = Number.parseFloat(first.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng, display_name: first.display_name };
    } catch {
      return null;
    }
  };
  if (!kv) return await fetcher();
  return await cachedFetch(kv, "geocode", { query }, { ttlSeconds: 30 * 86400 }, fetcher);
}
