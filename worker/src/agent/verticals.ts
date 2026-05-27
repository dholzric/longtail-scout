/**
 * Vertical prompt packs — per-niche knowledge bundles injected into the discovery + synthesis prompts.
 *
 * Why: a generic agent works, but a vertical-aware agent feels uncanny. For roofing queries we know the buyers are
 * AccuLynx / JobNimbus / Roofr; the signals to look for are storm-restoration language, lead-tech roles, insurance-
 * claim handling, fleet size. For HVAC the buyers are ServiceTitan / HousecallPro and the signals shift to dispatch,
 * preventive-maintenance plans, and EPA cert mentions.
 *
 * Detection is keyword-based against the user's niche string. First match wins. Generic fallback if no match.
 */
export interface VerticalPack {
  id: string;
  label: string;
  matches: RegExp;
  /** Vertical-SaaS buyer companies an SDR at one of them would care about this list. Used in synthesis prompt. */
  buyer_examples: string[];
  /** Homepage-language clues that signal a fit for the buyer (what enrichment should emphasize). */
  signal_hints: string[];
  /** Example ICP-fit phrasings (≤15 words each). */
  icp_examples: string[];
  /** Additional discovery angles the discovery LLM should consider. */
  serp_angles: string[];
  /** Example draft outreach angles tied to this vertical's buyer. */
  sales_angle_examples: string[];
}

const ROOFING: VerticalPack = {
  id: "roofing",
  label: "roofing contractors",
  matches: /\b(roof(er|ing)?|shingle|gutters?)\b/i,
  buyer_examples: ["AccuLynx", "JobNimbus", "Roofr", "EagleView", "Hover", "CompanyCam"],
  signal_hints: [
    "storm-restoration / insurance-claim language",
    "GAF, CertainTeed, Owens Corning certifications",
    "fleet size / multiple trucks",
    "residential vs commercial focus",
    "lead-tech / project-manager / inspector hiring"
  ],
  icp_examples: [
    "Residential roofer, storm-restoration language",
    "Commercial roofing, multi-state operator",
    "Family-owned, A+ BBB, 25+ years",
    "Storm-chaser, insurance-claim heavy",
    "Multi-crew, hiring project managers"
  ],
  serp_angles: ["roofing contractors", "storm restoration roofing", "commercial roofing"],
  sales_angle_examples: [
    "3 lead-tech roles open + insurance-claim language → likely buying AccuLynx or JobNimbus for claim workflow.",
    "Multi-truck fleet + GAF certified → fits AccuLynx ICP for mid-market residential operators."
  ]
};

const HVAC: VerticalPack = {
  id: "hvac",
  label: "HVAC contractors",
  matches: /\bhvac|heating|cooling|air[\s-]?conditioning|furnace|hvacr\b/i,
  buyer_examples: ["ServiceTitan", "HousecallPro", "Jobber", "FieldEdge", "Workiz", "ServiceFusion"],
  signal_hints: [
    "preventive-maintenance plan / membership language",
    "EPA / NATE / 608 cert mentions",
    "24/7 emergency service",
    "dispatch / route / fleet language",
    "lead tech / install tech / service tech hiring"
  ],
  icp_examples: [
    "Residential HVAC, preventive-maintenance plans",
    "Multi-tech, EPA-certified, 24/7 emergency",
    "Light commercial + residential, growing fleet",
    "Family-owned, hiring install techs"
  ],
  serp_angles: ["HVAC contractors", "heating cooling installation", "air conditioning service"],
  sales_angle_examples: [
    "24/7 emergency service + 2 install-tech roles → ServiceTitan ICP for dispatch + maintenance-plan SaaS.",
    "Fleet of 8 trucks + preventive-maintenance program → fits HousecallPro / Jobber sweet spot."
  ]
};

const CHILDCARE: VerticalPack = {
  id: "childcare",
  label: "childcare providers",
  matches: /\b(childcare|daycare|preschool|early[\s-]?learning|kindergarten)\b/i,
  buyer_examples: ["Brightwheel", "Procare", "HiMama", "Lillio", "ChildcareCRM", "Famly"],
  signal_hints: [
    "NAEYC / Texas Rising Star accreditation",
    "ages served (infant / toddler / preschool)",
    "number of classrooms / capacity",
    "tuition transparency",
    "lead teacher / director / assistant hiring"
  ],
  icp_examples: [
    "Multi-classroom center, NAEYC accredited",
    "Faith-based preschool, 2 locations",
    "Bilingual daycare, infant-through-pre-K",
    "Family-run, hiring lead teachers"
  ],
  serp_angles: ["childcare centers", "preschool daycare", "early learning center"],
  sales_angle_examples: [
    "Hiring 2 lead teachers + NAEYC accredited → Brightwheel ICP for parent-comms SaaS.",
    "Multi-classroom + tuition listed → Procare ICP for billing + enrollment workflows."
  ]
};

const DENTAL: VerticalPack = {
  id: "dental",
  label: "dental practices",
  matches: /\b(dental|dentist|orthodont|invisalign|implant)\b/i,
  buyer_examples: ["Weave", "Dentrix", "Yapi", "Pearly", "LocalMed", "MyDentalAgency"],
  signal_hints: [
    "Invisalign / implants / cosmetic mentions",
    "insurance accepted (specific carriers)",
    "evening / weekend hours",
    "hygienist / dental-assistant hiring",
    "PPC / sponsored landing pages"
  ],
  icp_examples: [
    "Boutique cosmetic + Invisalign focus",
    "Family practice, evening hours, hiring hygienists",
    "Implant-heavy specialty, multi-doctor",
    "Pediatric dental, hiring assistants"
  ],
  serp_angles: ["dental practices", "Invisalign provider", "cosmetic dentist"],
  sales_angle_examples: [
    "Invisalign provider + hiring hygienists → Weave / Pearly ICP for patient-comms SaaS."
  ]
};

const AUTO_REPAIR: VerticalPack = {
  id: "auto_repair",
  label: "auto repair / body shops",
  matches: /\b(auto[\s-]?body|auto[\s-]?repair|collision|mechanic|car repair|tire shop)\b/i,
  buyer_examples: ["Tekmetric", "Shopmonkey", "Mitchell1", "AutoLeap", "CCC ONE", "BodyShop"],
  signal_hints: [
    "insurance-DRP language (State Farm, GEICO, Progressive)",
    "I-CAR / ASE certifications",
    "loaner / rental car mentions",
    "estimating / blueprinting language",
    "tech / estimator / parts-runner hiring"
  ],
  icp_examples: [
    "Collision shop, multi-DRP, I-CAR Gold",
    "Mechanical + tire, family-owned",
    "Multi-bay, hiring techs and estimators"
  ],
  serp_angles: ["auto body shops", "collision repair", "mechanic shop"],
  sales_angle_examples: [
    "I-CAR Gold + 2 DRP partnerships + hiring estimators → Tekmetric / Shopmonkey ICP."
  ]
};

const ELECTRICIAN: VerticalPack = {
  id: "electrician",
  label: "electrical contractors",
  matches: /\b(electrician|electrical contractor|electrical service)\b/i,
  buyer_examples: ["ServiceTitan", "Jobber", "FieldEdge", "Housecall Pro", "Workiz"],
  signal_hints: [
    "panel upgrade / EV charging / solar tie-in",
    "master / journeyman electrician credentials",
    "24/7 emergency",
    "smart-home language",
    "lead electrician / apprentice hiring"
  ],
  icp_examples: [
    "Residential electrical, EV-charger installs",
    "Service-call focused, 24/7 emergency",
    "Multi-state commercial + residential"
  ],
  serp_angles: ["electrical contractors", "electrician services"],
  sales_angle_examples: [
    "EV-charger installer + hiring apprentices → ServiceTitan ICP for trade-specific dispatch."
  ]
};

const PLUMBING: VerticalPack = {
  id: "plumbing",
  label: "plumbing contractors",
  matches: /\b(plumb(er|ing)|drain|sewer|water heater)\b/i,
  buyer_examples: ["ServiceTitan", "HousecallPro", "Jobber", "Workiz", "FieldEdge"],
  signal_hints: [
    "drain cleaning / sewer / hydro-jetting",
    "tankless water heater language",
    "24/7 emergency",
    "trenchless / repipe language",
    "service / install tech hiring"
  ],
  icp_examples: [
    "Residential plumber, 24/7 emergency",
    "Sewer / trenchless specialty",
    "Multi-truck, hiring service techs"
  ],
  serp_angles: ["plumbing contractors", "plumber services"],
  sales_angle_examples: [
    "Trenchless + hiring 3 service techs → HousecallPro / ServiceTitan ICP."
  ]
};

const GENERIC: VerticalPack = {
  id: "generic",
  label: "long-tail local service operators",
  matches: /.^/, // never matches — used as fallback
  buyer_examples: ["the vertical-SaaS GTM team selling into this niche"],
  signal_hints: [
    "size signals (team mentions, multi-location)",
    "hiring activity",
    "recent press / news",
    "certifications, partnerships, awards"
  ],
  icp_examples: [
    "Single-location, family-owned",
    "Multi-location, hiring",
    "Specialty operator, web-first"
  ],
  serp_angles: [],
  sales_angle_examples: [
    "Hiring 3 roles + recent press → likely needs the vertical-specific SaaS tool for this category."
  ]
};

const PACKS: VerticalPack[] = [ROOFING, HVAC, CHILDCARE, DENTAL, AUTO_REPAIR, ELECTRICIAN, PLUMBING];

export function detectVertical(niche: string): VerticalPack {
  for (const p of PACKS) {
    if (p.matches.test(niche)) return p;
  }
  return GENERIC;
}

export const ALL_PACKS = [...PACKS, GENERIC];
