import { useState } from "preact/hooks";
import type { Operator } from "../types";

/**
 * Side-by-side wedge proof: hardcoded "what Apollo would have returned" per niche,
 * juxtaposed with what LongTail Scout actually returned. The Apollo column is
 * deliberately the kind of national/franchise/dead-LinkedIn-profile result that
 * vertical-SaaS GTM teams have already exhausted — it's the negative space the
 * pitch deck talks about, made concrete.
 *
 * We don't query Apollo (no API key, not the point). The contrast itself is the
 * demo: same query, very different answers.
 */
interface ApolloCounterfactual {
  name: string;
  type: "franchise" | "national" | "linkedin_dead" | "aggregator";
  reason: string;
}

function nicheLower(q: string): string {
  return q.toLowerCase();
}

function counterfactualsFor(query: string): ApolloCounterfactual[] {
  const q = nicheLower(query);
  if (/roof/i.test(q)) {
    return [
      { name: "Power Home Remodeling", type: "national", reason: "$1B+ national installer; already saturated, not a SaaS lead" },
      { name: "Home Depot Roofing Installations", type: "franchise", reason: "Big-box channel; not the indie contractor your sales team needs" },
      { name: "Erie Home (formerly Erie Metal Roofs)", type: "national", reason: "National brand; already in every prospecting tool" },
      { name: "John Smith — Roofing Sales (LinkedIn)", type: "linkedin_dead", reason: "Individual profile, not a company; last activity 2019" },
      { name: "HomeAdvisor / Angi", type: "aggregator", reason: "Aggregator/marketplace; not an actual operator" }
    ];
  }
  if (/hvac|heating|cool|air condition/i.test(q)) {
    return [
      { name: "Trane Commercial", type: "national", reason: "OEM/national brand; not a local contractor" },
      { name: "ARS / Rescue Rooter (American Residential Services)", type: "national", reason: "8,000+ employees, owned by Roark Capital — Apollo's bread and butter" },
      { name: "Home Depot HVAC Installation", type: "franchise", reason: "Big-box channel; doesn't run ServiceTitan" },
      { name: "Jose M. — HVAC Tech (LinkedIn)", type: "linkedin_dead", reason: "Individual profile, no employer site" },
      { name: "Angi Pros — Heating & Cooling", type: "aggregator", reason: "Lead aggregator; will resell same leads to your competitors" }
    ];
  }
  if (/dental|orthod|dentist/i.test(q)) {
    return [
      { name: "Aspen Dental Management Inc.", type: "national", reason: "1,000+ location DSO; not the independent practice you want for an Acuity/SmileDirect-style sell" },
      { name: "Heartland Dental", type: "national", reason: "1,700+ supported offices nationally — already a top-3 enterprise account everywhere" },
      { name: "Pacific Dental Services", type: "national", reason: "900+ practices; same story" },
      { name: "Dr. Jane Doe, DDS (LinkedIn)", type: "linkedin_dead", reason: "Individual practitioner; no operational data" },
      { name: "Zocdoc", type: "aggregator", reason: "Booking marketplace, not a practice" }
    ];
  }
  if (/childcare|daycare|preschool/i.test(q)) {
    return [
      { name: "KinderCare Learning Centers", type: "national", reason: "1,500+ centers; well-known enterprise account" },
      { name: "Bright Horizons", type: "national", reason: "Public-traded, dominant in corporate-sponsored childcare" },
      { name: "Goddard School (franchise)", type: "franchise", reason: "600+ franchises; HQ contact already in every CRM" },
      { name: "Care.com", type: "aggregator", reason: "Aggregator for individual sitters, not centers" }
    ];
  }
  if (/law|attorney|lawyer|firm/i.test(q)) {
    return [
      { name: "Morgan & Morgan", type: "national", reason: "1,000+ attorneys nationwide; already saturated by Clio's enterprise team" },
      { name: "DLA Piper", type: "national", reason: "AmLaw 100; not a Clio/MyCase target" },
      { name: "Avvo", type: "aggregator", reason: "Lawyer directory, not a firm" },
      { name: "Jane Doe, Esq. (LinkedIn)", type: "linkedin_dead", reason: "Individual attorney profile, no firm site" }
    ];
  }
  if (/msp|managed service|it provider/i.test(q)) {
    return [
      { name: "Insight Enterprises", type: "national", reason: "13,000+ employees; enterprise IT, not SMB-MSP segment" },
      { name: "CDW", type: "national", reason: "Public; not an MSP, but always shows up in Apollo for IT keywords" },
      { name: "ConnectWise (vendor)", type: "national", reason: "The MSP's *vendor*, not an MSP" },
      { name: "TechTarget / IT companies directory", type: "aggregator", reason: "Aggregator listing, not a real operator" }
    ];
  }
  if (/auto|car|repair|body shop|mechanic/i.test(q)) {
    return [
      { name: "Jiffy Lube", type: "franchise", reason: "2,000+ franchise locations; HQ already in CRM" },
      { name: "Pep Boys", type: "national", reason: "Owned by Icahn Automotive; nationwide chain" },
      { name: "Caliber Collision", type: "national", reason: "1,500+ centers; PE-rolled-up enterprise" },
      { name: "RepairPal", type: "aggregator", reason: "Aggregator/directory" }
    ];
  }
  // Generic fallback — still illustrates the wedge
  return [
    { name: "Top national brand in this category", type: "national", reason: "Already saturated; not net-new" },
    { name: "Large franchise chain", type: "franchise", reason: "HQ contact already in your CRM" },
    { name: "Aggregator / directory site", type: "aggregator", reason: "Not an operator" },
    { name: "Individual practitioner profile (LinkedIn)", type: "linkedin_dead", reason: "Person, not a company; not actionable" }
  ];
}

const TYPE_BADGE: Record<ApolloCounterfactual["type"], { label: string; color: string }> = {
  franchise: { label: "Franchise", color: "bg-amber-100 text-amber-800 ring-amber-200" },
  national: { label: "National enterprise", color: "bg-rose-100 text-rose-800 ring-rose-200" },
  linkedin_dead: { label: "LinkedIn-dead", color: "bg-slate-200 text-slate-700 ring-slate-300" },
  aggregator: { label: "Aggregator", color: "bg-violet-100 text-violet-700 ring-violet-200" }
};

interface Props {
  operators: Operator[];
  query: string;
}

export function ApolloCompare({ operators, query }: Props) {
  const [open, setOpen] = useState<boolean>(false);
  if (operators.length === 0) return null;
  const cf = counterfactualsFor(query);
  if (cf.length === 0) return null;

  const longtailFirstFour = operators.slice(0, 4);

  return (
    <div class="rounded-lg border border-slate-200 bg-white shadow-sm">
      <button
        class="flex w-full items-center justify-between gap-3 px-6 py-3 text-left"
        onClick={() => setOpen(o => !o)}
        type="button"
      >
        <div>
          <div class="text-sm font-semibold text-slate-900">Apollo vs LongTail Scout — side-by-side</div>
          <div class="text-xs text-slate-500">Same query, very different answers. {open ? "Click to hide." : "Click to expand."}</div>
        </div>
        <span class={`inline-block transition ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div class="grid gap-4 border-t border-slate-200 p-6 md:grid-cols-2">
          <div>
            <div class="mb-2 text-xs font-medium uppercase tracking-wide text-rose-700">
              ← What Apollo/ZoomInfo/Clay would surface
            </div>
            <ul class="space-y-2">
              {cf.map((c, i) => (
                <li key={i} class="rounded border border-rose-100 bg-rose-50/30 px-3 py-2">
                  <div class="flex items-center gap-2 text-sm">
                    <span class="font-medium text-slate-800 line-through decoration-rose-400/40">{c.name}</span>
                    <span class={`ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${TYPE_BADGE[c.type].color}`}>
                      {TYPE_BADGE[c.type].label}
                    </span>
                  </div>
                  <div class="mt-1 text-xs text-slate-500">{c.reason}</div>
                </li>
              ))}
            </ul>
            <div class="mt-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              <strong>The problem:</strong> your GTM team has already worked these accounts. They're saturated, OEMs not operators, or individual LinkedIn profiles with no actionable signal.
            </div>
          </div>
          <div>
            <div class="mb-2 text-xs font-medium uppercase tracking-wide text-emerald-700">
              LongTail Scout returned →
            </div>
            <ul class="space-y-2">
              {longtailFirstFour.map((op, i) => (
                <li key={i} class="rounded border border-emerald-100 bg-emerald-50/30 px-3 py-2">
                  <div class="flex items-center gap-2 text-sm">
                    <span class="font-medium text-slate-900">{op.name}</span>
                    <a class="text-xs text-blue-700 underline" href={op.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{(() => { try { return new URL(op.url).hostname.replace(/^www\./, ""); } catch { return op.url; } })()}</a>
                    <span class="ml-auto inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800 ring-1 ring-emerald-200">
                      Local indie
                    </span>
                  </div>
                  <div class="mt-1 text-xs text-slate-600">{op.icp_fit_reason}</div>
                </li>
              ))}
              {operators.length > 4 && (
                <li class="text-xs text-emerald-700 italic px-3">+ {operators.length - 4} more long-tail operators in the table below</li>
              )}
            </ul>
            <div class="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              <strong>The wedge:</strong> these are SMB operators with a real website + hiring signal + geo-pinned location. They run the vertical-SaaS your buyers sell — but your buyers have never heard of them.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
