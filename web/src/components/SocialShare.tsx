import { useState } from "preact/hooks";
import type { Operator } from "../types";

interface Props {
  operators: Operator[];
  query: string;
}

/**
 * Tiny growth-hack widget that surfaces a copy-paste-ready Twitter/LinkedIn snippet
 * summarizing the just-completed run. The framing is "Apollo had 0, LongTail found N"
 * because that's the wedge — and it's also the shareable headline.
 */
function buildTweet(operators: Operator[], query: string): string {
  const n = operators.length;
  const withHiring = operators.filter(o => (o.hiring.count ?? 0) > 0).length;
  const withGeo = operators.filter(o => !!o.geo).length;
  const url = `https://longtailscout.com/?q=${encodeURIComponent(query.trim())}&run=1`;

  const lines: string[] = [];
  lines.push(`Just ran "${query.trim()}" through LongTail Scout.`);
  lines.push("");
  lines.push(`Apollo would have returned ~0 net-new long-tail accounts. We found ${n}.`);
  if (withHiring > 0) lines.push(`${withHiring} are actively hiring. ${withGeo > 0 ? `${withGeo} pinned on the map.` : ""}`);
  lines.push("");
  lines.push(`Live demo (free sample mode): ${url}&sample=1`);
  lines.push("");
  lines.push(`Built on @brightdata + @deepseek_ai for the Bright Data Web Data UNLOCKED hackathon.`);
  return lines.join("\n");
}

function buildLinkedIn(operators: Operator[], query: string): string {
  const n = operators.length;
  const withHiring = operators.filter(o => (o.hiring.count ?? 0) > 0).length;
  const top = operators.slice(0, 3).map(o => `· ${o.name}`).join("\n");
  const url = `https://longtailscout.com/?q=${encodeURIComponent(query.trim())}&run=1`;

  return [
    `Vertical-SaaS GTM teams are missing the long tail.`,
    ``,
    `I just ran "${query.trim()}" through LongTail Scout — an AI agent that finds local, niche operators that Apollo/ZoomInfo/Clay don't see (because their primary signal is the operator's own website, not LinkedIn).`,
    ``,
    `Found ${n} net-new accounts. ${withHiring > 0 ? `${withHiring} are hiring right now (clear demand signal).` : ""}`,
    ``,
    `Top picks:`,
    top,
    ``,
    `Live demo: ${url}`,
    ``,
    `Built for the Bright Data Web Data UNLOCKED hackathon. Stack: Bright Data Scraping Browser for SERPs + homepage renders, DeepSeek for ranking + ICP-fit reasoning, Cloudflare Workers + KV for the agent runtime.`,
    ``,
    `#hackathon #verticalsaas #brightdata`
  ].join("\n");
}

export function SocialShare({ operators, query }: Props) {
  const [open, setOpen] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (operators.length === 0) return null;

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch { /* ignore */ }
  }

  const tweet = buildTweet(operators, query);
  const linkedIn = buildLinkedIn(operators, query);

  return (
    <div class="rounded-lg border border-sky-200 bg-sky-50/40 p-3 shadow-sm">
      <button
        class="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setOpen(o => !o)}
        type="button"
      >
        <div class="flex items-center gap-2 text-sm">
          <span class="text-base">📣</span>
          <span class="font-medium text-sky-900">Share this run — pre-formatted snippets for Twitter / LinkedIn</span>
        </div>
        <span class={`text-sky-600 transition ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div class="mt-3 grid gap-3 md:grid-cols-2">
          <div class="rounded border border-sky-200 bg-white p-3">
            <div class="mb-2 flex items-center justify-between">
              <div class="text-xs font-medium uppercase text-sky-700">Twitter / X</div>
              <button
                class="rounded border border-sky-300 px-2 py-0.5 text-xs hover:bg-sky-50"
                onClick={() => copy("tweet", tweet)}
                type="button"
              >
                {copiedKey === "tweet" ? "✓ copied" : "Copy"}
              </button>
            </div>
            <pre class="whitespace-pre-wrap text-xs text-slate-700">{tweet}</pre>
            <div class="mt-1 text-[10px] text-sky-700/60">{tweet.length} chars</div>
          </div>
          <div class="rounded border border-sky-200 bg-white p-3">
            <div class="mb-2 flex items-center justify-between">
              <div class="text-xs font-medium uppercase text-sky-700">LinkedIn</div>
              <button
                class="rounded border border-sky-300 px-2 py-0.5 text-xs hover:bg-sky-50"
                onClick={() => copy("linkedin", linkedIn)}
                type="button"
              >
                {copiedKey === "linkedin" ? "✓ copied" : "Copy"}
              </button>
            </div>
            <pre class="whitespace-pre-wrap text-xs text-slate-700">{linkedIn}</pre>
            <div class="mt-1 text-[10px] text-sky-700/60">{linkedIn.length} chars</div>
          </div>
        </div>
      )}
    </div>
  );
}
