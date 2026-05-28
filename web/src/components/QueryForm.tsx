import { useState, useRef, useEffect } from "preact/hooks";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  onRunWith?: (q: string) => void;
  onShare?: () => void;
  disabled: boolean;
}

interface Preset {
  label: string;
  query: string;
  emoji: string;
}

// Curated demo set: each is a niche × city our index has strong coverage on, picked
// to span verticals (services, professional, healthcare, B2B). The emoji is purely
// for visual scanning during a judge's first 5 seconds.
const PRESETS: Preset[] = [
  { emoji: "🏚️", label: "Roofing · Houston", query: "roofing contractors in Houston" },
  { emoji: "❄️", label: "HVAC · Dallas", query: "HVAC contractors in Dallas" },
  { emoji: "🦷", label: "Dental · Houston", query: "dental practices in Houston" },
  { emoji: "👶", label: "Childcare · Austin", query: "childcare centers in Austin" },
  { emoji: "⚖️", label: "Law firms · CA", query: "law firms in California" },
  { emoji: "💼", label: "MSPs · Florida", query: "MSPs in Florida" },
  { emoji: "🔧", label: "Auto repair · Atlanta", query: "auto body shops in Atlanta" },
  { emoji: "🏨", label: "Hotels · Miami", query: "boutique hotels in Miami" }
];

const SAVED_KEY = "lts_saved_queries";

function loadSaved(): string[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.filter((s: unknown): s is string => typeof s === "string").slice(0, 12);
  } catch { /* fall through */ }
  return [];
}

function saveSaved(queries: string[]): void {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(queries.slice(0, 12))); } catch { /* ignore */ }
}

// Web Speech API — Chrome/Edge ship it natively. Free, no partner integration needed.
// We treat speech as a swappable input layer (Speechmatics would slot in here if we wanted
// production-grade accuracy + language detection).
interface SpeechRec {
  start(): void;
  stop(): void;
  onresult: ((e: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: any) => void) | null;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
}

function getSpeechRec(): SpeechRec | null {
  const w = window as any;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  return new Ctor() as SpeechRec;
}

export function QueryForm({ value, onChange, onRun, onRunWith, onShare, disabled }: Props) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [shared, setShared] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);

  function handleShare() {
    if (!onShare) return;
    onShare();
    setShared(true);
    setTimeout(() => setShared(false), 1500);
  }

  function copyEmbedCode() {
    const q = value.trim();
    if (!q) return;
    // Paste-into-blog-post iframe pointing at the embed-mode app. Sample mode by default so the
    // page doesn't burn scout dollars every time someone scrolls past it; viewers can re-run live
    // from inside the iframe if they want.
    const src = `https://longtailscout.com/?q=${encodeURIComponent(q)}&embed=1&sample=1`;
    const snippet = `<iframe src="${src}" width="100%" height="800" frameborder="0" style="border:1px solid #DBD4C7;border-radius:4px" title="LongTail Scout — ${q.replace(/"/g, "&quot;")}"></iframe>`;
    navigator.clipboard?.writeText(snippet).then(() => {
      setEmbedCopied(true);
      setTimeout(() => setEmbedCopied(false), 1800);
    }).catch(() => {});
  }

  useEffect(() => {
    setSupported(getSpeechRec() !== null);
    setSaved(loadSaved());
  }, []);

  function addSaved() {
    const v = value.trim();
    if (!v) return;
    if (saved.includes(v)) return;
    const next = [v, ...saved].slice(0, 12);
    setSaved(next);
    saveSaved(next);
  }

  function removeSaved(s: string) {
    const next = saved.filter(x => x !== s);
    setSaved(next);
    saveSaved(next);
  }

  function startListening() {
    const rec = getSpeechRec();
    if (!rec) return;
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      onChange((final || interim).trim());
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    recRef.current = rec;
    setListening(true);
  }

  function stopListening() {
    recRef.current?.stop();
    setListening(false);
  }

  const [focused, setFocused] = useState(false);
  return (
    <div>
      {/* Section header for §01 */}
      <div class="mb-5">
        <div class="flex items-center gap-3 mb-3 font-mono text-[10px] uppercase tracking-[0.16em]">
          <span class="text-rust">§ 01</span>
          <span class="inline-block h-px w-6 bg-ink-25" />
          <span class="text-ink-60">the query</span>
        </div>
        <h2 class="font-serif text-3xl font-semibold tracking-tight text-ink leading-tight">One niche, one city.</h2>
        <p class="mt-2 text-sm text-ink-70 max-w-3xl">The scout fires 3-4 parallel Bright Data SERPs, renders each candidate's homepage + careers + news, and ranks. Every fact below is footnoted back to the fetch that produced it.</p>
      </div>

      {/* Field-manual input card */}
      <div
        class="bg-paper-2 border border-ink-25 p-1 flex items-stretch gap-0 transition-shadow"
        style={focused ? { boxShadow: "0 0 0 3px color-mix(in oklab, var(--rust) 18%, transparent)" } : {}}
      >
        <div class="flex items-center px-4 text-ink-60" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="7" cy="13" r="4" />
            <circle cx="17" cy="13" r="4" />
            <path d="M11 13 L13 13" />
            <path d="M5 4 L7 7" /><path d="M19 4 L17 7" />
          </svg>
        </div>
        <div class="flex-1 flex flex-col justify-center py-3">
          <label class="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50">niche × city</label>
          <input
            class="border-0 outline-none bg-transparent pt-0.5 font-serif text-2xl font-medium text-ink tracking-tight w-full"
            type="text"
            value={value}
            onInput={(e) => onChange((e.target as HTMLInputElement).value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="roofing contractors in Houston"
            disabled={disabled}
          />
        </div>
        <div class="flex items-center gap-2 px-2.5 py-2.5">
          {supported && (
            <button
              class={`px-3 py-3 font-mono text-xs font-semibold transition ${listening ? "bg-rust-tint text-rust-dk animate-pulse" : "bg-transparent text-ink-60 hover:text-ink hover:bg-paper-3"}`}
              onClick={listening ? stopListening : startListening}
              disabled={disabled}
              type="button"
              title={listening ? "Stop listening" : "Voice input (Chrome/Edge)"}
              aria-label={listening ? "Stop voice input" : "Start voice input"}
            >
              {listening ? "● rec" : "🎤"}
            </button>
          )}
          <button
            class="inline-flex items-center gap-2 bg-ink text-paper border-0 px-5 py-3.5 font-mono text-xs font-semibold uppercase tracking-[0.12em] cursor-pointer disabled:bg-ink-40"
            onClick={onRun}
            disabled={disabled}
          >
            {disabled ? "running…" : "run scout"}
            <span aria-hidden="true">→</span>
          </button>
          <span class="hidden md:inline-flex items-center gap-1 font-mono text-[10px] text-ink-50">⌘ + ⏎</span>
        </div>
      </div>

      {/* Demo chips + share URL row */}
      <div class="mt-4 flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center gap-2 font-mono text-[11px] text-ink-50 flex-wrap">
          <span class="uppercase tracking-[0.12em]">try:</span>
          {PRESETS.map(p => (
            <button
              class="inline-flex items-center gap-1.5 bg-transparent border border-ink-20 px-2.5 py-1 font-sans text-[11px] text-ink-80 hover:bg-ink hover:text-paper hover:border-ink transition rounded-full whitespace-nowrap disabled:opacity-50"
              onClick={() => {
                onChange(p.query);
                if (onRunWith) onRunWith(p.query);
              }}
              disabled={disabled}
              title={`Run "${p.query}"`}
              type="button"
            >
              <span aria-hidden="true">{p.emoji}</span>
              <span>{p.label}</span>
            </button>
          ))}
        </div>
        {value.trim().length > 0 && (
          <div class="flex items-center gap-3 font-mono text-[11px] text-ink-50">
            {onShare && (
              <button
                class="hover:text-ink border-b border-dotted border-ink-30"
                onClick={handleShare}
                title="Copy a shareable URL that auto-fills this query (and auto-runs). The URL unfurls into a branded OG card in Slack / Twitter / Discord."
              >
                {shared ? "✓ copied share URL" : "🔗 copy share URL"}
              </button>
            )}
            <button
              class="hover:text-ink border-b border-dotted border-ink-30"
              onClick={copyEmbedCode}
              title="Copy an iframe snippet you can paste into a blog, slide, or marketing page. Renders the scout result inline without the surrounding chrome."
              type="button"
            >
              {embedCopied ? "✓ embed code copied" : "📋 embed code"}
            </button>
          </div>
        )}
      </div>

      {/* Saved queries — kept as a less-prominent strip below */}
      {(saved.length > 0 || (value.trim().length > 0 && !PRESETS.some(p => p.query === value.trim()))) && (
        <div class="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px]">
          <span class="text-ink-50 uppercase tracking-[0.12em]">saved:</span>
          {saved.map(s => (
            <span class="inline-flex items-center gap-1 rounded-full bg-ochre-tint border border-ochre/40 pl-2.5 pr-1 py-0.5">
              <button class="font-sans text-[11px] text-ochre-dk hover:underline disabled:opacity-50" onClick={() => onChange(s)} disabled={disabled}>{s}</button>
              <button class="ml-1 rounded-full px-1 text-ochre-dk hover:bg-ochre-tint" onClick={() => removeSaved(s)} disabled={disabled} title="Remove">×</button>
            </span>
          ))}
          {value.trim() && !saved.includes(value.trim()) && (
            <button class="rounded border border-ink-25 bg-transparent px-2 py-0.5 text-ink-60 hover:bg-paper-3 disabled:opacity-50" onClick={addSaved} disabled={disabled} title="Save this query for one-click re-run">+ save query</button>
          )}
        </div>
      )}
    </div>
  );
}
