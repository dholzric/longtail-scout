import { useEffect, useRef, useState } from "preact/hooks";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Operator } from "../types";
import { SectionHeader } from "./SectionHeader";

/** Numbered black-box pin matching the design language. Stem + dot footprint.
 *  `viaIndex` = true means this operator's geo came from the demand-index match (its lat/lng
 *  was inherited from a business in our 7M-record corpus, so the pin sits on top of a heat
 *  circle). Renders a small moss-green ring on the pin box so users can see at a glance which
 *  operators are "anchored to the index" vs Nominatim-geocoded. */
function numberedPinIcon(rank: number, viaIndex: boolean): L.DivIcon {
  const badge = viaIndex
    ? `<div class="lts-pin-badge" title="position derived from demand-index match"></div>`
    : "";
  return L.divIcon({
    className: "lts-pin",
    html: `<div class="lts-pin-box">${rank}${badge}</div><div class="lts-pin-stem"></div>`,
    iconSize: [26, 40],
    iconAnchor: [13, 40],
    popupAnchor: [0, -40],
  });
}

/** Detect whether an operator's geo came from the demand-index match fallback (synthesize.ts
 *  pushes a citation with tool="demand_index_match" when it overrides Nominatim's answer). */
function isGeoFromDemandIndex(op: Operator): boolean {
  return op.sources.some(s => s.field === "geo" && s.tool === "demand_index_match");
}

interface Props {
  operators: Operator[];
  query?: string;
  /** Demo password from App state. Required since /api/businesses is gated. */
  demoKey?: string;
  /** Compact mode — smaller height, simpler header, no heat-underlay legend, no SectionHeader.
   * Used as an always-visible live preview above the result table during streaming. */
  compact?: boolean;
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

export function MapView({ operators, query, demoKey, compact }: Props) {
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
    if (!demoKey) { setDensity(null); return; } // can't auth → skip the underlay
    const { niche, city } = parseQuery(query);
    if (!niche) { setDensity(null); return; }
    let cancelled = false;
    setLoadingHeat(true);
    const url = new URL("/api/businesses", window.location.origin);
    url.searchParams.set("q", niche);
    if (city) url.searchParams.set("city", city);
    url.searchParams.set("limit", "200");
    fetch(url.toString(), {
      headers: { authorization: `Bearer ${demoKey}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then((j: BusinessesResponse | null) => {
        if (cancelled) return;
        setDensity(j);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingHeat(false); });
    return () => { cancelled = true; };
  }, [query, demoKey]);

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
      // Color ramp keyed to the editorial palette: rust → ochre → moss → sky-dk
      const cs = getComputedStyle(document.documentElement);
      const color =
        rating >= 4.5 ? cs.getPropertyValue("--rust").trim() :
        rating >= 4.0 ? cs.getPropertyValue("--ochre").trim() :
        rating >= 3.5 ? cs.getPropertyValue("--moss").trim() :
        cs.getPropertyValue("--sky-dk").trim();
      // Circles deliberately faint — they're context, not the operators themselves. Pins should
      // dominate the visual hierarchy. Was 0.5 stroke / 0.18 fill; dropped to 0.28 / 0.09 after
      // a user reported confusing them with operator markers.
      const c = L.circleMarker([b.lat, b.lng], {
        radius,
        color,
        weight: 1,
        opacity: 0.28,
        fillColor: color,
        fillOpacity: 0.09,
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
      const viaIndex = isGeoFromDemandIndex(op);
      const m = L.marker([g.lat, g.lng], { icon: numberedPinIcon(op.rank, viaIndex), title: op.name, zIndexOffset: 1000 });
      const popup = `
        <div style="min-width:240px;font-family:var(--font-sans)">
          <div style="font-family:var(--font-serif);font-weight:600;font-size:14px;color:var(--ink);margin-bottom:2px">#${op.rank} · ${escapeHtml(op.name)}</div>
          <a href="${escapeAttr(op.url)}" target="_blank" rel="noreferrer" style="color:var(--ink-60);font-size:11px;font-family:var(--font-mono);text-decoration:none;border-bottom:1px dotted var(--ink-30)">${escapeHtml(op.url)}</a>
          ${viaIndex ? `<div style="margin-top:6px;font-family:var(--font-mono);font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:var(--moss-dk)">📍 geo via demand-index match</div>` : ""}
          <div style="margin-top:8px;font-size:12px;color:var(--ink-70)">${escapeHtml(op.icp_fit_reason)}</div>
          <div style="margin-top:8px;padding-top:6px;border-top:1px solid var(--ink-15);font-size:11px;color:var(--ink-80);font-style:italic">"${escapeHtml(op.sales_angle)}"</div>
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

  // Compact mode — minimal chrome; used as a streaming preview above the table during scout runs.
  if (compact) {
    return (
      <div class="border border-ink-20 bg-paper overflow-hidden">
        <div class="border-b border-ink-15 bg-paper-2 px-4 py-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-ink-60">
          <span class="inline-flex items-center gap-2">
            <span class="inline-block w-1.5 h-1.5 rounded-full bg-moss animate-pulse" />
            live pins · {geoCount}/{operators.length}
            {densityCount > 0 && <span class="text-ink-50">· {densityCount} demand pts</span>}
          </span>
          <span class="text-ink-40">switch to full map view for legend + density toggle</span>
        </div>
        <div ref={containerRef} style="height:240px;width:100%" />
      </div>
    );
  }

  return (
    <section>
      <SectionHeader
        number="05"
        kicker="on the map"
        title="Operators pinned · demand density underneath."
        lede="Numbered pins are the operators we surfaced; circles are the demand-index businesses they live among. Rating drives color; review count drives size."
        action={
          <div class="flex items-center gap-3 font-mono text-[11px] text-ink-60">
            <span>{geoCount}/{operators.length} geocoded</span>
            {densityCount > 0 && <><span class="text-ink-30">·</span><span>{densityCount} index pts</span></>}
            {densityCount > 0 && (
              <label class="inline-flex items-center gap-1.5 text-ink-70 cursor-pointer ml-2">
                <input
                  type="checkbox"
                  checked={showHeat}
                  onChange={(e) => setShowHeat((e.target as HTMLInputElement).checked)}
                />
                heat
              </label>
            )}
            {loadingHeat && <span class="text-ink-40 animate-pulse">loading…</span>}
          </div>
        }
      />

      <div class="border border-ink-20 bg-paper overflow-hidden">
        {densityCount > 0 && showHeat && (
          <div class="border-b border-ink-15 bg-paper-2 px-5 py-2 font-mono text-[11px] text-ink-60 flex items-center gap-4 flex-wrap">
            <span class="uppercase tracking-[0.14em] text-ink-50">pins = operators · circles = demand-index density:</span>
            <LegendDot color="var(--rust)" label="4.5★+ high signal" />
            <LegendDot color="var(--ochre)" label="4.0-4.4★" />
            <LegendDot color="var(--moss)" label="3.5-3.9★" />
            <LegendDot color="var(--sky-dk)" label="< 3.5★" />
            <span class="inline-flex items-center gap-1.5">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--moss-bright);border:1.5px solid var(--paper);box-shadow:0 0 0 1px var(--moss-dk)"></span>
              <span class="text-ink-70">on-pin dot = position via demand-index match</span>
            </span>
            <span class="text-ink-40 ml-auto">size = review count · pins = LongTail discoveries</span>
          </div>
        )}
        <div ref={containerRef} style="height:560px;width:100%" />
      </div>
    </section>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span class="inline-flex items-center gap-1.5">
      <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: color, opacity: 0.75 }} />
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
