import { useEffect, useRef } from "preact/hooks";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Operator } from "../types";

// Default marker icon — Leaflet bundles the icon URLs in a way that breaks under bundlers,
// so we pin them to the CDN copies that match the version we installed.
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
}

export function MapView({ operators }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  // Initialize once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const m = L.map(containerRef.current, { scrollWheelZoom: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(m);
    layerRef.current = L.layerGroup().addTo(m);
    m.setView([39.5, -98.35], 4); // USA centroid as fallback
    mapRef.current = m;
    return () => {
      m.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Re-render pins whenever operators changes
  useEffect(() => {
    if (!mapRef.current || !layerRef.current) return;
    layerRef.current.clearLayers();
    const withGeo = operators.filter(o => o.geo);
    if (withGeo.length === 0) return;

    const bounds = L.latLngBounds([]);
    for (const op of withGeo) {
      const g = op.geo!;
      const m = L.marker([g.lat, g.lng], { icon: defaultIcon, title: op.name });
      const popup = `
        <div style="min-width:220px">
          <div style="font-weight:600;margin-bottom:2px">#${op.rank} ${escapeHtml(op.name)}</div>
          <a href="${escapeAttr(op.url)}" target="_blank" rel="noreferrer" style="color:#1d4ed8;font-size:12px">${escapeHtml(op.url)}</a>
          <div style="margin-top:6px;font-size:12px;color:#475569">${escapeHtml(op.icp_fit_reason)}</div>
          <div style="margin-top:6px;font-size:11px;color:#1e293b;border-top:1px solid #e2e8f0;padding-top:6px">${escapeHtml(op.sales_angle)}</div>
        </div>`;
      m.bindPopup(popup);
      m.addTo(layerRef.current);
      bounds.extend([g.lat, g.lng]);
    }
    if (bounds.isValid()) {
      mapRef.current.fitBounds(bounds.pad(0.2), { maxZoom: 13 });
    }
  }, [operators]);

  const geoCount = operators.filter(o => o.geo).length;

  return (
    <div class="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div class="flex items-center justify-between border-b border-slate-200 px-6 py-3">
        <h2 class="text-base font-semibold">Map — {geoCount} of {operators.length} operators geocoded</h2>
        <span class="text-xs text-slate-500">via local OSM Nominatim · tiles &copy; OpenStreetMap</span>
      </div>
      <div ref={containerRef} style="height:520px;width:100%" />
    </div>
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
