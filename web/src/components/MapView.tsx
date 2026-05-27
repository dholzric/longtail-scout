import { useEffect, useRef, useState } from "preact/hooks";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Operator } from "../types";

const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface Props {
  operators: Operator[];
  query?: string;
}

interface BusinessRecord {
  name: string;
  city: string | null;
  state: string | null;
  lat: number;
  lng: number;
  rating: number | null;
  review_count: number | null;
  website: string | null;
  category: string | null;
}

interface BusinessesResponse {
  query: string;
  city: string | null;
  state: string | null;
  count: number;
  businesses: BusinessRecord[];
  cached?: boolean;
}

function parseQuery(q: string): { niche: string; city: string | null } {
  const m = q.match(/^\s*(.+?)\s+(?:in|near|around|@)\s+(.+?)\s*$/i);
  if (m && m[1] && m[2]) return { niche: m[1].trim(), city: m[2].trim() };
  return { niche: q.trim(), city: null };
}

export function MapView({ operators, query }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pinLayerRef = useRef<L.LayerGroup | null>(null);
  const heatLayerRef = useRef<L.LayerGroup | null>(null);
  const [density, setDensity] = useState<BusinessesResponse | null>(null);
  const [showHeat, setShowHeat] = useState<boolean>(true);
  const [loadingHeat, setLoadingHeat] = useState<boolean>(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const m = L.map(containerRef.current, { scrollWheelZoom: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(m);
    heatLayerRef.current = L.layerGroup().addTo(m);
    pinLayerRef.current = L.layerGroup().addTo(m);
    m.setView([39.5, -98.35], 4);
    mapRef.current = m;
    return () => {
      m.remove();
      mapRef.current = null;
      pinLayerRef.current = null;
      heatLayerRef.current = null;
    };
  }, []);

  // Fetch density data when the query changes
  useEffect(() => {
    if (!query) { setDensity(null); return; }
    const { niche, city } = parseQuery(query);
    if (!niche) { setDensity(null); return; }
    let cancelled = false;
    setLoadingHeat(true);
    const url = new URL("/api/businesses", window.location.origin);
    url.searchParams.set("q", niche);
    if (city) url.searchParams.set("city", city);
    url.searchParams.set("limit", "200");
    fetch(url.toString())
      .then(r => r.ok ? r.json() : null)
      .then((j: BusinessesResponse | null) => {
        if (cancelled) return;
        setDensity(j);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingHeat(false); });
    return () => { cancelled = true; };
  }, [query]);

  // Render the heat underlay
  useEffect(() => {
    if (!mapRef.current || !heatLayerRef.current) return;
    heatLayerRef.current.clearLayers();
    if (!showHeat || !density || density.businesses.length === 0) return;
    const maxReviews = Math.max(...density.businesses.map(b => b.review_count ?? 0), 10);
    for (const b of density.businesses) {
      // Radius scales with review_count (proxy for prominence); 4-14 px.
      const revs = b.review_count ?? 0;
      const radius = 4 + Math.min(10, Math.sqrt(revs / Math.max(1, maxReviews)) * 10);
      const rating = b.rating ?? 0;
      // Color ramp: cool blue (low rating) → warm orange (high rating)
      const color = rating >= 4.5 ? "#f97316" : rating >= 4.0 ? "#eab308" : rating >= 3.5 ? "#84cc16" : "#3b82f6";
      const c = L.circleMarker([b.lat, b.lng], {
        radius,
        color,
        weight: 1,
        opacity: 0.5,
        fillColor: color,
        fillOpacity: 0.18,
        interactive: true
      });
      c.bindTooltip(
        `<div style="font-size:11px;line-height:1.3"><b>${escapeHtml(b.name)}</b>${b.rating ? ` · ${b.rating}★ (${b.review_count ?? 0})` : ""}${b.category ? `<br><span style="color:#64748b">${escapeHtml(b.category)}</span>` : ""}</div>`,
        { direction: "top", sticky: true }
      );
      c.addTo(heatLayerRef.current);
    }
  }, [density, showHeat]);

  // Render operator pins (always rank above the heat underlay)
  useEffect(() => {
    if (!mapRef.current || !pinLayerRef.current) return;
    pinLayerRef.current.clearLayers();
    const withGeo = operators.filter(o => o.geo);

    const bounds = L.latLngBounds([]);
    for (const op of withGeo) {
      const g = op.geo!;
      const m = L.marker([g.lat, g.lng], { icon: defaultIcon, title: op.name, zIndexOffset: 1000 });
      const popup = `
        <div style="min-width:220px">
          <div style="font-weight:600;margin-bottom:2px">#${op.rank} ${escapeHtml(op.name)}</div>
          <a href="${escapeAttr(op.url)}" target="_blank" rel="noreferrer" style="color:#1d4ed8;font-size:12px">${escapeHtml(op.url)}</a>
          <div style="margin-top:6px;font-size:12px;color:#475569">${escapeHtml(op.icp_fit_reason)}</div>
          <div style="margin-top:6px;font-size:11px;color:#1e293b;border-top:1px solid #e2e8f0;padding-top:6px">${escapeHtml(op.sales_angle)}</div>
        </div>`;
      m.bindPopup(popup);
      m.addTo(pinLayerRef.current);
      bounds.extend([g.lat, g.lng]);
    }
    // Extend bounds to include heat-underlay points so we fit both.
    if (density) {
      for (const b of density.businesses) bounds.extend([b.lat, b.lng]);
    }
    if (bounds.isValid()) {
      mapRef.current.fitBounds(bounds.pad(0.2), { maxZoom: 13 });
    }
  }, [operators, density]);

  const geoCount = operators.filter(o => o.geo).length;
  const densityCount = density?.businesses.length ?? 0;

  return (
    <div class="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div class="flex items-center justify-between border-b border-slate-200 px-6 py-3 gap-3 flex-wrap">
        <div class="flex items-baseline gap-3">
          <h2 class="text-base font-semibold">Map</h2>
          <span class="text-xs text-slate-500">{geoCount} of {operators.length} operators geocoded</span>
          {densityCount > 0 && (
            <span class="text-xs text-slate-500">· {densityCount} demand-index points</span>
          )}
          {loadingHeat && <span class="text-xs text-slate-400">loading heat…</span>}
        </div>
        <div class="flex items-center gap-2">
          {densityCount > 0 && (
            <label class="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={showHeat}
                onChange={(e) => setShowHeat((e.target as HTMLInputElement).checked)}
                class="rounded"
              />
              Heat underlay
            </label>
          )}
          <span class="text-xs text-slate-400">tiles &copy; OSM</span>
        </div>
      </div>
      {densityCount > 0 && showHeat && (
        <div class="border-b border-slate-200 bg-slate-50 px-6 py-2 text-xs text-slate-600 flex items-center gap-4 flex-wrap">
          <span class="font-medium text-slate-700">Demand density:</span>
          <LegendDot color="#f97316" label="4.5★+ (high signal)" />
          <LegendDot color="#eab308" label="4.0-4.4★" />
          <LegendDot color="#84cc16" label="3.5-3.9★" />
          <LegendDot color="#3b82f6" label="< 3.5★" />
          <span class="text-slate-400 ml-auto">circle size = review count · pins = LongTail discoveries</span>
        </div>
      )}
      <div ref={containerRef} style="height:520px;width:100%" />
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span class="inline-flex items-center gap-1">
      <span style={`display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};opacity:0.7`} />
      <span>{label}</span>
    </span>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
