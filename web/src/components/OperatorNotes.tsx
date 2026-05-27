import { useEffect, useState } from "preact/hooks";

/**
 * Private per-operator SDR scratchpad ("called Tuesday, no answer", "sent email 11/14").
 * localStorage keyed by operator URL. Per-browser, no server roundtrip.
 */
const KEY_PREFIX = "lts_note:";

function load(url: string): string {
  try { return localStorage.getItem(KEY_PREFIX + url) ?? ""; } catch { return ""; }
}

function save(url: string, text: string): void {
  try {
    if (text.trim()) localStorage.setItem(KEY_PREFIX + url, text);
    else localStorage.removeItem(KEY_PREFIX + url);
  } catch { /* ignore */ }
}

export function OperatorNotes({ opUrl }: { opUrl: string }) {
  const [text, setText] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [hasContent, setHasContent] = useState(false);

  useEffect(() => {
    const initial = load(opUrl);
    setText(initial);
    setHasContent(initial.length > 0);
  }, [opUrl]);

  function onInput(e: Event) {
    const v = (e.target as HTMLTextAreaElement).value;
    setText(v);
    save(opUrl, v);
    setSavedAt(Date.now());
    setHasContent(v.length > 0);
  }

  return (
    <div class="mt-3 rounded border border-slate-200 bg-white p-3">
      <div class="flex items-center justify-between mb-2">
        <div class="text-xs font-medium uppercase text-slate-500">SDR notes {hasContent && <span class="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" title="Has saved notes" />}</div>
        {savedAt && <div class="text-[10px] text-slate-400">saved · stays in your browser</div>}
      </div>
      <textarea
        class="w-full rounded border border-slate-200 px-2 py-1 text-sm focus:border-slate-400 focus:outline-none resize-y"
        rows={2}
        placeholder="e.g. called Tuesday 11/12, no answer; LI msg sent to owner; sent intro email 11/14"
        value={text}
        onInput={onInput}
      />
    </div>
  );
}
