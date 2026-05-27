import { useEffect, useState } from "preact/hooks";

const SEEN_KEY = "lts_onboarding_seen_v1";

/**
 * First-visit explainer card. Dismissible. Only shown until the user clicks "Got it"
 * (then we drop a localStorage flag). Designed to answer the three questions a judge has
 * in their first five seconds:
 *   1. What is this?
 *   2. Why should I care?
 *   3. What should I click?
 */
export function Onboarding() {
  const [show, setShow] = useState<boolean>(false);

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    if (!localStorage.getItem(SEEN_KEY)) setShow(true);
  }, []);

  function dismiss() {
    try { localStorage.setItem(SEEN_KEY, String(Date.now())); } catch { /* ignore */ }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div class="rounded-lg border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-5 shadow-sm">
      <div class="flex items-start gap-4">
        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200">
          <span class="text-base">👋</span>
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline justify-between gap-2">
            <h2 class="text-base font-semibold text-indigo-900">First time here?</h2>
            <button class="text-xs text-indigo-500 hover:text-indigo-900 underline decoration-dotted" onClick={dismiss}>dismiss</button>
          </div>
          <p class="mt-1 text-sm text-indigo-900/80">
            LongTail Scout finds <strong>net-new accounts</strong> in markets Apollo, ZoomInfo, and Clay miss. Built for vertical-SaaS GTM teams selling into local-services niches (roofing, HVAC, dental, childcare, etc.) — the operators that exist on Google but not in LinkedIn's graph.
          </p>
          <div class="mt-3 grid gap-2 sm:grid-cols-3 text-xs">
            <div class="rounded border border-indigo-100 bg-white/60 px-3 py-2">
              <div class="font-medium text-indigo-900 mb-0.5">1 · Click a demo chip</div>
              <div class="text-indigo-900/70">Try "Roofing · Houston" or "HVAC · Dallas" — these run in ~25s on a real Bright Data + DeepSeek pipeline.</div>
            </div>
            <div class="rounded border border-indigo-100 bg-white/60 px-3 py-2">
              <div class="font-medium text-indigo-900 mb-0.5">2 · Watch the trace</div>
              <div class="text-indigo-900/70">Three phases stream live: Discovery → Enrichment → Synthesis. Cost meter updates as renders happen.</div>
            </div>
            <div class="rounded border border-indigo-100 bg-white/60 px-3 py-2">
              <div class="font-medium text-indigo-900 mb-0.5">3 · Compare</div>
              <div class="text-indigo-900/70">Expand the "Apollo vs LongTail" panel to see the wedge made concrete — same query, very different answers.</div>
            </div>
          </div>
          <div class="mt-3 flex items-center gap-3 text-xs">
            <button
              class="rounded bg-indigo-700 px-3 py-1.5 text-white hover:bg-indigo-800"
              onClick={dismiss}
              type="button"
            >Got it</button>
            <span class="text-indigo-900/50">
              Every live run costs real Bright Data + DeepSeek dollars — append <code class="rounded bg-white px-1.5 py-0.5 text-[10px] ring-1 ring-indigo-200">?sample=1</code> for cached samples (zero spend, ~140ms).
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
