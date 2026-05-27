import type { ComponentChildren } from "preact";

interface Props {
  /** Section number — "01", "02", … Renders as "§ 01". */
  number: string;
  /** Tiny eyebrow above the title (rendered uppercase). */
  kicker: string;
  /** Section title — serif, big. */
  title: string;
  /** Optional lede paragraph below the title. */
  lede?: string;
  /** Optional right-side action (e.g. button row). */
  action?: ComponentChildren;
}

/**
 * Editorial section divider used throughout the redesign. "§ 02 — agent trace, live" /
 * big serif title / one-paragraph lede / optional action on the right.
 */
export function SectionHeader({ number, kicker, title, lede, action }: Props) {
  return (
    <div class="mb-6 flex items-end justify-between gap-6 flex-wrap">
      <div class="max-w-2xl">
        <div class="flex items-center gap-3 mb-3 font-mono text-[10px] uppercase tracking-[0.16em]">
          <span class="text-rust">§ {number}</span>
          <span class="inline-block h-px w-6 bg-ink-25" />
          <span class="text-ink-60">{kicker}</span>
        </div>
        <h2 class="font-serif text-3xl md:text-4xl font-semibold tracking-tight text-ink leading-tight">
          {title}
        </h2>
        {lede && <p class="mt-3 text-sm leading-relaxed text-ink-70">{lede}</p>}
      </div>
      {action && <div class="shrink-0">{action}</div>}
    </div>
  );
}
