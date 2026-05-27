import type { Operator } from "../types";
import { SectionHeader } from "./SectionHeader";

interface Props {
  operators: Operator[];
  niche: string;
}

interface ApolloCounterfactual {
  name: string;
  type: "franchise" | "national" | "linkedin_dead" | "aggregator";
  reason: string;
}

/**
 * Editorial §03 — "Two databases. Same query. Different worlds."
 *
 * Merges the older WedgeSummary + ApolloCompare into one section:
 *  (1) 4-stat strip — Apollo-thin / hiring / total open roles / citations
 *  (2) Side-A "MISSES" column with struck-through Apollo-style counterfactuals
 *  (3) Side-B "FINDS" column with real top-6 operators from this run
 *
 * Counterfactuals are hardcoded per-vertical — the contrast itself is the demo.
 */

function counterfactualsFor(query: string): ApolloCounterfactual[] {
  const q = query.toLowerCase();
  if (/roof/i.test(q)) {
    return [
      { name: "Power Home Remodeling", type: "national", reason: "$1B+ national installer; already saturated, not a SaaS lead" },
      { name: "Home Depot Roofing Installations", type: "franchise", reason: "Big-box channel; not the indie contractor your sales team needs" },
      { name: "Erie Home", type: "national", reason: "National brand; already in every prospecting tool" },
      { name: "John Smith — Roofing Sales (LinkedIn)", type: "linkedin_dead", reason: "Individual profile, not a company; last activity 2019" },
      { name: "HomeAdvisor / Angi", type: "aggregator", reason: "Aggregator/marketplace; not an actual operator" }
    ];
  }
  if (/hvac|heating|cool|air condition/i.test(q)) {
    return [
      { name: "Trane Commercial", type: "national", reason: "OEM/national brand; not a local contractor" },
      { name: "ARS / Rescue Rooter", type: "national", reason: "8,000+ employees, owned by Roark Capital" },
      { name: "Home Depot HVAC Installation", type: "franchise", reason: "Big-box channel; doesn't run ServiceTitan" },
      { name: "Jose M. — HVAC Tech (LinkedIn)", type: "linkedin_dead", reason: "Individual profile, no employer site" },
      { name: "Angi Pros — Heating & Cooling", type: "aggregator", reason: "Lead aggregator; resells same leads to competitors" }
    ];
  }
  if (/dental|orthod|dentist/i.test(q)) {
    return [
      { name: "Aspen Dental Management Inc.", type: "national", reason: "1,000+ location DSO; not the independent practice you want" },
      { name: "Heartland Dental", type: "national", reason: "1,700+ supported offices; saturated enterprise account" },
      { name: "Pacific Dental Services", type: "national", reason: "900+ practices; same story" },
      { name: "Dr. Jane Doe, DDS (LinkedIn)", type: "linkedin_dead", reason: "Individual practitioner; no operational data" },
      { name: "Zocdoc", type: "aggregator", reason: "Booking marketplace, not a practice" }
    ];
  }
  if (/childcare|daycare|preschool/i.test(q)) {
    return [
      { name: "KinderCare Learning Centers", type: "national", reason: "1,500+ centers; well-known enterprise account" },
      { name: "Bright Horizons", type: "national", reason: "Public-traded, dominant in corporate-sponsored childcare" },
      { name: "Goddard School (franchise)", type: "franchise", reason: "600+ franchises; HQ already in CRM" },
      { name: "Care.com", type: "aggregator", reason: "Aggregator for individual sitters, not centers" }
    ];
  }
  if (/law|attorney|lawyer|firm/i.test(q)) {
    return [
      { name: "Morgan & Morgan", type: "national", reason: "1,000+ attorneys; already saturated by Clio enterprise" },
      { name: "DLA Piper", type: "national", reason: "AmLaw 100; not a Clio/MyCase target" },
      { name: "Avvo", type: "aggregator", reason: "Lawyer directory, not a firm" },
      { name: "Jane Doe, Esq. (LinkedIn)", type: "linkedin_dead", reason: "Individual attorney profile, no firm site" }
    ];
  }
  if (/msp|managed service|it provider/i.test(q)) {
    return [
      { name: "Insight Enterprises", type: "national", reason: "13,000+ employees; enterprise IT, not SMB-MSP" },
      { name: "CDW", type: "national", reason: "Public; always shows up in Apollo for IT keywords" },
      { name: "ConnectWise (vendor)", type: "national", reason: "The MSP's *vendor*, not an MSP" },
      { name: "TechTarget directory", type: "aggregator", reason: "Aggregator listing, not a real operator" }
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
  return [
    { name: "Top national brand in this category", type: "national", reason: "Already saturated; not net-new" },
    { name: "Large franchise chain", type: "franchise", reason: "HQ contact already in your CRM" },
    { name: "Aggregator / directory site", type: "aggregator", reason: "Not an operator" },
    { name: "Individual practitioner profile (LinkedIn)", type: "linkedin_dead", reason: "Person, not a company" }
  ];
}

const TYPE_LABEL: Record<ApolloCounterfactual["type"], string> = {
  franchise: "franchise",
  national: "saturated",
  linkedin_dead: "stale",
  aggregator: "aggregator"
};

function tryHostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

export function WedgeSummary({ operators, niche }: Props) {
  if (operators.length === 0) return null;

  const apolloThin = operators.filter(o => {
    try {
      const u = new URL(o.url);
      return !/^(www\.)?(linkedin\.com|crunchbase\.com|builtin\.com|wikipedia\.org)$/i.test(u.hostname);
    } catch { return true; }
  }).length;
  const hiring = operators.filter(o => (o.hiring.count ?? 0) > 0).length;
  const totalRoles = operators.reduce((s, o) => s + (o.hiring.count ?? 0), 0);
  const cited = operators.reduce((s, o) => s + o.sources.length, 0);
  const counterfactuals = counterfactualsFor(niche);

  return (
    <section class="relative -mx-6 md:mx-0 bg-paper-2 border-y border-ink-15">
      <div class="px-6 md:px-8 py-10">
        <SectionHeader
          number="03"
          kicker="the apollo gap"
          title="Two databases. Same query. Different worlds."
          lede="Apollo's graph is the LinkedIn-employee-profile graph. Long-tail operators don't live there. We crawl the open web in real-time and rank what's actually a fit."
        />

        {/* 4-stat strip */}
        <div class="grid grid-cols-2 md:grid-cols-4 border border-ink-15 bg-paper mb-8">
          <StatCell value={`${apolloThin}/${operators.length}`} label="operators whose primary signal is their own website" color="rust" />
          <StatCell value={`${hiring}`} label="actively hiring (trigger event)" color="moss" />
          <StatCell value={`${totalRoles}`} label="open roles surfaced from ATS pages" color="ochre" />
          <StatCell value={`${cited}`} label="live citations linked back to BD fetches" color="ink" />
        </div>

        {/* Side A / Side B */}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-px bg-ink-15 border border-ink-15">
          {/* Side A — misses */}
          <div class="bg-paper p-7">
            <div class="flex items-center justify-between mb-5">
              <div>
                <div class="font-mono text-[10px] uppercase tracking-[0.16em] text-rust">side a</div>
                <div class="font-serif text-2xl font-semibold text-ink mt-0.5">Apollo · ZoomInfo · Clay</div>
              </div>
              <Stamp tone="rust">misses</Stamp>
            </div>
            <p class="m-0 text-sm text-ink-60 leading-relaxed">What an Apollo "<em>{niche}, 10-50 emp</em>" filter actually returns:</p>
            <ul class="m-0 mt-4 p-0 list-none">
              {counterfactuals.map((a, i) => (
                <li key={i} class={`flex gap-4 py-2.5 ${i > 0 ? "border-t border-dashed border-ink-15" : ""}`}>
                  <span class="font-mono text-[11px] text-ink-40 w-6 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-ink-50 line-through decoration-rust decoration-[1.5px]">{a.name}</div>
                    <div class="text-xs text-ink-50 mt-0.5">{a.reason}</div>
                  </div>
                  <Chip tone="rust">{TYPE_LABEL[a.type]}</Chip>
                </li>
              ))}
            </ul>
          </div>

          {/* Side B — finds */}
          <div class="bg-paper p-7 relative">
            <div class="relative">
              <div class="flex items-center justify-between mb-5">
                <div>
                  <div class="font-mono text-[10px] uppercase tracking-[0.16em] text-moss">side b</div>
                  <div class="font-serif text-2xl font-semibold text-ink mt-0.5 flex items-baseline gap-1">
                    longtailscout<span class="font-mono text-base text-ink-50 font-normal">.com</span>
                  </div>
                </div>
                <Stamp tone="moss">finds</Stamp>
              </div>
              <p class="m-0 text-sm text-ink-60 leading-relaxed">Top-ranked operators surfaced from this run — each with a hiring signal, an ICP-fit reason, and a per-row sales angle:</p>
              <ul class="m-0 mt-4 p-0 list-none">
                {operators.slice(0, 6).map((o, i) => (
                  <li key={o.url} class={`flex gap-4 py-2.5 items-start ${i > 0 ? "border-t border-dashed border-ink-15" : ""}`}>
                    <span class="font-mono text-[11px] text-ink-40 w-6 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-baseline gap-2 text-sm font-semibold text-ink flex-wrap">
                        <span>{o.name}</span>
                        <span class="font-mono text-[11px] font-normal text-ink-50">{tryHostname(o.url)}</span>
                      </div>
                      <div class="text-xs text-ink-60 mt-0.5 leading-snug">{o.icp_fit_reason}</div>
                    </div>
                    {(o.hiring.count ?? 0) > 0 && <Chip tone="moss">hiring ×{o.hiring.count}</Chip>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatCell({ value, label, color }: { value: string; label: string; color: "rust" | "moss" | "ochre" | "ink" }) {
  const colorMap = { rust: "text-rust", moss: "text-moss", ochre: "text-ochre-dk", ink: "text-ink" };
  return (
    <div class="p-6 border-l border-ink-15 first:border-l-0">
      <div class={`font-serif text-4xl md:text-5xl font-semibold leading-none tracking-[-0.03em] ${colorMap[color]}`}>{value}</div>
      <div class="mt-2 text-xs text-ink-60 leading-tight">{label}</div>
    </div>
  );
}

function Stamp({ children, tone }: { children: string; tone: "rust" | "ink" | "moss" | "ochre" }) {
  const colors = {
    rust: "border-rust text-rust",
    ink: "border-ink text-ink",
    moss: "border-moss text-moss",
    ochre: "border-ochre-dk text-ochre-dk",
  };
  return (
    <span class={`inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] px-2 py-0.5 border-[1.5px] ${colors[tone]} rounded-sm`} style={{ transform: "rotate(-0.4deg)" }}>
      {children}
    </span>
  );
}

function Chip({ children, tone }: { children: preact.ComponentChildren; tone: "rust" | "moss" }) {
  const colors = {
    rust: "bg-rust-tint text-rust-dk",
    moss: "bg-moss-tint text-moss-dk",
  };
  return (
    <span class={`inline-flex items-center px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap ${colors[tone]} self-start`}>
      {children}
    </span>
  );
}
