import { useState, useRef, useEffect } from "preact/hooks";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  onShare?: () => void;
  disabled: boolean;
}

const PRESETS = [
  "roofing contractors in Houston",
  "HVAC contractors in Houston",
  "roofing contractors in Texas",
  "law firms in California",
  "MSPs in Florida",
  "dental practices in Houston",
  "auto body shops in Atlanta"
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

export function QueryForm({ value, onChange, onRun, onShare, disabled }: Props) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [shared, setShared] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);

  function handleShare() {
    if (!onShare) return;
    onShare();
    setShared(true);
    setTimeout(() => setShared(false), 1500);
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

  return (
    <div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <label class="block text-sm font-medium text-slate-700 mb-2">Niche × city</label>
      <div class="flex gap-2">
        <input
          class="flex-1 rounded border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
          type="text"
          value={value}
          onInput={(e) => onChange((e.target as HTMLInputElement).value)}
          placeholder="roofing contractors in Houston"
          disabled={disabled}
        />
        {supported && (
          <button
            class={`rounded border px-3 py-2 text-sm ${listening ? "border-red-500 bg-red-50 text-red-700 animate-pulse" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
            onClick={listening ? stopListening : startListening}
            disabled={disabled}
            type="button"
            title={listening ? "Stop listening" : "Voice input (Chrome/Edge)"}
            aria-label={listening ? "Stop voice input" : "Start voice input"}
          >
            {listening ? "● Listening" : "🎤"}
          </button>
        )}
        <button
          class="rounded bg-slate-900 px-4 py-2 text-white disabled:bg-slate-300"
          onClick={onRun}
          disabled={disabled}
        >
          {disabled ? "Running…" : "Run"}
        </button>
      </div>
      {onShare && value.trim().length > 0 && (
        <div class="mt-2 text-xs">
          <button
            class="text-slate-500 hover:text-slate-700 underline decoration-dotted"
            onClick={handleShare}
            title="Copy a shareable URL that auto-fills this query (and auto-runs)"
          >
            {shared ? "✓ Copied share URL" : "Copy share URL"}
          </button>
        </div>
      )}
      <div class="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span class="text-slate-400">Try:</span>
        {PRESETS.map(p => (
          <button
            class="rounded-full bg-slate-100 px-3 py-1 text-slate-700 hover:bg-slate-200 disabled:opacity-50"
            onClick={() => onChange(p)}
            disabled={disabled}
          >
            {p}
          </button>
        ))}
      </div>
      {(saved.length > 0 || value.trim().length > 0) && (
        <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span class="text-slate-400">Saved:</span>
          {saved.map(s => (
            <span class="inline-flex items-center gap-1 rounded-full bg-amber-50 ring-1 ring-amber-200 pl-3 pr-1 py-0.5">
              <button class="text-amber-900 hover:underline disabled:opacity-50" onClick={() => onChange(s)} disabled={disabled}>{s}</button>
              <button class="ml-1 rounded-full px-1 text-amber-600 hover:bg-amber-100" onClick={() => removeSaved(s)} disabled={disabled} title="Remove">×</button>
            </span>
          ))}
          {value.trim() && !saved.includes(value.trim()) && (
            <button class="rounded border border-slate-300 px-2 py-0.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50" onClick={addSaved} disabled={disabled} title="Save this query for one-click re-run">+ Save query</button>
          )}
        </div>
      )}
    </div>
  );
}
