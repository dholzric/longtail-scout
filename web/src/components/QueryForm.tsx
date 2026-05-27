interface Props {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  disabled: boolean;
}

const PRESETS = [
  "aerospace and space-tech companies in Houston",
  "solar installers in Texas",
  "AI consulting firms in San Francisco"
];

export function QueryForm({ value, onChange, onRun, disabled }: Props) {
  return (
    <div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <label class="block text-sm font-medium text-slate-700 mb-2">Niche × city</label>
      <div class="flex gap-2">
        <input
          class="flex-1 rounded border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
          type="text"
          value={value}
          onInput={(e) => onChange((e.target as HTMLInputElement).value)}
          placeholder="aerospace companies in Houston"
          disabled={disabled}
        />
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
