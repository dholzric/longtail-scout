// Results table, map, and operator drill-down

// ─── Mini sparkline-style confidence bar ─────────────────────────────────────
const ConfidenceBar = ({ value }) => {
  const ticks = 20;
  const filled = Math.round((value / 100) * ticks);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <div style={{ display: "flex", gap: 1.5 }}>
        {Array.from({ length: ticks }).map((_, i) => (
          <div key={i} style={{
            width: 3, height: 14,
            background: i < filled
              ? (value >= 80 ? "var(--moss)" : value >= 60 ? "var(--ochre-dk)" : "var(--rust)")
              : "var(--ink-10)",
          }} />
        ))}
      </div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-70)", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{value}</span>
    </div>
  );
};

// ─── Results section ─────────────────────────────────────────────────────────
const ResultsSection = ({ ops, onPick, picked }) => {
  return (
    <section style={{ maxWidth: 1320, margin: "0 auto", padding: "56px 32px 24px" }}>
      <SectionHeader number="04" kicker="operators, ranked"
        title="Eight specimens. Each citation-linked."
        lede="Rank = fit for query. Confidence = how much we trust the row, derived from citation count + data depth + hostname-name match. Click any row to open the field card."
        action={
          <div style={{ display: "flex", gap: 8, fontFamily: "var(--font-mono)", fontSize: 11 }}>
            <button style={btnGhost}>copy CSV</button>
            <button style={btnInk}>export CSV <Ic.arrow s={10} /></button>
          </div>
        }
      />

      {/* Filter strip */}
      <div style={{ display: "flex", alignItems: "center", gap: 22, marginBottom: 16, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-70)", flexWrap: "wrap" }}>
        <span style={{ textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--ink-50)" }}>filters:</span>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span>min conf</span>
          <input type="range" min={0} max={100} defaultValue={60} style={{ width: 80 }} />
          <span style={{ width: 24, textAlign: "right", color: "var(--ink)" }}>60</span>
        </label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" defaultChecked /><span>hiring only</span>
        </label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" defaultChecked /><span>long-tail (≤50 emp)</span>
        </label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" /><span>apollo-thin only</span>
        </label>
        <span style={{ flex: 1 }} />
        <span style={{ color: "var(--ink-50)" }}>showing all {ops.length} of {ops.length}</span>
      </div>

      {/* Table */}
      <div style={{ border: "1px solid var(--ink-20)", background: "var(--paper)" }}>
        {/* header row */}
        <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 200px 140px 1.2fr 80px", gap: 0, padding: "10px 0", borderBottom: "1px solid var(--ink-20)", background: "var(--paper-2)", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--ink-50)" }}>
          <div style={{ padding: "0 16px" }}>#</div>
          <div>operator · domain</div>
          <div>confidence</div>
          <div>hiring</div>
          <div>icp fit & sales angle</div>
          <div style={{ padding: "0 16px", textAlign: "right" }}>cites</div>
        </div>

        {ops.map((o, i) => {
          const isOpen = picked === o.url;
          return (
            <div key={o.url}>
              <div onClick={() => onPick(isOpen ? null : o.url)} style={{
                display: "grid", gridTemplateColumns: "60px 1fr 200px 140px 1.2fr 80px",
                gap: 0, padding: "16px 0", borderBottom: "1px solid var(--ink-10)",
                background: isOpen ? "var(--paper-3)" : "transparent",
                cursor: "pointer", transition: "background .12s",
                alignItems: "flex-start",
              }}
              onMouseEnter={(e) => !isOpen && (e.currentTarget.style.background = "var(--paper-2)")}
              onMouseLeave={(e) => !isOpen && (e.currentTarget.style.background = "transparent")}>
                {/* rank */}
                <div style={{ padding: "0 16px" }}>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.02em" }}>{String(o.rank).padStart(2, "0")}</div>
                  <div style={{ marginTop: 4 }}><MemoryDot state={o.memory.state} /></div>
                </div>

                {/* name + domain */}
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--font-serif)", fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{o.name}</span>
                    {o.apolloThin && <Chip tone="rust">apollo-thin</Chip>}
                    {o.memory.state === "new" && <Chip tone="ochre">new to index</Chip>}
                    {o.memory.cross_niche && <Chip tone="sky">cross-niche</Chip>}
                  </div>
                  <a href={`https://${o.domain}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--rust)", textDecoration: "none", borderBottom: "1px dotted var(--rust)" }}>
                    {o.domain}<Ic.link s={10} />
                  </a>
                  <div style={{ marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-50)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {o.size_estimate} emp · {o.neighborhood} · est. {o.founded}
                  </div>
                </div>

                {/* confidence */}
                <div><ConfidenceBar value={o.confidence} /></div>

                {/* hiring */}
                <div>
                  {o.hiring.count > 0 ? (
                    <div>
                      <div style={{ fontFamily: "var(--font-serif)", fontSize: 17, fontWeight: 600, color: "var(--moss-dk)" }}>{o.hiring.count} roles</div>
                      <div style={{ fontSize: 11, color: "var(--ink-60)", marginTop: 3, lineHeight: 1.3 }}>
                        {o.hiring.roles.slice(0, 2).join(", ")}{o.hiring.roles.length > 2 ? `, +${o.hiring.roles.length - 2}` : ""}
                      </div>
                      {o.hiring.ats && <div style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-40)", textTransform: "uppercase", letterSpacing: "0.1em" }}>via {o.hiring.ats}</div>}
                    </div>
                  ) : (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-30)" }}>— none</span>
                  )}
                </div>

                {/* icp / sales angle */}
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--ink-50)", marginBottom: 2 }}>icp fit</div>
                  <div style={{ fontSize: 13, color: "var(--ink-80)", lineHeight: 1.45 }}>{o.icp_fit_reason}</div>
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed var(--ink-15)" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--rust)", marginBottom: 2 }}>draft outreach</div>
                    <div style={{ fontSize: 13, fontStyle: "italic", color: "var(--ink-70)", lineHeight: 1.45, fontFamily: "var(--font-serif)" }}>“{o.sales_angle}”</div>
                  </div>
                </div>

                {/* cites */}
                <div style={{ padding: "0 16px", textAlign: "right" }}>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600, color: "var(--rust)", letterSpacing: "-0.02em" }}>{o.sources.length}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-50)" }}>fetches</div>
                </div>
              </div>

              {isOpen && <DrillDown op={o} />}
            </div>
          );
        })}
      </div>
    </section>
  );
};

// ─── Operator drill-down card ────────────────────────────────────────────────
const DrillDown = ({ op }) => {
  return (
    <div style={{ background: "var(--paper-3)", borderBottom: "1px solid var(--ink-10)", padding: "28px 32px" }}>
      {/* Specimen header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", borderBottom: "1px solid var(--ink-15)", paddingBottom: 14, marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--ink-50)" }}>
            § specimen no. {String(op.rank).padStart(2, "0")} · field card
          </div>
          <h3 style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 30, letterSpacing: "-0.02em", margin: "6px 0 0", color: "var(--ink)" }}>
            {op.name}
          </h3>
          <div style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-50)" }}>
            {op.domain} · {op.neighborhood}, {op.city} · est. {op.founded} · {op.size_estimate} emp
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btnGhost}><Ic.copy s={10} /> share link</button>
          <button style={btnInk}>open homepage <Ic.arrow s={10} /></button>
        </div>
      </div>

      {/* Body grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 28 }}>
        {/* Left: prose + signals */}
        <div>
          <p style={{ margin: 0, fontFamily: "var(--font-serif)", fontSize: 16, lineHeight: 1.6, color: "var(--ink-80)", textWrap: "pretty" }}>
            {op.about}<Cite n={1} title={op.sources[0]?.tool} />
          </p>

          {/* Hiring callout (the killer differentiator) */}
          {op.hiring.count > 0 && (
            <div style={{ marginTop: 22, border: "1px solid var(--moss-dk)", background: "color-mix(in oklab, var(--moss-tint) 80%, var(--paper))", padding: 18, position: "relative" }}>
              <div style={{ position: "absolute", top: -10, left: 16, background: "var(--paper-3)", padding: "0 8px", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--moss-dk)" }}>
                hiring signal · trigger event
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 12 }}>
                <span style={{ fontFamily: "var(--font-serif)", fontSize: 44, fontWeight: 600, color: "var(--moss-dk)", letterSpacing: "-0.03em", lineHeight: 1 }}>{op.hiring.count}</span>
                <span style={{ fontSize: 13, color: "var(--ink-70)", lineHeight: 1.4 }}>open roles{op.hiring.ats ? ` — scraped from ${op.hiring.ats} via Bright Data Scraping Browser` : ""}.<Cite n={2} title={`Source: ${op.hiring.source}`} /></span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {op.hiring.roles.map((r) => (
                  <span key={r} style={{ background: "var(--paper)", border: "1px solid var(--moss)", padding: "5px 10px", fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--moss-dk)", whiteSpace: "nowrap" }}>
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ICP fit + sales angle */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 20 }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--ink-50)", marginBottom: 6 }}>icp fit reason</div>
              <p style={{ margin: 0, fontSize: 14, color: "var(--ink-80)", lineHeight: 1.5 }}>{op.icp_fit_reason}</p>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--rust)", marginBottom: 6 }}>draft outreach angle</div>
              <p style={{ margin: 0, fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 14, color: "var(--ink-80)", lineHeight: 1.5 }}>“{op.sales_angle}”</p>
            </div>
          </div>

          {/* Recent activity */}
          {op.recent_activity.length > 0 && (
            <div style={{ marginTop: 22 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--ink-50)", marginBottom: 8 }}>recent activity</div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", borderTop: "1px solid var(--ink-15)" }}>
                {op.recent_activity.map((a, i) => (
                  <li key={i} style={{ display: "flex", gap: 14, padding: "10px 0", borderBottom: "1px solid var(--ink-15)" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-50)", width: 76, flexShrink: 0 }}>{a.date}</span>
                    <a href={`https://${a.source}`} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: 13, color: "var(--ink-80)", textDecoration: "none", borderBottom: "1px dotted var(--ink-30)", lineHeight: 1.45 }}>{a.headline}</a>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-40)", flexShrink: 0 }}>{new URL(`https://${a.source}`).hostname.replace(/^www\./, "")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right: outreach kit + sources */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Outreach draft card */}
          <div style={{ border: "1px solid var(--ink-20)", background: "var(--paper)", overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--ink-15)", display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--ink-60)" }}>
              <span>outreach draft · DeepSeek</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--moss-dk)" }}>
                <Ic.sparkle s={11} /> ai-personalized · $0.00018
              </span>
            </div>
            <div style={{ padding: 16, fontSize: 13, lineHeight: 1.55 }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 10, paddingBottom: 8, borderBottom: "1px dashed var(--ink-15)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-50)", textTransform: "uppercase", letterSpacing: "0.12em" }}>subj</span>
                <span style={{ fontWeight: 600, color: "var(--ink)" }}>Quick question for {op.name}</span>
              </div>
              <div style={{ color: "var(--ink-80)", fontFamily: "var(--font-serif)", fontSize: 14 }}>
                <p style={{ margin: "0 0 10px" }}>Hi {op.name} team,</p>
                <p style={{ margin: "0 0 10px" }}>{op.sales_angle}</p>
                {op.hiring.count > 0 && (
                  <p style={{ margin: "0 0 10px" }}>
                    Noticed you're hiring {op.hiring.roles.slice(0, 2).join(" + ")} right now — feels like a moment where this would compound.
                  </p>
                )}
                <p style={{ margin: "0 0 10px" }}>Worth a 15-minute call this week?</p>
                <p style={{ margin: 0, color: "var(--ink-50)" }}>— Your name</p>
              </div>
            </div>
            <div style={{ padding: "10px 14px", borderTop: "1px solid var(--ink-15)", display: "flex", gap: 8, background: "var(--paper-2)" }}>
              <button style={btnGhostSm}><Ic.sparkle s={10}/> regenerate</button>
              <button style={btnGhostSm}><Ic.copy s={10}/> subject</button>
              <button style={btnGhostSm}><Ic.copy s={10}/> body</button>
              <span style={{ flex: 1 }} />
              <button style={btnInkSm}>open in mail <Ic.arrow s={10}/></button>
            </div>
          </div>

          {/* Citations */}
          <div style={{ border: "1px solid var(--ink-20)", background: "var(--paper)" }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--ink-15)", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--ink-60)" }}>
              footnotes · {op.sources.length} bright data fetches
            </div>
            <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {op.sources.map((s, i) => (
                <li key={i} style={{ display: "flex", gap: 12, padding: "9px 14px", borderTop: i ? "1px solid var(--ink-10)" : 0, fontSize: 12 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--rust)", width: 14, fontSize: 11 }}>{i + 1}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-50)", textTransform: "uppercase", letterSpacing: "0.08em", width: 100, flexShrink: 0 }}>{s.field}</span>
                  <span style={{ flex: 1, color: "var(--ink-70)", fontFamily: "var(--font-mono)", fontSize: 11 }}>{s.tool}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Memory */}
          <div style={{ border: "1px solid var(--ink-20)", background: "var(--paper)", padding: 14 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--ink-50)", marginBottom: 8 }}>index memory</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.02em" }}>×{op.memory.seen}</span>
              <span style={{ fontSize: 13, color: "var(--ink-60)" }}>
                {op.memory.state === "new" && "first time in any LongTail Scout query"}
                {op.memory.state === "familiar" && "seen across prior queries"}
                {op.memory.state === "frequent" && "frequently surfaced — durable signal"}
              </span>
            </div>
            {op.memory.cross_niche && (
              <div style={{ marginTop: 10, fontSize: 12, color: "var(--ink-60)" }}>
                Also surfaced under:
                {op.memory.cross_niche.map(n => (
                  <span key={n} style={{ marginLeft: 6 }}><Chip tone="sky">{n}</Chip></span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Map section (Leaflet + OpenStreetMap, styled to match the field-manual aesthetic) ──
const MapSection = ({ ops, heatPoints }) => {
  const mapRef = React.useRef(null);
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    if (!window.L || !containerRef.current || mapRef.current) return;
    const L = window.L;
    const map = L.map(containerRef.current, {
      zoomControl: false,
      scrollWheelZoom: false,
    }).setView([29.76, -95.36], 10);
    mapRef.current = map;

    L.control.zoom({ position: "topright" }).addTo(map);

    // CartoDB Positron — light, muted, paper-friendly tiles
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> · © <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
      className: "lts-tile-layer",
    }).addTo(map);

    // Heat-index circle markers
    heatPoints.forEach(([lat, lng, count, rating]) => {
      const r = 5 + count * 0.45;
      const fill = rating >= 4.5 ? "#3E6B2C" : rating >= 4.2 ? "#C68A2E" : "#A8351F";
      L.circleMarker([lat, lng], {
        radius: r,
        fillColor: fill, fillOpacity: 0.22,
        color: fill, opacity: 0.55, weight: 0.8,
      }).bindTooltip(`${count} reviews · ${rating.toFixed(1)}★`, { direction: "top", offset: [0, -4] }).addTo(map);
    });

    // Operator pins — numbered black square with stem (HTML divIcon)
    ops.forEach((o) => {
      const icon = L.divIcon({
        className: "lts-pin",
        html: `<div class="lts-pin-box">${o.rank}</div><div class="lts-pin-stem"></div>`,
        iconSize: [26, 36],
        iconAnchor: [13, 36],
      });
      L.marker([o.geo.lat, o.geo.lng], { icon })
        .bindTooltip(
          `<div style="font-family:Fraunces,serif;font-weight:600;font-size:13px;color:#1A1814">${o.name}</div>` +
          `<div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#857E73">${o.domain}</div>`,
          { direction: "top", offset: [0, -32] }
        ).addTo(map);
    });

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  return (
    <section style={{ background: "var(--paper-2)", borderTop: "1px solid var(--ink-15)" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "56px 32px" }}>
        <SectionHeader number="05" kicker="on the map"
          title="The long tail is geographic."
          lede="Operator pins overlay the 7M-record demand index. Heat-circles show every roofing business in our index near Houston; radius encodes review count, fill encodes average rating."
        />

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 280px", gap: 24 }}>
          {/* Leaflet map */}
          <div style={{ position: "relative", border: "1px solid var(--ink-20)", overflow: "hidden", height: 540, background: "var(--paper)" }}>
            <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
            <div style={{ position: "absolute", top: 12, left: 14, zIndex: 500, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-60)", letterSpacing: "0.16em", textTransform: "uppercase", background: "color-mix(in oklab, var(--paper) 88%, transparent)", padding: "4px 8px", border: "1px solid var(--ink-15)", pointerEvents: "none" }}>
              Houston Metro · 29.76°N 95.36°W
            </div>
          </div>

          {/* Map legend / sidebar */}
          <aside style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ border: "1px solid var(--ink-20)", background: "var(--paper)", padding: 16 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--ink-50)", marginBottom: 10 }}>legend</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9, fontSize: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <svg width="22" height="22" viewBox="-11 -11 22 22" style={{ flexShrink: 0 }}><rect x="-7" y="-11" width="14" height="11" rx="1" fill="var(--ink)" /><text x="0" y="-3" fontFamily="var(--font-mono)" fontSize="7" fontWeight="700" fill="var(--paper)" textAnchor="middle">1</text><line x1="0" y1="0" x2="0" y2="11" stroke="var(--ink)" strokeWidth="0.8" /></svg>
                  <span>Ranked operator</span>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-50)", marginTop: 6 }}>demand-index hit · by rating</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <svg width="22" height="22" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="9" fill="var(--moss)" fillOpacity="0.2" stroke="var(--moss)" strokeOpacity="0.5" /></svg>
                  <span>≥ 4.5 ★</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <svg width="22" height="22" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="7" fill="var(--ochre)" fillOpacity="0.2" stroke="var(--ochre)" strokeOpacity="0.5" /></svg>
                  <span>4.2 – 4.5 ★</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <svg width="22" height="22" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="5" fill="var(--rust)" fillOpacity="0.2" stroke="var(--rust)" strokeOpacity="0.5" /></svg>
                  <span>&lt; 4.2 ★</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-55, var(--ink-50))", lineHeight: 1.45, marginTop: 6, paddingTop: 8, borderTop: "1px dashed var(--ink-15)" }}>
                  Circle radius encodes review count.
                </div>
              </div>
            </div>

            <div style={{ border: "1px solid var(--ink-20)", background: "var(--paper)", padding: 16 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--ink-50)", marginBottom: 6 }}>density read</div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.02em", lineHeight: 1 }}>1,847</div>
              <div style={{ fontSize: 12, color: "var(--ink-60)", marginTop: 6, lineHeight: 1.45 }}>
                roofing businesses within 25 mi of Houston city center in our index. The 8 ranked operators are the long-tail subset Apollo can't see.
              </div>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--ink-15)", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-50)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                <span style={{ color: "var(--moss)" }}>●</span> 612 ≥4.5 ★<br/>
                <span style={{ color: "var(--ochre)" }}>●</span> 892 4.2 – 4.5<br/>
                <span style={{ color: "var(--rust)" }}>●</span> 343 &lt; 4.2
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
};

// ─── Footer ──────────────────────────────────────────────────────────────────
const Footer = () => (
  <footer style={{ borderTop: "1px solid var(--ink-15)", background: "var(--paper)" }}>
    <div style={{ maxWidth: 1320, margin: "0 auto", padding: "56px 32px 28px", display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: 36 }}>
      <div>
        <Wordmark size={22} />
        <p style={{ marginTop: 14, fontSize: 13, color: "var(--ink-60)", lineHeight: 1.55, maxWidth: "38ch" }}>
          A field manual for the long tail of B2B. Built on Bright Data + DeepSeek + a private 7M-record demand index.
        </p>
        <div style={{ marginTop: 14, display: "flex", gap: 6 }}>
          <Stamp tone="moss">live</Stamp>
          <Stamp tone="ink">vol. 1 · 2026</Stamp>
        </div>
      </div>
      {[
        { h: "Sections",  links: ["The query", "Agent trace", "Apollo gap", "Operators", "Map", "Specimen card"] },
        { h: "Reference", links: ["How it works", "API docs", "Verticals (25)", "Watchlist", "Memory layer", "Cost model"] },
        { h: "Built on",  links: ["Bright Data", "DeepSeek", "Cloudflare Workers", "OpenStreetMap", "Playwright", "Preact"] },
      ].map((g) => (
        <div key={g.h}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--ink-50)", marginBottom: 10 }}>{g.h}</div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 7, fontSize: 13 }}>
            {g.links.map((l) => <li key={l}><a href="#" style={{ color: "var(--ink-80)", textDecoration: "none", borderBottom: "1px dotted var(--ink-25)" }}>{l}</a></li>)}
          </ul>
        </div>
      ))}
    </div>
    <div style={{ borderTop: "1px solid var(--ink-15)" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-50)", textTransform: "uppercase", letterSpacing: "0.14em" }}>
        <span>longtailscout.com · made in houston · mit licensed</span>
        <span>built for the bright data web data UNLOCKED hackathon, may 2026</span>
      </div>
    </div>
  </footer>
);

// ─── Reusable button styles ──────────────────────────────────────────────────
const btnInk = {
  display: "inline-flex", alignItems: "center", gap: 6,
  background: "var(--ink)", color: "var(--paper)", border: 0,
  padding: "8px 14px", fontFamily: "var(--font-mono)", fontSize: 11,
  textTransform: "uppercase", letterSpacing: "0.1em", cursor: "pointer", fontWeight: 600,
};
const btnGhost = {
  display: "inline-flex", alignItems: "center", gap: 6,
  background: "transparent", color: "var(--ink-80)", border: "1px solid var(--ink-25)",
  padding: "8px 14px", fontFamily: "var(--font-mono)", fontSize: 11,
  textTransform: "uppercase", letterSpacing: "0.1em", cursor: "pointer", fontWeight: 600,
};
const btnInkSm  = { ...btnInk,  padding: "6px 10px", fontSize: 10 };
const btnGhostSm= { ...btnGhost,padding: "6px 10px", fontSize: 10 };

Object.assign(window, { ResultsSection, DrillDown, MapSection, Footer, ConfidenceBar });
