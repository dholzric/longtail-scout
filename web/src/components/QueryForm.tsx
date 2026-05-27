import { useState, useRef, useEffect } from "preact/hooks";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  disabled: boolean;
}

const PRESETS = [
  "roofing contractors in Houston",
  "HVAC contractors in Houston",
  "dental practices in Houston",
  "childcare providers in Houston",
  "auto body shops in Houston",
  "electrician contractors in Dallas"
];

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

export function QueryForm({ value, onChange, onRun, disabled }: Props) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);

  useEffect(() => {
    setSupported(getSpeechRec() !== null);
  }, []);

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
      <div class="mt-3 flex flex-wrap gap-2 text-xs">
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
    </div>
  );
}
