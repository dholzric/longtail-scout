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

const LEGAL: VerticalPack = {
  id: "legal",
  label: "law firms / attorneys",
  matches: /\b(law(yer)?|attorney|legal|paralegal|esquire|llc law|law firm)\b/i,
  buyer_examples: ["Clio", "MyCase", "PracticePanther", "Smokeball", "Filevine", "LawPay"],
  signal_hints: [
    "practice areas listed (personal injury, family, criminal, etc.)",
    "free consultation / contingency fee language",
    "attorney count / partner-associate structure",
    "AV-rated / super-lawyers / state bar mentions",
    "paralegal / intake / associate hiring"
  ],
  icp_examples: [
    "Solo practitioner, hourly billing",
    "Multi-attorney plaintiff firm, contingency",
    "Boutique family-law practice, 3-5 attorneys",
    "Estate planning, fixed-fee tiers"
  ],
  serp_angles: ["law firms", "personal injury attorney", "family law attorney"],
  sales_angle_examples: [
    "Contingency-fee personal injury firm + hiring paralegals → Filevine / Clio ICP for case management."
  ]
};

const MSP: VerticalPack = {
  id: "msp",
  label: "MSPs / managed IT providers",
  matches: /\b(msp|managed (it|service)|it support|cybersecurity|it services?|it consulting)\b/i,
  buyer_examples: ["ConnectWise", "NinjaOne", "Datto", "Atera", "SyncroMSP", "Kaseya"],
  signal_hints: [
    "24/7 monitoring / NOC language",
    "MSP / MSSP / co-managed IT terminology",
    "compliance: SOC 2, HIPAA, PCI mentions",
    "endpoint / RMM / EDR mentions",
    "technician / network engineer / SOC analyst hiring"
  ],
  icp_examples: [
    "20-100 endpoint MSP, SMB-focused",
    "MSSP with cybersecurity practice",
    "Co-managed IT for mid-market",
    "Healthcare-vertical MSP, HIPAA-aware"
  ],
  serp_angles: ["managed it services", "MSP IT support", "cybersecurity services"],
  sales_angle_examples: [
    "24/7 NOC + HIPAA compliance + hiring SOC analysts → NinjaOne / ConnectWise ICP for RMM + ticketing."
  ]
};

const ACCOUNTING: VerticalPack = {
  id: "accounting",
  label: "accountants / CPA firms",
  matches: /\b(cpa|accountant|tax(es)?|bookkeep|payroll|accounting firm|tax prep)\b/i,
  buyer_examples: ["Karbon", "Jirav", "TaxDome", "Canopy", "FreshBooks", "Botkeeper", "Liscio"],
  signal_hints: [
    "CPA designation, multi-partner structure",
    "QuickBooks ProAdvisor / Xero certified mentions",
    "small-business / individual / advisory specialties",
    "tax season hiring (Jan-Apr)",
    "fractional CFO / advisory packages"
  ],
  icp_examples: [
    "Small CPA firm, business tax + payroll",
    "Bookkeeping + tax shop, 5-15 staff",
    "Advisory-led firm, fractional CFO services",
    "Solo practitioner, individual returns"
  ],
  serp_angles: ["CPA firm", "accounting firm small business", "tax preparation services"],
  sales_angle_examples: [
    "QuickBooks ProAdvisor + 5-staff bookkeeping shop → Karbon / TaxDome ICP for client management."
  ]
};

const FITNESS: VerticalPack = {
  id: "fitness",
  label: "fitness studios / gyms",
  matches: /\b(gym|fitness|crossfit|yoga|pilates|spin|personal train(er|ing)|wellness studio)\b/i,
  buyer_examples: ["Mindbody", "ClassPass", "Wodify", "Glofox", "Trainerize", "Push Press"],
  signal_hints: [
    "class schedule visible (group fitness)",
    "membership tiers / drop-in pricing",
    "personal trainer / coach roster",
    "specialties: CrossFit / yoga / barre / spin",
    "trainer / coach / front-desk hiring"
  ],
  icp_examples: [
    "Boutique studio, group classes + PT",
    "Multi-location yoga / pilates",
    "CrossFit affiliate, 60-200 members",
    "Specialty wellness studio, hybrid in-person + virtual"
  ],
  serp_angles: ["yoga studio", "CrossFit gym", "personal training studio"],
  sales_angle_examples: [
    "CrossFit affiliate with 4 coaches + hiring front-desk → Wodify / Push Press ICP."
  ]
};

const RESTAURANT: VerticalPack = {
  id: "restaurant",
  label: "restaurants / food service",
  matches: /\b(restaurant|cafe|bistro|eatery|food truck|catering|deli|bakery|pizzeria)\b/i,
  buyer_examples: ["Toast", "Square for Restaurants", "Resy", "OpenTable", "Olo", "Lavu", "TouchBistro"],
  signal_hints: [
    "cuisine type listed clearly",
    "online ordering / delivery integrations",
    "multi-location signals",
    "reservation system mention",
    "server / line cook / GM hiring"
  ],
  icp_examples: [
    "Multi-location casual dining",
    "Independent fine-dining, reservation-led",
    "Fast casual chain, 3-15 locations",
    "Food truck → brick-and-mortar transition"
  ],
  serp_angles: ["restaurants", "fast casual chain", "independent restaurant"],
  sales_angle_examples: [
    "3 locations + DoorDash/UberEats + hiring 2 GMs → Toast / Olo ICP for multi-location POS."
  ]
};

const HOTEL: VerticalPack = {
  id: "hotel",
  label: "boutique hotels / inns",
  matches: /\b(hotel|inn|bed[\s-]?and[\s-]?breakfast|b&b|boutique hotel|guesthouse|lodge)\b/i,
  buyer_examples: ["Cloudbeds", "Mews", "RoomRaccoon", "Stayflexi", "innRoad", "Little Hotelier"],
  signal_hints: [
    "room count (< 100 = boutique)",
    "direct booking emphasis",
    "amenities (breakfast, pet-friendly, spa)",
    "channel manager / OTA language",
    "front-desk / housekeeping / GM hiring"
  ],
  icp_examples: [
    "Boutique < 50-room property",
    "Family-owned inn, 12-30 rooms",
    "Vacation rental cluster, 5-15 units",
    "Eco-lodge / specialty property"
  ],
  serp_angles: ["boutique hotel", "inn bed and breakfast", "small hotel"],
  sales_angle_examples: [
    "30-room boutique inn + direct-booking widget + hiring housekeeping → Cloudbeds / Mews ICP."
  ]
};

const REAL_ESTATE: VerticalPack = {
  id: "real_estate",
  label: "real estate agents / brokerages",
  matches: /\b(realtor|real estate|realty|broker(age)?|mls|home buyer|home seller)\b/i,
  buyer_examples: ["Follow Up Boss", "BoomTown", "kvCORE", "Chime", "LionDesk", "Top Producer", "Sierra Interactive"],
  signal_hints: [
    "agent count visible",
    "MLS / area-specific expertise",
    "brokerage affiliation (Keller Williams, RE/MAX, Compass, indie)",
    "luxury / first-time-buyer / investor focus",
    "agent / showing-coordinator hiring"
  ],
  icp_examples: [
    "Small brokerage, 5-25 agents, indie",
    "Luxury team within a national brand",
    "Investor / wholesaler specialist",
    "First-time-buyer focused, FHA-friendly"
  ],
  serp_angles: ["real estate broker", "realtor team", "boutique brokerage"],
  sales_angle_examples: [
    "15-agent indie brokerage + hiring showing-coordinator → kvCORE / Follow Up Boss ICP for team CRM."
  ]
};

const LANDSCAPING: VerticalPack = {
  id: "landscaping",
  label: "landscaping / lawn-care companies",
  matches: /\b(landscap(e|ing|er)|lawn care|tree service|hardscap|irrigation|grounds keep)\b/i,
  buyer_examples: ["SingleOps", "Aspire", "LMN", "Service Autopilot", "Real Green", "Jobber"],
  signal_hints: [
    "residential vs commercial focus",
    "design / build / maintenance services",
    "fleet size / multiple trucks",
    "irrigation / hardscape / tree-service add-ons",
    "crew lead / foreman / designer hiring"
  ],
  icp_examples: [
    "Multi-crew residential landscape company",
    "Design/build + maintenance hybrid",
    "Commercial grounds-keeping, large fleet",
    "Tree service specialty + ISA-certified arborist"
  ],
  serp_angles: ["landscaping company", "lawn care service", "landscape design build"],
  sales_angle_examples: [
    "4-crew residential landscape + design-build + hiring foreman → Aspire / SingleOps ICP."
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

const PACKS: VerticalPack[] = [
  ROOFING, HVAC, CHILDCARE, DENTAL, AUTO_REPAIR, ELECTRICIAN, PLUMBING,
  LEGAL, MSP, ACCOUNTING, FITNESS, RESTAURANT, HOTEL, REAL_ESTATE, LANDSCAPING
];

export function detectVertical(niche: string): VerticalPack {
  for (const p of PACKS) {
    if (p.matches.test(niche)) return p;
  }
  return GENERIC;
}

export const ALL_PACKS = [...PACKS, GENERIC];
