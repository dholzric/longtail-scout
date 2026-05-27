import { useEffect, useState } from "preact/hooks";

type Palette = "cream" | "ink" | "blueprint";
const PALETTE_KEY = "lts_palette";

function applyPalette(p: Palette) {
  document.body.setAttribute("data-palette", p);
  try { localStorage.setItem(PALETTE_KEY, p); } catch { /* ignore */ }
}

/**
 * On every page load, restore the user's saved palette so the redesign is sticky once chosen.
 * Exported so App.tsx can call it before first paint.
 */
export function restorePalette() {
  if (typeof localStorage === "undefined") return;
  const saved = localStorage.getItem(PALETTE_KEY) as Palette | null;
  if (saved && (saved === "cream" || saved === "ink" || saved === "blueprint")) {
    document.body.setAttribute("data-palette", saved);
  } else {
    document.body.setAttribute("data-palette", "cream");
  }
}

/**
 * Designer-only tweaks panel. Visible only when `?tweaks=1` is in the URL — keeps the prod
 * UI clean while allowing live palette experimentation during demos.
 */
export function TweaksPanel() {
  const [palette, setPalette] = useState<Palette>(() => {
    if (typeof document === "undefined") return "cream";
    return (document.body.getAttribute("data-palette") as Palette) || "cream";
  });
  const [collapsed, setCollapsed] = useState<boolean>(false);

  useEffect(() => { applyPalette(palette); }, [palette]);

  return (
    <div
      class="fixed bottom-4 right-4 z-[60] border border-ink-25 bg-paper-2 shadow-xl"
      style={{ width: collapsed ? "auto" : 260, fontFamily: "var(--font-sans)" }}
    >
      <div class="flex items-center justify-between px-3 py-2 border-b border-ink-15 bg-paper">
        <div class="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-60">
          Tweaks · designer
        </div>
        <button
          class="font-mono text-[11px] text-ink-50 hover:text-ink"
          onClick={() => setCollapsed(c => !c)}
          type="button"
        >
          {collapsed ? "+ open" : "− hide"}
        </button>
      </div>
      {!collapsed && (
        <div class="px-3 py-3 space-y-3">
          <div>
            <div class="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50 mb-1.5">Palette</div>
            <div class="grid grid-cols-3 gap-1.5">
              {(["cream", "ink", "blueprint"] as Palette[]).map((p) => (
                <button
                  key={p}
                  class={`border px-2 py-1.5 font-mono text-[11px] uppercase tracking-wider transition ${
                    palette === p ? "bg-ink text-paper border-ink" : "bg-paper border-ink-25 text-ink-70 hover:bg-paper-3"
                  }`}
                  onClick={() => setPalette(p)}
                  type="button"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div class="font-mono text-[10px] text-ink-50 leading-relaxed">
            Palette persists per browser. Remove <code class="bg-paper-3 px-1">?tweaks=1</code> from URL to hide this panel.
          </div>
        </div>
      )}
    </div>
  );
}
