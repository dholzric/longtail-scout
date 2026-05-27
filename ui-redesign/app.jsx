// Main app entry — orchestrates sections + tweaks panel

// Defaults live in the root HTML's EDITMODE block so the host can persist edits.
const TWEAK_DEFAULTS = window.__TWEAK_DEFAULTS;

const PALETTE_MAP = {
  cream: {
    "--paper":      "#F5F0E4",
    "--paper-2":    "#EFE9DA",
    "--paper-3":    "#E9E2CF",
    "--ink":        "#1A1814",
    "--ink-deep":   "#15130F",
    "--ink-90":     "#26221C",
    "--ink-80":     "#3A3530",
    "--ink-70":     "#4F4942",
    "--ink-60":     "#6B645B",
    "--ink-50":     "#857E73",
    "--ink-40":     "#A39C90",
    "--ink-30":     "#BFB8AC",
    "--ink-25":     "#CCC5B8",
    "--ink-20":     "#D2CBBE",
    "--ink-15":     "#DBD4C7",
    "--ink-10":     "#E2DCCF",
    "--ink-08":     "#E6E0D2",
    "--rust":       "#A8351F",
    "--rust-dk":    "#7A2415",
    "--rust-tint":  "#F4E1DA",
    "--rust-bright":"#D14E33",
    "--moss":       "#3E6B2C",
    "--moss-dk":    "#2A4A1E",
    "--moss-tint":  "#DCE5CC",
    "--moss-bright":"#7BC04A",
    "--ochre":      "#C68A2E",
    "--ochre-dk":   "#8B5E1E",
    "--ochre-tint": "#F2E5C9",
    "--ochre-bright":"#E8B85B",
    "--sky":        "#3D7099",
    "--sky-dk":     "#2A5074",
    "--sky-tint":   "#DCE6EF",
  },
  ink: {
    "--paper":      "#161513",
    "--paper-2":    "#1D1C19",
    "--paper-3":    "#252320",
    "--ink":        "#F2EDDF",
    "--ink-deep":   "#0D0C0A",
    "--ink-90":     "#E8E1D0",
    "--ink-80":     "#D0C9B7",
    "--ink-70":     "#B5AE9C",
    "--ink-60":     "#938C7B",
    "--ink-50":     "#75705F",
    "--ink-40":     "#5E594C",
    "--ink-30":     "#46423A",
    "--ink-25":     "#3D3A33",
    "--ink-20":     "#34322C",
    "--ink-15":     "#2C2A25",
    "--ink-10":     "#262420",
    "--ink-08":     "#22201C",
    "--rust":       "#D87459",
    "--rust-dk":    "#A8492F",
    "--rust-tint":  "#3A1F18",
    "--rust-bright":"#FF9A7A",
    "--moss":       "#8FBE5F",
    "--moss-dk":    "#B5D88E",
    "--moss-tint":  "#1F2B17",
    "--moss-bright":"#A8E670",
    "--ochre":      "#E0B770",
    "--ochre-dk":   "#F0CE8E",
    "--ochre-tint": "#2B2316",
    "--ochre-bright":"#FFD27A",
    "--sky":        "#7AAACF",
    "--sky-dk":     "#A4C6E0",
    "--sky-tint":   "#1A2530",
  },
  blueprint: {
    "--paper":      "#152538",
    "--paper-2":    "#1A2D43",
    "--paper-3":    "#21354C",
    "--ink":        "#E8F0F8",
    "--ink-deep":   "#0B1622",
    "--ink-90":     "#D8E2EE",
    "--ink-80":     "#BCC9D9",
    "--ink-70":     "#9FAEC2",
    "--ink-60":     "#8090A6",
    "--ink-50":     "#647489",
    "--ink-40":     "#4F5E72",
    "--ink-30":     "#3B4A5E",
    "--ink-25":     "#344357",
    "--ink-20":     "#2D3C50",
    "--ink-15":     "#283749",
    "--ink-10":     "#243345",
    "--ink-08":     "#223141",
    "--rust":       "#F08F6A",
    "--rust-dk":    "#FFAB87",
    "--rust-tint":  "#3A2118",
    "--rust-bright":"#FF9F7A",
    "--moss":       "#7CC95B",
    "--moss-dk":    "#A4E082",
    "--moss-tint":  "#1B2D1C",
    "--moss-bright":"#A4E082",
    "--ochre":      "#F0C672",
    "--ochre-dk":   "#FFDC95",
    "--ochre-tint": "#2A2316",
    "--ochre-bright":"#FFDC95",
    "--sky":        "#7AB4E6",
    "--sky-dk":     "#A4CCEC",
    "--sky-tint":   "#1B2E45",
  },
};

function applyPalette(name) {
  const p = PALETTE_MAP[name] || PALETTE_MAP.cream;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(p)) root.style.setProperty(k, v);
  document.body.setAttribute("data-palette", name);
}

function App() {
  const data = window.SCOUT_DATA;
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [query, setQuery] = React.useState(data.query);
  const [picked, setPicked] = React.useState(t.open_op);

  React.useEffect(() => { applyPalette(t.palette); }, [t.palette]);

  return (
    <div style={{
      background: "var(--paper)", color: "var(--ink)", minHeight: "100vh",
      fontFamily: "var(--font-sans)", fontSize: 14,
    }}>
      <TopBar cost={data.cost} />
      <Hero
        query={query}
        onQueryChange={setQuery}
        onRun={() => {}}
        demand={data.demand}
        niche={data.niche}
      />
      <TraceSection phases={data.phases} trace={data.trace} cost={data.cost} />
      <WedgeSection ops={data.operators} apolloPicks={data.apolloPicks} demand={data.demand} />
      <ResultsSection ops={data.operators} picked={picked} onPick={setPicked} />
      <MapSection ops={data.operators} heatPoints={data.demandIndex.points} />
      <Footer />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme">
          <TweakRadio
            label="Palette"
            value={t.palette}
            options={[
              { value: "cream",     label: "Cream" },
              { value: "ink",       label: "Ink" },
              { value: "blueprint", label: "Blueprint" },
            ]}
            onChange={(v) => setTweak("palette", v)}
          />
        </TweakSection>
        <TweakSection label="Content">
          <TweakToggle
            label="Show demand probe"
            value={t.show_demand}
            onChange={(v) => setTweak("show_demand", v)}
          />
          <TweakToggle
            label="Show memory dots"
            value={t.show_memory}
            onChange={(v) => setTweak("show_memory", v)}
          />
          <TweakSelect
            label="Open specimen"
            value={t.open_op}
            options={data.operators.map((o) => ({ value: o.url, label: `${String(o.rank).padStart(2,"0")} — ${o.name}` }))}
            onChange={(v) => { setTweak("open_op", v); setPicked(v); }}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
