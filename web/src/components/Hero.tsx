/**
 * Editorial hero block — big serif headline + "this dispatch" TOC sidebar.
 * Sits above the QueryForm and frames the entire page as a field-manual issue.
 */

interface Props {
  demandCount: number | null;
}

const TOC_ENTRIES: [string, string][] = [
  ["§01", "The query"],
  ["§02", "Agent trace, live"],
  ["§03", "The Apollo gap"],
  ["§04", "Operators, cited"],
  ["§05", "On the map"],
  ["§06", "Specimen card"],
];

export function Hero({ demandCount }: Props) {
  return (
    <section class="relative overflow-hidden -mx-6 md:-mx-0">
      {/* Subtle topographic contour underlay */}
      <ContourField />
      <div class="relative px-6 md:px-0 pt-2 pb-6">
        <div class="grid gap-10 md:grid-cols-[minmax(0,1fr)_360px] md:items-end">
          {/* Headline column */}
          <div>
            <div class="flex flex-wrap items-center gap-2 mb-5">
              <Stamp tone="rust">apollo can't see this</Stamp>
              {demandCount !== null && demandCount > 0 && (
                <Stamp tone="ink">{demandCount.toLocaleString()} in the index</Stamp>
              )}
            </div>
            <h2 class="font-serif font-semibold text-5xl md:text-6xl lg:text-7xl leading-[0.96] tracking-[-0.035em] text-ink" style={{ textWrap: "balance" as const }}>
              The operators<br />
              <span class="italic font-medium text-rust">your data vendor</span><br />
              forgot to crawl.
            </h2>
            <p class="mt-5 text-lg leading-relaxed text-ink-70 max-w-[44ch]">
              A live prospect scout for vertical-SaaS GTM teams. Type a niche × city and get back a ranked, citation-linked list of small operators whose primary signal is their <em>own website</em>, not LinkedIn. A live scout takes 2-4 minutes and costs ~$0.20; or hit <code class="font-mono text-base">?sample=1</code> for cached samples at zero spend.
            </p>
          </div>

          {/* This Dispatch TOC card */}
          <aside class="relative bg-paper-2 border border-ink-15 p-5">
            <div class="absolute -top-2.5 left-4 bg-paper px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-60">
              this dispatch
            </div>
            <ol class="m-0 p-0 list-none font-serif text-sm leading-loose">
              {TOC_ENTRIES.map(([num, label]) => (
                <li key={num} class="flex items-center justify-between border-b border-dotted border-ink-25 py-0.5">
                  <span class="text-ink-90">{label}</span>
                  <span class="font-mono text-[11px] text-ink-50">{num}</span>
                </li>
              ))}
            </ol>
            <div class="mt-3 pt-2 border-t border-ink-15 flex items-center justify-between font-mono text-[10px] text-ink-50 uppercase tracking-wider">
              <span>15-30 BD renders</span>
              <span>~$0.20 / scout</span>
              <span>2-4 min</span>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

/** Stamp badge — looks hand-stamped on paper. Used for "apollo can't see this" etc. */
function Stamp({ children, tone }: { children: preact.ComponentChildren; tone: "rust" | "ink" | "moss" | "ochre" }) {
  const colors = {
    rust: "border-rust text-rust",
    ink: "border-ink text-ink",
    moss: "border-moss text-moss",
    ochre: "border-ochre-dk text-ochre-dk",
  } as const;
  return (
    <span class={`inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] px-2 py-0.5 border-[1.5px] ${colors[tone]} bg-transparent rounded-sm`} style={{ transform: "rotate(-0.4deg)" }}>
      {children}
    </span>
  );
}

/** Topographic contour-line background, evokes a paper field map. */
function ContourField() {
  return (
    <svg viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" class="absolute inset-0 w-full h-full pointer-events-none opacity-50" aria-hidden="true">
      <defs>
        <pattern id="contour-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--ink-15)" stroke-width="0.5" />
        </pattern>
      </defs>
      <rect width="800" height="500" fill="url(#contour-grid)" />
      <g fill="none" stroke="var(--ink-30)" stroke-width="0.9">
        <path d="M-50,180 C120,140 200,260 360,230 C520,200 620,300 880,260" />
        <path d="M-50,200 C140,170 220,280 380,250 C540,220 640,320 880,280" />
        <path d="M-50,220 C160,200 240,300 400,270 C560,240 660,340 880,300" />
        <path d="M-50,250 C180,240 280,320 420,300 C580,280 700,360 880,330" />
        <path d="M-50,290 C220,290 320,350 460,340 C620,330 740,380 880,370" />
        <path d="M-50,80 C100,70 180,150 300,120 C440,85 540,140 880,110" />
        <path d="M-50,110 C120,110 200,170 320,150 C460,125 560,170 880,150" />
        <path d="M-50,400 C200,420 320,360 480,400 C640,440 720,420 880,440" />
      </g>
      <g fill="none" stroke="var(--ink-40)" stroke-width="0.9" opacity="0.9">
        <ellipse cx="380" cy="245" rx="80" ry="42" />
        <ellipse cx="380" cy="245" rx="60" ry="30" />
        <ellipse cx="380" cy="245" rx="40" ry="20" />
        <ellipse cx="380" cy="245" rx="22" ry="11" />
      </g>
    </svg>
  );
}
