// Hero + Live cost meter + Agent trace + Wedge sections

// ─── Top utility bar (sticky cost meter + nav) ────────────────────────────────
const TopBar = ({ cost }) => (
  <div style={{
    position: "sticky", top: 0, zIndex: 50,
    background: "color-mix(in oklab, var(--paper) 88%, transparent)",
    backdropFilter: "blur(8px) saturate(120%)",
    WebkitBackdropFilter: "blur(8px) saturate(120%)",
    borderBottom: "1px solid var(--ink-15)",
    fontFamily: "var(--font-mono)", fontSize: 11,
  }}>
    <div style={{ maxWidth: 1320, margin: "0 auto", padding: "8px 32px", display: "flex", alignItems: "center", gap: 18, color: "var(--ink-70)" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
        <span style={{ width: 7, height: 7, borderRadius: 50, background: "var(--moss)", boxShadow: "0 0 0 3px color-mix(in oklab, var(--moss) 25%, transparent)" }} />
        <span style={{ color: "var(--ink-80)", fontWeight: 600 }}>live</span>
      </span>
      <span style={{ color: "var(--ink-50)" }}>edition 2026.05 · roofing · houston</span>

      <span style={{ flex: 1 }} />

      <span title="Bright Data Scraping Browser nav cost" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <span style={{ color: "var(--ink-40)" }}>BD</span>
        <span style={{ color: "var(--ink)" }}>${cost.bd_usd.toFixed(4)}</span>
        <span style={{ color: "var(--ink-40)" }}>({cost.bd_renders} renders)</span>
      </span>
      <span style={{ color: "var(--ink-25)" }}>·</span>
      <span title="DeepSeek token cost" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <span style={{ color: "var(--ink-40)" }}>LLM</span>
        <span style={{ color: "var(--ink)" }}>${cost.llm_usd.toFixed(4)}</span>
        <span style={{ color: "var(--ink-40)" }}>({(cost.llm_input_tokens / 1000).toFixed(1)}k tok)</span>
      </span>
      <span style={{ color: "var(--ink-25)" }}>·</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--ink)" }}>
        <span style={{ color: "var(--ink-40)" }}>Σ</span>
        <span style={{ fontWeight: 700 }}>${cost.total_usd.toFixed(4)}</span>
      </span>

      <span style={{ color: "var(--ink-25)" }}>·</span>
      <a href="#field-manual" style={{ color: "var(--ink-70)", textDecoration: "none", borderBottom: "1px dotted var(--ink-30)" }}>field manual</a>
      <a href="#docs" style={{ color: "var(--ink-70)", textDecoration: "none", borderBottom: "1px dotted var(--ink-30)" }}>api</a>
    </div>
  </div>
);

// ─── Hero ─────────────────────────────────────────────────────────────────────
const Hero = ({ query, onQueryChange, onRun, demand, niche }) => {
  const [focused, setFocused] = React.useState(false);
  const chips = [
    { emoji: "🏠", label: "Roofing · Houston", q: "roofing contractors in Houston" },
    { emoji: "❄️",  label: "HVAC · Dallas", q: "HVAC technicians in Dallas" },
    { emoji: "🦷", label: "Dental · Houston", q: "dental practices in Houston" },
    { emoji: "🍼", label: "Childcare · Austin", q: "childcare in Austin" },
    { emoji: "⚖️", label: "Law firms · CA", q: "law firms in California" },
    { emoji: "🖥️", label: "MSPs · Florida", q: "MSPs in Florida" },
  ];
  return (
    <section style={{ position: "relative", overflow: "hidden", borderBottom: "1px solid var(--ink-15)" }}>
      <ContourField opacity={0.5} />
      <div style={{ position: "relative", maxWidth: 1320, margin: "0 auto", padding: "56px 32px 36px" }}>
        {/* Wordmark + edition line */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 36 }}>
          <Wordmark size={26} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-50)", textTransform: "uppercase", letterSpacing: "0.16em" }}>
            <span>vol. 1</span>
            <span style={{ width: 1, height: 12, background: "var(--ink-25)" }} />
            <span>field manual for the long tail</span>
            <span style={{ width: 1, height: 12, background: "var(--ink-25)" }} />
            <span>est. may 2026</span>
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 380px", gap: 64, alignItems: "end", marginBottom: 36 }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <Stamp tone="rust">apollo can't see this</Stamp>
              <Stamp tone="ink">82,431 in the index</Stamp>
            </div>
            <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 76, lineHeight: 0.96, letterSpacing: "-0.035em", margin: 0, color: "var(--ink)", textWrap: "balance" }}>
              The operators<br/>
              <span style={{ fontStyle: "italic", fontWeight: 500, color: "var(--rust)" }}>your data vendor</span><br/>
              forgot to crawl.
            </h1>
            <p style={{ marginTop: 22, fontSize: 18, lineHeight: 1.5, color: "var(--ink-70)", maxWidth: "44ch" }}>
              A live prospect scout for vertical-SaaS GTM teams. Type a niche × city; in 90 seconds get a ranked, cited list of small operators whose primary signal is their <em>own website</em>, not LinkedIn.
            </p>
          </div>

          {/* Field-manual TOC card */}
          <aside style={{ background: "var(--paper-2)", border: "1px solid var(--ink-15)", padding: 22, position: "relative" }}>
            <div style={{ position: "absolute", top: -10, left: 18, background: "var(--paper)", padding: "0 8px", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--ink-60)" }}>
              this dispatch
            </div>
            <ol style={{ margin: 0, padding: 0, listStyle: "none", fontFamily: "var(--font-serif)", fontSize: 14, lineHeight: 1.8 }}>
              {[
                ["§01", "The query"],
                ["§02", "Agent trace, live"],
                ["§03", "The Apollo gap"],
                ["§04", "8 operators, cited"],
                ["§05", "On the map"],
                ["§06", "Specimen: Bayou Roofing Co."],
              ].map(([n, t]) => (
                <li key={n} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dotted var(--ink-25)", padding: "1px 0" }}>
                  <span style={{ color: "var(--ink-90)" }}>{t}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-50)" }}>{n}</span>
                </li>
              ))}
            </ol>
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--ink-15)", display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-50)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              <span>27 BD renders</span>
              <span>$0.07 / scout</span>
              <span>~90s</span>
            </div>
          </aside>
        </div>

        {/* Query input */}
        <div id="query" style={{ marginTop: 12 }}>
          <SectionHeader number="01" kicker="the query" title="One niche, one city." lede="The scout fires 3–4 parallel Bright Data SERPs, renders each candidate's homepage + careers + news, and ranks. Every fact below is footnoted back to the fetch that produced it." />

          <div style={{ background: "var(--paper-2)", border: "1px solid var(--ink-25)", padding: 4, display: "flex", alignItems: "stretch", gap: 0, boxShadow: focused ? "0 0 0 3px color-mix(in oklab, var(--rust) 18%, transparent)" : "none", transition: "box-shadow .15s" }}>
            <div style={{ display: "flex", alignItems: "center", padding: "0 18px", color: "var(--ink-60)" }}>
              <Ic.binoculars s={20} />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "12px 0" }}>
              <label style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--ink-50)" }}>niche × city</label>
              <input
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                onKeyDown={(e) => { if (e.key === "Enter") onRun(); }}
                style={{ border: 0, outline: "none", background: "transparent", padding: "4px 0 0", fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.01em", width: "100%" }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 10px 10px 0" }}>
              <button onClick={onRun} style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "var(--ink)", color: "var(--paper)", border: 0,
                padding: "14px 22px", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600,
                textTransform: "uppercase", letterSpacing: "0.12em", cursor: "pointer",
              }}>
                run scout <Ic.arrow s={14} />
              </button>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-50)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Ic.cmd s={11} /> + ⏎
              </span>
            </div>
          </div>

          {/* Demand probe + chips row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-70)" }}>
              <span style={{ width: 7, height: 7, borderRadius: 50, background: "var(--moss)" }} />
              <span style={{ fontWeight: 600, color: "var(--ink)" }}>{demand.matching.toLocaleString()}</span>
              <span style={{ color: "var(--ink-50)" }}>matching “{niche}” in our {(demand.total/1e6).toFixed(1)}M-record demand index</span>
              <Cite n={1} title="Demand-signal index probe" />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-50)" }}>
              <span style={{ textTransform: "uppercase", letterSpacing: "0.12em" }}>try:</span>
              {chips.map((c) => (
                <button key={c.q} onClick={() => onQueryChange(c.q)} style={{
                  background: "transparent", border: "1px solid var(--ink-20)",
                  padding: "5px 10px", fontFamily: "var(--font-sans)", fontSize: 11,
                  color: "var(--ink-80)", cursor: "pointer", borderRadius: 50,
                  display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
                }}>
                  <span style={{ fontSize: 12 }}>{c.emoji}</span>{c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── Agent trace section ─────────────────────────────────────────────────────
const TraceSection = ({ phases, trace, cost }) => {
  const phaseColor = { discovery: "var(--ochre-dk)", enrichment: "var(--rust)", synthesis: "var(--moss)" };
  return (
    <section style={{ maxWidth: 1320, margin: "0 auto", padding: "56px 32px 24px" }}>
      <SectionHeader number="02" kicker="agent trace, live"
        title="What the scout actually did — step by step."
        lede="Three phases, streamed via SSE. Discovery proposes; enrichment renders & extracts; synthesis ranks. Every tool call costs real money; the meter at the top of the page tallies it."
        action={
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-60)" }}>
            <Ic.bolt s={12} /><span>{trace.length} events · 87.3s</span>
          </div>
        }
      />

      {/* Phase strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 18 }}>
        {phases.map((p, i) => (
          <div key={p.id} style={{
            border: "1px solid var(--ink-20)", background: "var(--paper-2)",
            padding: "16px 18px", position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, height: 3, width: "100%", background: phaseColor[p.id] }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: phaseColor[p.id], fontWeight: 700 }}>0{i+1}</span>
                <span style={{ fontFamily: "var(--font-serif)", fontSize: 17, fontWeight: 600, color: "var(--ink)" }}>{p.label}</span>
              </div>
              <Chip tone={i === 2 ? "moss" : "paper"}>{i === 2 ? "complete ✓" : "complete"}</Chip>
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-60)", lineHeight: 1.5, marginBottom: 10 }}>{p.blurb}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-50)", letterSpacing: "0.05em", display: "flex", justifyContent: "space-between" }}>
              <span>{p.events} events</span>
              <span>·</span>
              <span>{i === 0 ? "12.4s" : i === 1 ? "62.1s" : "12.8s"}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Trace terminal */}
      <div style={{ border: "1px solid var(--ink-20)", background: "var(--ink-deep)", color: "var(--paper)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid color-mix(in oklab, var(--paper) 12%, transparent)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "color-mix(in oklab, var(--paper) 50%, transparent)" }}>
          <span>POST /api/scout — server-sent events</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: 50, background: "var(--moss-bright)", boxShadow: "0 0 8px var(--moss-bright)" }} />
            stream complete
          </span>
        </div>
        <div style={{ padding: "12px 16px", maxHeight: 280, overflow: "auto", lineHeight: 1.7 }}>
          {trace.map((t, i) => {
            const color = t.ev === "phase" ? "var(--ochre-bright)" :
              t.ev === "tool" ? "color-mix(in oklab, var(--paper) 90%, transparent)" :
              t.ev === "enrich" ? "var(--moss-bright)" :
              t.ev === "done" ? "var(--moss-bright)" :
              "color-mix(in oklab, var(--paper) 55%, transparent)";
            const ts = `${(i * 4.3).toFixed(1).padStart(5, "0")}s`;
            return (
              <div key={i} style={{ display: "flex", gap: 14, color }}>
                <span style={{ color: "color-mix(in oklab, var(--paper) 30%, transparent)", flexShrink: 0 }}>{ts}</span>
                <span style={{ whiteSpace: "pre-wrap" }}>{t.text}</span>
              </div>
            );
          })}
        </div>
        <div style={{ padding: "10px 16px", borderTop: "1px solid color-mix(in oklab, var(--paper) 12%, transparent)", display: "flex", justifyContent: "space-between", fontSize: 10, color: "color-mix(in oklab, var(--paper) 55%, transparent)" }}>
          <span>27 BD renders · {cost.llm_calls} LLM calls · {(cost.llm_input_tokens + cost.llm_output_tokens).toLocaleString()} tokens</span>
          <span>$0.0648 BD + $0.0061 LLM = ${cost.total_usd.toFixed(4)}</span>
        </div>
      </div>
    </section>
  );
};

// ─── Apollo vs LongTail wedge ────────────────────────────────────────────────
const WedgeSection = ({ ops, apolloPicks, demand }) => {
  const apolloThin = ops.filter(o => o.apolloThin).length;
  const hiring = ops.filter(o => o.hiring.count > 0).length;
  const totalRoles = ops.reduce((sum, o) => sum + (o.hiring.count || 0), 0);
  const cited = ops.reduce((sum, o) => sum + o.sources.length, 0);

  const reasonColor = {
    "wrong-segment": "var(--rust)",
    "saturated":     "var(--ochre-dk)",
    "stale":         "var(--ink-50)",
    "aggregator":    "var(--ink-50)",
  };

  return (
    <section style={{ background: "var(--paper-2)", borderTop: "1px solid var(--ink-15)", borderBottom: "1px solid var(--ink-15)" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "56px 32px" }}>
        <SectionHeader number="03" kicker="the apollo gap"
          title="Two databases. Same query. Different worlds."
          lede="Apollo's graph is the LinkedIn-employee-profile graph. Long-tail operators don't live there. We crawl the open web in real-time and rank what's actually a fit." />

        {/* Stat strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, marginBottom: 32, border: "1px solid var(--ink-15)", background: "var(--paper)" }}>
          {[
            { v: `${apolloThin}/${ops.length}`, l: "operators whose primary signal is their own website", t: "rust" },
            { v: `${hiring}`,                   l: "actively hiring (trigger event)", t: "moss" },
            { v: `${totalRoles}`,               l: "open roles surfaced from ATS pages", t: "ochre" },
            { v: `${cited}`,                    l: "live citations linked back to BD fetches", t: "ink" },
          ].map((s, i) => (
            <div key={i} style={{ padding: 24, borderLeft: i ? "1px solid var(--ink-15)" : 0, position: "relative" }}>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 48, fontWeight: 600, lineHeight: 1, color: `var(--${s.t === "ink" ? "ink" : s.t})`, letterSpacing: "-0.03em" }}>{s.v}</div>
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-60)", lineHeight: 1.4 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Two columns */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--ink-15)", border: "1px solid var(--ink-15)" }}>
          {/* Apollo column */}
          <div style={{ background: "var(--paper)", padding: 28 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--rust)" }}>side a</div>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600, color: "var(--ink)", marginTop: 2 }}>Apollo · ZoomInfo · Clay</div>
              </div>
              <Stamp tone="rust">misses</Stamp>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-60)", lineHeight: 1.55 }}>What an Apollo "roofing contractors, Houston, 10-50 emp" filter actually returns for this niche:</p>
            <ul style={{ margin: "16px 0 0", padding: 0, listStyle: "none" }}>
              {apolloPicks.map((a, i) => (
                <li key={i} style={{ display: "flex", gap: 14, padding: "10px 0", borderTop: i ? "1px dashed var(--ink-15)" : 0 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-40)", width: 24 }}>{String(i+1).padStart(2, "0")}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, color: "var(--ink-50)", textDecoration: "line-through", textDecorationColor: "var(--rust)", textDecorationThickness: "1.5px", fontSize: 14, fontWeight: 500 }}>{a.name}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-50)", marginTop: 2 }}>{a.hint}</div>
                  </div>
                  <Chip tone="rust" style={{ alignSelf: "flex-start", whiteSpace: "nowrap" }}>{a.reason}</Chip>
                </li>
              ))}
            </ul>
          </div>

          {/* LongTail column */}
          <div style={{ background: "var(--paper)", padding: 28, position: "relative" }}>
            <ContourField opacity={0.18} />
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--moss)" }}>side b</div>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600, color: "var(--ink)", marginTop: 2, display: "flex", alignItems: "baseline", gap: 6 }}>
                    longtailscout<span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--ink-50)", fontWeight: 400 }}>.com</span>
                  </div>
                </div>
                <Stamp tone="moss">finds</Stamp>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--ink-60)", lineHeight: 1.55 }}>Top-ranked operators surfaced from this run — each with a hiring signal, an ICP-fit reason, and a per-row sales angle:</p>
              <ul style={{ margin: "16px 0 0", padding: 0, listStyle: "none" }}>
                {ops.slice(0, 6).map((o, i) => (
                  <li key={i} style={{ display: "flex", gap: 14, padding: "10px 0", borderTop: i ? "1px dashed var(--ink-15)" : 0, alignItems: "flex-start" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-40)", width: 24 }}>{String(i+1).padStart(2, "0")}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
                        {o.name}
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 400, color: "var(--ink-50)" }}>{o.domain}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink-60)", marginTop: 2, lineHeight: 1.45 }}>{o.icp_fit_reason}</div>
                    </div>
                    {o.hiring.count > 0 && <Chip tone="moss" style={{ alignSelf: "flex-start", whiteSpace: "nowrap" }}>hiring ×{o.hiring.count}</Chip>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

Object.assign(window, { TopBar, Hero, TraceSection, WedgeSection });
