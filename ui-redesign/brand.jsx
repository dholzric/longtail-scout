// Shared visual atoms: brand mark, icons, badges, contour SVGs, etc.
// Pure presentational — no state, no business logic.

// ─── Brand mark ───────────────────────────────────────────────────────────────
const Wordmark = ({ size = 28, color = "currentColor", domain = true }) => (
  <span style={{ display: "inline-flex", alignItems: "baseline", gap: 0, fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: size, color, letterSpacing: "-0.02em", lineHeight: 1 }}>
    <span style={{ fontStyle: "italic", fontWeight: 500 }}>longtail</span>
    <CompassDot size={size * 0.5} />
    <span style={{ fontWeight: 700 }}>scout</span>
    {domain && <span style={{ fontFamily: "var(--font-mono)", fontSize: size * 0.4, color: "var(--ink-40)", fontWeight: 400, marginLeft: 2, transform: "translateY(-0.15em)" }}>.com</span>}
  </span>
);

const CompassDot = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" style={{ margin: "0 0.04em", flexShrink: 0, transform: "translateY(0.04em)" }} aria-hidden="true">
    <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" strokeWidth="1.4" />
    <path d="M10 2 L12.5 10 L10 18 L7.5 10 Z" fill="currentColor" opacity="0.9" />
    <circle cx="10" cy="10" r="1.4" fill="var(--paper)" />
  </svg>
);

// ─── Topographic contour background ───────────────────────────────────────────
const ContourField = ({ opacity = 0.22, density = 1 }) => (
  <svg viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity }} aria-hidden="true">
    <defs>
      <pattern id="contour-grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--ink-15)" strokeWidth="0.5" />
      </pattern>
    </defs>
    <rect width="800" height="500" fill="url(#contour-grid)" />
    {/* organic contour lines mimicking topographic map */}
    <g fill="none" stroke="var(--ink-30)" strokeWidth="0.9">
      <path d="M-50,180 C120,140 200,260 360,230 C520,200 620,300 880,260" />
      <path d="M-50,200 C140,170 220,280 380,250 C540,220 640,320 880,280" />
      <path d="M-50,220 C160,200 240,300 400,270 C560,240 660,340 880,300" />
      <path d="M-50,250 C180,240 280,320 420,300 C580,280 700,360 880,330" />
      <path d="M-50,290 C220,290 320,350 460,340 C620,330 740,380 880,370" />
      <path d="M-50,80 C100,70 180,150 300,120 C440,85 540,140 880,110" />
      <path d="M-50,110 C120,110 200,170 320,150 C460,125 560,170 880,150" />
      <path d="M-50,400 C200,420 320,360 480,400 C640,440 720,420 880,440" />
    </g>
    {/* elevation peak */}
    <g fill="none" stroke="var(--ink-40)" strokeWidth="0.9" opacity="0.9">
      <ellipse cx="380" cy="245" rx="80" ry="42" />
      <ellipse cx="380" cy="245" rx="60" ry="30" />
      <ellipse cx="380" cy="245" rx="40" ry="20" />
      <ellipse cx="380" cy="245" rx="22" ry="11" />
    </g>
  </svg>
);

// ─── Field stamps (badges that look like ink stamps) ─────────────────────────
const Stamp = ({ children, tone = "ink", style = {} }) => {
  const tones = {
    ink:    { border: "var(--ink)",     color: "var(--ink)" },
    rust:   { border: "var(--rust)",    color: "var(--rust)" },
    moss:   { border: "var(--moss)",    color: "var(--moss)" },
    ochre:  { border: "var(--ochre-dk)",color: "var(--ochre-dk)" },
    paper:  { border: "var(--paper-3)", color: "var(--ink-60)" },
  };
  const t = tones[tone] || tones.ink;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
      textTransform: "uppercase", letterSpacing: "0.08em",
      padding: "3px 8px", border: `1.5px solid ${t.border}`, color: t.color,
      borderRadius: 2, background: "transparent",
      transform: "rotate(-0.4deg)", ...style,
    }}>{children}</span>
  );
};

// Solid-fill pill (small chip)
const Chip = ({ children, tone = "ink", style = {} }) => {
  const tones = {
    ink:   { bg: "var(--ink-08)",    fg: "var(--ink)" },
    rust:  { bg: "var(--rust-tint)", fg: "var(--rust-dk)" },
    moss:  { bg: "var(--moss-tint)", fg: "var(--moss-dk)" },
    ochre: { bg: "var(--ochre-tint)",fg: "var(--ochre-dk)" },
    sky:   { bg: "var(--sky-tint)",  fg: "var(--sky-dk)" },
  };
  const t = tones[tone] || tones.ink;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 500,
      padding: "2px 7px", borderRadius: 3, whiteSpace: "nowrap",
      background: t.bg, color: t.fg, lineHeight: 1.4, ...style,
    }}>{children}</span>
  );
};

// ─── Section header (editorial style) ────────────────────────────────────────
const SectionHeader = ({ number, kicker, title, lede, action }) => (
  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, borderBottom: "1px solid var(--ink-15)", paddingBottom: 14, marginBottom: 22 }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-50)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>
        {number && <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--rust)" }}>§ {number}</span>}
        <span style={{ width: 18, height: 1, background: "var(--ink-30)" }} />
        <span>{kicker}</span>
      </div>
      <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 30, letterSpacing: "-0.02em", lineHeight: 1.1, margin: 0, color: "var(--ink)" }}>{title}</h2>
      {lede && <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.55, color: "var(--ink-60)", maxWidth: "62ch" }}>{lede}</p>}
    </div>
    {action && <div style={{ flexShrink: 0 }}>{action}</div>}
  </div>
);

// ─── Citation pip (inline footnote-like number) ──────────────────────────────
const Cite = ({ n, title }) => (
  <sup title={title} style={{
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 14, height: 14, fontSize: 9, fontWeight: 700,
    fontFamily: "var(--font-mono)", color: "var(--rust)",
    border: "1px solid var(--rust)", borderRadius: 50, marginLeft: 3,
    cursor: "help", lineHeight: 1, verticalAlign: "super",
  }}>{n}</sup>
);

// ─── Memory-state dot ───────────────────────────────────────────────────────
const MemoryDot = ({ state }) => {
  const map = {
    new:      { color: "var(--rust)",  label: "New" },
    familiar: { color: "var(--ochre-dk)", label: "Familiar" },
    frequent: { color: "var(--moss)", label: "Frequent" },
  };
  const m = map[state] || map.new;
  return (
    <span title={`${m.label} — index memory`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--ink-60)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
      <span style={{ width: 7, height: 7, borderRadius: 50, background: m.color }} />
      {m.label}
    </span>
  );
};

// ─── Generic icons ──────────────────────────────────────────────────────────
const Ic = {
  binoculars: (p) => (
    <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="7" cy="14" r="4.5" /><circle cx="17" cy="14" r="4.5" />
      <path d="M11.5 14 L12.5 14" /><path d="M5 6 L9 6 L9 10" /><path d="M15 6 L19 6 L19 10" />
    </svg>
  ),
  pin: (p) => (
    <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="currentColor" aria-hidden="true">
      <path d="M12 2c-3.87 0-7 3.13-7 7 0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
    </svg>
  ),
  arrow: (p) => (
    <svg viewBox="0 0 24 24" width={p.s||14} height={p.s||14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12 L19 12" /><path d="M13 6 L19 12 L13 18" />
    </svg>
  ),
  cmd: (p) => (
    <svg viewBox="0 0 24 24" width={p.s||14} height={p.s||14} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="7" y="7" width="10" height="10" rx="1" />
      <path d="M7 11 H4 a2 2 0 1 1 2 -2 V7" /><path d="M17 13 H20 a2 2 0 1 1 -2 2 V17" />
      <path d="M11 7 V4 a2 2 0 1 1 2 2 H17" /><path d="M13 17 V20 a2 2 0 1 1 -2 -2 V13" />
    </svg>
  ),
  bolt: (p) => (
    <svg viewBox="0 0 24 24" width={p.s||14} height={p.s||14} fill="currentColor" aria-hidden="true">
      <path d="M13 2 L4 14 L11 14 L11 22 L20 10 L13 10 Z" />
    </svg>
  ),
  link: (p) => (
    <svg viewBox="0 0 24 24" width={p.s||14} height={p.s||14} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
    </svg>
  ),
  copy: (p) => (
    <svg viewBox="0 0 24 24" width={p.s||14} height={p.s||14} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="8" y="8" width="12" height="12" rx="1.5" /><path d="M4 16 V5 a1 1 0 0 1 1 -1 H15" />
    </svg>
  ),
  check: (p) => (
    <svg viewBox="0 0 24 24" width={p.s||14} height={p.s||14} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12 L10 18 L20 6" />
    </svg>
  ),
  x: (p) => (
    <svg viewBox="0 0 24 24" width={p.s||14} height={p.s||14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6 L18 18 M18 6 L6 18" />
    </svg>
  ),
  sparkle: (p) => (
    <svg viewBox="0 0 24 24" width={p.s||14} height={p.s||14} fill="currentColor" aria-hidden="true">
      <path d="M12 3 L13.5 9 L19 10.5 L13.5 12 L12 18 L10.5 12 L5 10.5 L10.5 9 Z" />
    </svg>
  ),
};

Object.assign(window, {
  Wordmark, CompassDot, ContourField, Stamp, Chip,
  SectionHeader, Cite, MemoryDot, Ic,
});
