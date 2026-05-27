import { useEffect, useState } from "preact/hooks";

const STORAGE_KEY = "lts_byok_v1";

interface ByokKeys {
  deepseek?: string;
  openrouter?: string;
  glm?: string;
}

function load(): ByokKeys {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function save(k: ByokKeys) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(k)); } catch { /* ignore */ }
}

/** Inject BYOK headers onto every /api/* fetch from the page so the worker can pick them up.
 * This patches window.fetch on mount — runs once, before any scout call.
 */
let patched = false;
function installFetchPatch() {
  if (patched || typeof window === "undefined") return;
  patched = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (input: any, init?: any) => {
    let url = "";
    try {
      url = typeof input === "string" ? input : (input as Request).url ?? String(input);
    } catch { /* ignore */ }
    if (!url.includes("/api/")) return orig(input, init);
    const keys = load();
    if (!keys.deepseek && !keys.openrouter && !keys.glm) return orig(input, init);
    const headers = new Headers(init?.headers || (typeof input !== "string" ? (input as Request).headers : undefined));
    if (keys.deepseek) headers.set("x-byok-deepseek", keys.deepseek);
    if (keys.openrouter) headers.set("x-byok-openrouter", keys.openrouter);
    if (keys.glm) headers.set("x-byok-glm", keys.glm);
    return orig(input, { ...init, headers });
  };
}

/**
 * Bring-your-own-key panel. Lets a judge (or anyone) paste their own DeepSeek / OpenRouter / GLM
 * key. Keys stay in localStorage; sent to the worker as x-byok-* headers per request. The worker
 * prefers BYOK keys over its own env, so live scouts run on the user's budget.
 *
 * Only renders behind ?byok=1 in the URL — keeps the prod UI clean.
 */
export function ByokPanel() {
  const [keys, setKeys] = useState<ByokKeys>(() => load());
  const [open, setOpen] = useState<boolean>(false);
  const [saved, setSaved] = useState<boolean>(false);

  useEffect(() => { installFetchPatch(); }, []);

  function update<K extends keyof ByokKeys>(k: K, v: string) {
    const next = { ...keys, [k]: v.trim() || undefined };
    setKeys(next);
    save(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function clearAll() {
    setKeys({});
    save({});
  }

  const activeCount = Object.values(keys).filter(Boolean).length;

  return (
    <div class="border border-ink-20 bg-paper-2">
      <button
        class="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left"
        onClick={() => setOpen(o => !o)}
        type="button"
      >
        <div class="flex items-center gap-3">
          <span class="font-mono text-[10px] uppercase tracking-[0.16em] text-rust">§</span>
          <span class="font-serif text-base font-semibold text-ink">Bring your own keys</span>
          {activeCount > 0 && (
            <span class="font-mono text-[10px] uppercase tracking-wider bg-moss-tint text-moss-dk px-2 py-0.5">
              {activeCount} active
            </span>
          )}
        </div>
        <span class={`text-ink-50 transition ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div class="border-t border-ink-15 px-4 py-3 space-y-3 text-sm">
          <p class="text-xs text-ink-60 leading-relaxed">
            Paste your own LLM key and live scouts will run on <em>your</em> budget instead of ours. Keys stay in your browser's localStorage and are sent only to <code class="bg-paper-3 px-1 font-mono text-[11px]">longtailscout.com/api/*</code> via custom headers. The worker prefers your key when present.
          </p>
          <KeyRow
            label="DeepSeek"
            placeholder="sk-..."
            help="Primary LLM. Get a key at platform.deepseek.com."
            value={keys.deepseek ?? ""}
            onSave={(v) => update("deepseek", v)}
          />
          <KeyRow
            label="OpenRouter"
            placeholder="sk-or-..."
            help="Fallback gateway. Get a key at openrouter.ai/keys."
            value={keys.openrouter ?? ""}
            onSave={(v) => update("openrouter", v)}
          />
          <KeyRow
            label="GLM (Z.AI coding plan)"
            placeholder="...0wg1PnLu..."
            help="Fallback. Use the coding-plan API gateway URL."
            value={keys.glm ?? ""}
            onSave={(v) => update("glm", v)}
          />
          <div class="flex items-center justify-between pt-1">
            {saved && <span class="font-mono text-[11px] text-moss-dk">✓ saved locally</span>}
            <span class="flex-1" />
            {activeCount > 0 && (
              <button class="font-mono text-[11px] text-rust hover:text-rust-dk underline" onClick={clearAll}>
                clear all
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KeyRow({ label, placeholder, help, value, onSave }: { label: string; placeholder: string; help: string; value: string; onSave: (v: string) => void }) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <div>
      <label class="flex items-center justify-between mb-1">
        <span class="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-60">{label}</span>
        {value && <span class="font-mono text-[10px] text-moss-dk">···{value.slice(-4)}</span>}
      </label>
      <div class="flex gap-1">
        <input
          type="password"
          class="flex-1 bg-paper border border-ink-20 px-2 py-1.5 font-mono text-[12px] focus:border-ink focus:outline-none"
          placeholder={placeholder}
          value={local}
          onInput={(e) => setLocal((e.target as HTMLInputElement).value)}
        />
        <button
          class="bg-ink text-paper px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider hover:bg-ink-90 disabled:bg-ink-40"
          onClick={() => onSave(local)}
          disabled={local === value}
          type="button"
        >save</button>
      </div>
      <div class="font-mono text-[10px] text-ink-50 mt-0.5">{help}</div>
    </div>
  );
}
