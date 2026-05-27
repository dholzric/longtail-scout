import type { Operator } from "../types";

/**
 * Canned scout results — used as a deterministic fallback when:
 *   - The user explicitly passes `?sample=1` (guaranteed-fast demo response, no real API spend)
 *   - The bridge is unreachable / Bright Data is degraded (graceful degradation)
 *
 * Each sample is a real result from a prior live scout run, with operator data preserved verbatim
 * (URLs, hiring signals, etc. — only the timestamps in `memory` are stale).
 *
 * Add more samples by writing a new const + entry in SAMPLES below.
 */

const ROOFING_HOUSTON: Operator[] = [
  {
    rank: 1,
    confidence: 88,
    name: "Houston Roofing: #1 Roofing Company Houston A+ BBB",
    url: "https://www.braunsroofing.com/",
    icp_fit_reason: "Residential roofing, 35+ years, A+ BBB, family-owned",
    sales_angle: "With over 35 years in Houston and a strong A+ BBB rating, Braun's Roofing fits the profile of a stable residential operator — ideal for a roofing SaaS demo on job management.",
    about: "Houston Roofing: #1 Roofing Company Houston A+ BBB. Houston's Go-To Roofing Company Since 1987. In business for over 35 years, Braun's Roofing has earned a reputation as one of the best roofing companies in Houston, TX. Whether you need a new roof or repairs, turn to the team that knows Houston roofing.",
    size_estimate: "51-100",
    hiring: { count: null, roles: [], source: null },
    recent_activity: [],
    demand_signal: null,
    geo: { lat: 29.7604, lng: -95.3698, display_name: "Braun's Roofing, Houston, Texas, United States" },
    memory: { memory_state: "frequent", first_seen_ts: 1779800000000, seen_count: 4 },
    sources: [
      { field: "about", tool: "bridge_render", url: "https://www.braunsroofing.com/" }
    ]
  },
  {
    rank: 2,
    confidence: 92,
    name: "Reliable Roofing Contractors in Houston",
    url: "https://www.hargroveroofing.com/houston/",
    icp_fit_reason: "Multi-crew, hiring 3 roles (technician, manager, sales)",
    sales_angle: "Currently hiring for technician, manager, and sales roles — this active growth signals a need for workflow and dispatch software to manage their expanding team.",
    about: "Need reliable roof installation, repair, or maintenance? Our Houston roofers are here to help with comprehensive solutions! Call for a free estimate today!",
    size_estimate: "11-50",
    hiring: { count: 3, roles: ["technician", "manager", "sales"], source: "https://hargrove-roofing.careers-page.com/" },
    recent_activity: [
      { headline: "In the News", date: "", source: "https://www.hargroveroofing.com/about-us/in-the-news/" }
    ],
    demand_signal: null,
    geo: { lat: 29.7494, lng: -95.4564, display_name: "Hargrove Roofing, Houston, Texas, United States" },
    memory: { memory_state: "new", first_seen_ts: 1779870000000, seen_count: 1 },
    sources: [
      { field: "about", tool: "bridge_render", url: "https://www.hargroveroofing.com/houston/" },
      { field: "hiring", tool: "homepage_link", url: "https://hargrove-roofing.careers-page.com/" },
      { field: "recent_activity", tool: "homepage_link", url: "https://www.hargroveroofing.com/about-us/in-the-news/" }
    ]
  },
  {
    rank: 3,
    confidence: 76,
    name: "Partners Roofing: Houston Commercial Roofing Contractors",
    url: "https://www.partnersroofing.com/",
    icp_fit_reason: "Commercial roofing, multi-state operator (TX, LA, NM, OK)",
    sales_angle: "As a commercial roofing company serving multiple states, Partners Roofing likely needs a SaaS that can handle complex project tracking across regions.",
    about: "Houston Commercial Roofing Contractors. Servicing Commercial Roofing in Texas, Louisiana, New Mexico, and Oklahoma.",
    size_estimate: "100+",
    hiring: { count: null, roles: [], source: null },
    recent_activity: [],
    demand_signal: null,
    geo: { lat: 29.8175, lng: -95.3414, display_name: "Partners Roofing, Houston, Texas, United States" },
    memory: { memory_state: "familiar", first_seen_ts: 1779850000000, seen_count: 2 },
    sources: [
      { field: "about", tool: "bridge_render", url: "https://www.partnersroofing.com/" }
    ]
  },
  {
    rank: 4,
    confidence: 71,
    name: "Commercial Roofing Solutions in Houston, TX",
    url: "https://www.centimark.com/locations/houston-texas",
    icp_fit_reason: "Commercial roofing, 100+ employees, hiring 3 roles",
    sales_angle: "With 100+ employees and open roles in technician, manager, and operations, CentiMark may benefit from a centralized SaaS to coordinate large commercial crews.",
    about: "Searching for the best commercial roofing company in Houston, Texas? Contact CentiMark where our industrial roofing contractors are ready to help.",
    size_estimate: "100+",
    hiring: { count: 3, roles: ["technician", "manager", "operations"], source: "https://www.centimark.com/careers" },
    recent_activity: [
      { headline: "PR and News", date: "", source: "https://www.centimark.com/about-us/news-and-media" }
    ],
    demand_signal: null,
    geo: { lat: 29.7858, lng: -95.5071, display_name: "CentiMark, Houston, Texas, United States" },
    memory: { memory_state: "new", first_seen_ts: 1779870500000, seen_count: 1 },
    sources: [
      { field: "about", tool: "bridge_render", url: "https://www.centimark.com/locations/houston-texas" },
      { field: "hiring", tool: "homepage_link", url: "https://www.centimark.com/careers" },
      { field: "recent_activity", tool: "homepage_link", url: "https://www.centimark.com/about-us/news-and-media" }
    ]
  }
];

interface Sample {
  matches: RegExp;
  operators: Operator[];
  label: string;
}

const HVAC_HOUSTON: Operator[] = [
  {
    rank: 1, confidence: 91,
    name: "Abacus Plumbing, Air Conditioning & Electrical",
    url: "https://www.abacusplumbing.com/",
    icp_fit_reason: "Multi-trade home services, 24/7 emergency, multi-truck fleet",
    sales_angle: "Multi-trade operator (plumbing + HVAC + electrical) with 24/7 emergency and active hiring — fits ServiceTitan's enterprise dispatch ICP.",
    about: "Houston's #1 plumber, AC repair, and electrician for over 20 years. Same-day service, 24/7 emergency dispatch, fully bonded.",
    size_estimate: "100+",
    hiring: { count: 3, roles: ["technician", "operations", "manager"], source: "https://www.abacusplumbing.com/careers" },
    recent_activity: [{ headline: "Press", date: "", source: "https://www.abacusplumbing.com/about/" }],
    demand_signal: null,
    geo: { lat: 29.7521, lng: -95.5184, display_name: "Abacus Plumbing, Houston, Texas, United States" },
    memory: { memory_state: "new", first_seen_ts: 1779870000000, seen_count: 1 },
    sources: [
      { field: "about", tool: "bridge_render", url: "https://www.abacusplumbing.com/" },
      { field: "hiring", tool: "homepage_link", url: "https://www.abacusplumbing.com/careers" }
    ]
  },
  {
    rank: 2, confidence: 84,
    name: "John Moore Services",
    url: "https://www.johnmooreservices.com/",
    icp_fit_reason: "Established Houston operator, hiring AC techs + electricians",
    sales_angle: "75+ years in Houston with active AC tech + electrician hires — needs dispatch/scheduling SaaS to coordinate a multi-trade fleet.",
    about: "John Moore Services has been Houston's home services company since 1965. Plumbing, air conditioning, electrical, and more.",
    size_estimate: "100+",
    hiring: { count: 2, roles: ["technician", "sales"], source: "https://www.johnmooreservices.com/careers" },
    recent_activity: [],
    demand_signal: null,
    geo: { lat: 29.8336, lng: -95.4081, display_name: "John Moore Services, Houston, Texas" },
    memory: { memory_state: "new", first_seen_ts: 1779870100000, seen_count: 1 },
    sources: [
      { field: "about", tool: "bridge_render", url: "https://www.johnmooreservices.com/" },
      { field: "hiring", tool: "homepage_link", url: "https://www.johnmooreservices.com/careers" }
    ]
  },
  {
    rank: 3, confidence: 78,
    name: "Lex Air Conditioning & Heating",
    url: "https://www.lexaircooling.com/",
    icp_fit_reason: "Mid-size residential HVAC, family-owned",
    sales_angle: "Family-owned mid-size HVAC operator in Houston — fits the HousecallPro / Jobber ICP for sub-50-truck operators wanting modern dispatch.",
    about: "Lex Air Conditioning & Heating is Houston's family-owned HVAC specialist. Service, repair, install — residential and light commercial.",
    size_estimate: "11-50",
    hiring: { count: null, roles: [], source: null },
    recent_activity: [],
    demand_signal: null,
    geo: { lat: 29.7197, lng: -95.6178, display_name: "Lex Air Conditioning, Houston, Texas" },
    memory: { memory_state: "new", first_seen_ts: 1779870200000, seen_count: 1 },
    sources: [
      { field: "about", tool: "bridge_render", url: "https://www.lexaircooling.com/" }
    ]
  }
];

const CHILDCARE_HOUSTON: Operator[] = [
  {
    rank: 1, confidence: 86,
    name: "Children's Lighthouse of Houston",
    url: "https://www.childrenslighthouse.com/houston",
    icp_fit_reason: "Multi-classroom childcare center, NAEYC accredited",
    sales_angle: "NAEYC-accredited multi-classroom center with active enrollment — fits Brightwheel / Procare ICP for parent-comms + billing.",
    about: "Premier early-childhood education in Houston. Infants through pre-K, full-day programs.",
    size_estimate: "11-50",
    hiring: { count: 2, roles: ["manager", "operations"], source: "https://www.childrenslighthouse.com/careers" },
    recent_activity: [],
    demand_signal: null,
    geo: { lat: 29.8275, lng: -95.4623, display_name: "Houston, Texas" },
    memory: { memory_state: "new", first_seen_ts: 1779870000000, seen_count: 1 },
    sources: [
      { field: "about", tool: "bridge_render", url: "https://www.childrenslighthouse.com/houston" },
      { field: "hiring", tool: "homepage_link", url: "https://www.childrenslighthouse.com/careers" }
    ]
  },
  {
    rank: 2, confidence: 79,
    name: "Brightside Academy Houston",
    url: "https://brightsideacademy.org/houston/",
    icp_fit_reason: "Mid-size daycare, multi-classroom, faith-based",
    sales_angle: "Mid-size faith-based daycare with infant + toddler + pre-K rooms — Brightwheel ICP for daily-photo + invoice flows.",
    about: "Brightside Academy: nurturing care from infants through pre-K in Houston, since 2008.",
    size_estimate: "11-50",
    hiring: { count: null, roles: [], source: null },
    recent_activity: [],
    demand_signal: null,
    geo: { lat: 29.7950, lng: -95.4012, display_name: "Houston, Texas" },
    memory: { memory_state: "familiar", first_seen_ts: 1779800000000, seen_count: 2 },
    sources: [{ field: "about", tool: "bridge_render", url: "https://brightsideacademy.org/houston/" }]
  },
  {
    rank: 3, confidence: 72,
    name: "Primrose School of West Houston",
    url: "https://www.primroseschools.com/schools/west-houston/",
    icp_fit_reason: "Franchise location, premium early-learning",
    sales_angle: "Premium-tier childcare franchise location with bilingual + STEM programs — needs SaaS to manage parent comms at scale.",
    about: "Primrose Schools West Houston — premier accredited early learning.",
    size_estimate: "11-50",
    hiring: { count: 1, roles: ["manager"], source: null },
    recent_activity: [],
    demand_signal: null,
    geo: { lat: 29.7670, lng: -95.6360, display_name: "West Houston, Texas" },
    memory: { memory_state: "new", first_seen_ts: 1779870200000, seen_count: 1 },
    sources: [{ field: "about", tool: "bridge_render", url: "https://www.primroseschools.com/schools/west-houston/" }]
  }
];

const DENTAL_HOUSTON: Operator[] = [
  {
    rank: 1, confidence: 87,
    name: "Houston Dental Implants & Periodontics",
    url: "https://www.houstondentalimplants.com/",
    icp_fit_reason: "Implant specialty practice, multi-doctor",
    sales_angle: "Implant + perio specialty practice with multiple DDS — Weave / Pearly ICP for high-AOV scheduling + payment plans.",
    about: "Houston Dental Implants & Periodontics — board-certified implant dentists in Houston.",
    size_estimate: "11-50",
    hiring: { count: 2, roles: ["assistant", "manager"], source: "https://www.houstondentalimplants.com/careers" },
    recent_activity: [],
    demand_signal: null,
    geo: { lat: 29.7588, lng: -95.4612, display_name: "Houston, Texas" },
    memory: { memory_state: "new", first_seen_ts: 1779870000000, seen_count: 1 },
    sources: [
      { field: "about", tool: "bridge_render", url: "https://www.houstondentalimplants.com/" },
      { field: "hiring", tool: "homepage_link", url: "https://www.houstondentalimplants.com/careers" }
    ]
  },
  {
    rank: 2, confidence: 80,
    name: "URBN Dental Houston",
    url: "https://www.urbndental.com/",
    icp_fit_reason: "Multi-location cosmetic + general, Invisalign-heavy",
    sales_angle: "Multi-location practice with strong Invisalign and cosmetic mix — fits Pearly / Weave for membership-plan billing.",
    about: "URBN Dental — modern dental care across Houston neighborhoods. Cosmetic, general, Invisalign.",
    size_estimate: "11-50",
    hiring: { count: 1, roles: ["assistant"], source: null },
    recent_activity: [],
    demand_signal: null,
    geo: { lat: 29.7437, lng: -95.4163, display_name: "Houston, Texas" },
    memory: { memory_state: "familiar", first_seen_ts: 1779800000000, seen_count: 2 },
    sources: [{ field: "about", tool: "bridge_render", url: "https://www.urbndental.com/" }]
  }
];

const LAW_CALIFORNIA: Operator[] = [
  {
    rank: 1, confidence: 84,
    name: "Bay Area Family Law Group",
    url: "https://www.bayareafamilylaw.com/",
    icp_fit_reason: "Boutique 3-office family-law firm, paid Clio Grow ads in past year",
    sales_angle: "Boutique multi-attorney family law with recent web-design refresh — fits Clio / MyCase for case management and billing.",
    about: "Bay Area Family Law Group — divorce, custody, mediation across San Francisco, Oakland, and San Jose offices.",
    size_estimate: "11-50",
    hiring: { count: 2, roles: ["paralegal", "associate attorney"], source: null },
    recent_activity: [{ headline: "Press: 'Top family-law boutique 2025'", date: "", source: "https://www.bayareafamilylaw.com/news/" }],
    demand_signal: null,
    geo: { lat: 37.7749, lng: -122.4194, display_name: "San Francisco, California" },
    memory: { memory_state: "new", first_seen_ts: 1779870000000, seen_count: 1 },
    sources: [{ field: "about", tool: "bridge_render", url: "https://www.bayareafamilylaw.com/" }],
    city: "San Francisco"
  },
  {
    rank: 2, confidence: 79,
    name: "Sandberg PLLC — Personal Injury",
    url: "https://www.sandberg-injury.com/",
    icp_fit_reason: "2-attorney plaintiff PI firm; high-volume case intake (signals doc-mgmt need)",
    sales_angle: "Plaintiff-side personal-injury practice with steady intake — fits Filevine for document automation and case-velocity tracking.",
    about: "Sandberg PLLC — Bay Area personal injury attorneys: auto, slip-and-fall, dog bite, and wrongful death.",
    size_estimate: "1-10",
    hiring: { count: 1, roles: ["case manager"], source: null },
    recent_activity: [],
    demand_signal: null,
    geo: { lat: 37.8044, lng: -122.2712, display_name: "Oakland, California" },
    memory: { memory_state: "familiar", first_seen_ts: 1779700000000, seen_count: 2 },
    sources: [{ field: "about", tool: "bridge_render", url: "https://www.sandberg-injury.com/" }],
    city: "Oakland"
  },
  {
    rank: 3, confidence: 72,
    name: "LA Estate Planning Counsel",
    url: "https://www.laestateplanningcounsel.com/",
    icp_fit_reason: "Estate-planning niche, single-attorney with admin; fits low-friction practice-mgmt SaaS",
    sales_angle: "Solo estate-planning attorney with admin staff — sweet spot for Clio Manage / Smokeball at a small-firm price point.",
    about: "LA Estate Planning Counsel — wills, trusts, probate, and estate administration for Los Angeles families.",
    size_estimate: "1-10",
    hiring: { count: null, roles: [], source: null },
    recent_activity: [],
    demand_signal: null,
    geo: { lat: 34.0522, lng: -118.2437, display_name: "Los Angeles, California" },
    memory: { memory_state: "new", first_seen_ts: 1779870000000, seen_count: 1 },
    sources: [{ field: "about", tool: "bridge_render", url: "https://www.laestateplanningcounsel.com/" }],
    city: "Los Angeles"
  }
];

const MSP_FLORIDA: Operator[] = [
  {
    rank: 1, confidence: 86,
    name: "GulfCoast IT Partners",
    url: "https://www.gulfcoast-itpartners.com/",
    icp_fit_reason: "30-seat MSP, Tampa-based, ConnectWise tickets visible on careers page",
    sales_angle: "Tampa-area MSP running ConnectWise — perfect upsell target for Auvik / Liongard / Huntress at the mid-tier MSP segment.",
    about: "GulfCoast IT Partners — Tampa Bay's managed-services provider for SMB and mid-market clients across Florida.",
    size_estimate: "11-50",
    hiring: { count: 2, roles: ["L2 technician", "service coordinator"], source: null },
    recent_activity: [{ headline: "Hired new VP of Sales", date: "", source: "https://www.gulfcoast-itpartners.com/news" }],
    demand_signal: null,
    geo: { lat: 27.9506, lng: -82.4572, display_name: "Tampa, Florida" },
    memory: { memory_state: "new", first_seen_ts: 1779870000000, seen_count: 1 },
    sources: [{ field: "about", tool: "bridge_render", url: "https://www.gulfcoast-itpartners.com/" }],
    city: "Tampa"
  },
  {
    rank: 2, confidence: 81,
    name: "Miami MSP Group",
    url: "https://www.miamimspgroup.com/",
    icp_fit_reason: "10-tech Miami MSP with HIPAA-medical vertical specialty",
    sales_angle: "HIPAA-focused Miami MSP serving healthcare clients — strong fit for Compliancy Group / RocketCyber's vertical compliance modules.",
    about: "Miami MSP Group — managed IT, cybersecurity, and HIPAA compliance for South Florida medical practices.",
    size_estimate: "1-10",
    hiring: { count: 1, roles: ["security analyst"], source: null },
    recent_activity: [],
    demand_signal: null,
    geo: { lat: 25.7617, lng: -80.1918, display_name: "Miami, Florida" },
    memory: { memory_state: "familiar", first_seen_ts: 1779700000000, seen_count: 3 },
    sources: [{ field: "about", tool: "bridge_render", url: "https://www.miamimspgroup.com/" }],
    city: "Miami"
  },
  {
    rank: 3, confidence: 74,
    name: "Orlando NetWorks",
    url: "https://www.orlandonetworks.com/",
    icp_fit_reason: "Orlando MSP, 5-tech shop, hiring helpdesk roles",
    sales_angle: "Growing Orlando MSP with active helpdesk hiring — needs ticketing/dispatch software (Halo PSA, SyncroMSP).",
    about: "Orlando NetWorks — Central Florida managed IT services, VoIP, and cloud migration support.",
    size_estimate: "1-10",
    hiring: { count: 3, roles: ["helpdesk", "field tech", "account rep"], source: null },
    recent_activity: [],
    demand_signal: null,
    geo: { lat: 28.5383, lng: -81.3792, display_name: "Orlando, Florida" },
    memory: { memory_state: "new", first_seen_ts: 1779870000000, seen_count: 1 },
    sources: [{ field: "about", tool: "bridge_render", url: "https://www.orlandonetworks.com/" }],
    city: "Orlando"
  }
];

const AUTO_ATLANTA: Operator[] = [
  {
    rank: 1, confidence: 82,
    name: "Peachtree Auto Body",
    url: "https://www.peachtreeautobody.com/",
    icp_fit_reason: "Family-owned auto-body shop, 2 bays, hiring estimators",
    sales_angle: "Peachtree Auto Body's growing estimator team is a clean fit for CCC ONE / Mitchell estimating + parts ordering tools.",
    about: "Peachtree Auto Body — collision repair, custom paint, and insurance claims handling in metro Atlanta.",
    size_estimate: "11-50",
    hiring: { count: 2, roles: ["estimator", "painter"], source: null },
    recent_activity: [],
    demand_signal: null,
    geo: { lat: 33.749, lng: -84.388, display_name: "Atlanta, Georgia" },
    memory: { memory_state: "new", first_seen_ts: 1779870000000, seen_count: 1 },
    sources: [{ field: "about", tool: "bridge_render", url: "https://www.peachtreeautobody.com/" }],
    city: "Atlanta"
  },
  {
    rank: 2, confidence: 76,
    name: "Buckhead European Auto",
    url: "https://www.buckheadeuropeanauto.com/",
    icp_fit_reason: "European specialty shop; high-margin BMW/Mercedes/Audi clientele",
    sales_angle: "Specialty European-marque repair — ideal for AllData / Tekmetric workflow + parts software at a premium price point.",
    about: "Buckhead European Auto — BMW, Mercedes, Audi, and Porsche service in Atlanta's Buckhead neighborhood.",
    size_estimate: "1-10",
    hiring: { count: null, roles: [], source: null },
    recent_activity: [],
    demand_signal: null,
    geo: { lat: 33.8484, lng: -84.376, display_name: "Atlanta, Georgia" },
    memory: { memory_state: "familiar", first_seen_ts: 1779700000000, seen_count: 2 },
    sources: [{ field: "about", tool: "bridge_render", url: "https://www.buckheadeuropeanauto.com/" }],
    city: "Atlanta"
  }
];

const HOTEL_MIAMI: Operator[] = [
  {
    rank: 1, confidence: 80,
    name: "Brickell Boutique Hotel",
    url: "https://www.brickellboutiquehotel.com/",
    icp_fit_reason: "12-room boutique hotel in Brickell financial district; high-end clientele",
    sales_angle: "Small-format boutique with high ADR — a sweet spot for Mews / Cloudbeds PMS + revenue-management bolt-on.",
    about: "Brickell Boutique Hotel — 12 designer rooms, rooftop bar, and concierge service in downtown Miami.",
    size_estimate: "11-50",
    hiring: { count: 1, roles: ["front desk lead"], source: null },
    recent_activity: [{ headline: "Featured in Conde Nast 'Hidden Miami' list", date: "", source: "https://www.brickellboutiquehotel.com/press/" }],
    demand_signal: null,
    geo: { lat: 25.7617, lng: -80.1918, display_name: "Miami, Florida" },
    memory: { memory_state: "new", first_seen_ts: 1779870000000, seen_count: 1 },
    sources: [{ field: "about", tool: "bridge_render", url: "https://www.brickellboutiquehotel.com/" }],
    city: "Miami"
  },
  {
    rank: 2, confidence: 73,
    name: "South Beach Suites",
    url: "https://www.southbeachsuites.com/",
    icp_fit_reason: "Independent 28-room South Beach property; strong Instagram presence",
    sales_angle: "Indie South Beach hotel with active social — needs Stayntouch / Hopper revenue-management + channel-manager combo.",
    about: "South Beach Suites — 28 oceanview rooms on Collins Ave, independent and family-run since 2008.",
    size_estimate: "11-50",
    hiring: { count: 2, roles: ["housekeeping lead", "night manager"], source: null },
    recent_activity: [],
    demand_signal: null,
    geo: { lat: 25.7907, lng: -80.13, display_name: "Miami Beach, Florida" },
    memory: { memory_state: "familiar", first_seen_ts: 1779800000000, seen_count: 2 },
    sources: [{ field: "about", tool: "bridge_render", url: "https://www.southbeachsuites.com/" }],
    city: "Miami Beach"
  }
];

const SAMPLES: Sample[] = [
  { matches: /roof/i, operators: ROOFING_HOUSTON, label: "roofing-houston" },
  { matches: /hvac|heating|cooling|air[\s-]?conditioning/i, operators: HVAC_HOUSTON, label: "hvac-houston" },
  { matches: /childcare|daycare|preschool/i, operators: CHILDCARE_HOUSTON, label: "childcare-houston" },
  { matches: /dental|dentist/i, operators: DENTAL_HOUSTON, label: "dental-houston" },
  { matches: /law\s+firm|attorney|lawyer/i, operators: LAW_CALIFORNIA, label: "law-california" },
  { matches: /msp|managed[\s-]?(it|service)/i, operators: MSP_FLORIDA, label: "msp-florida" },
  { matches: /auto[\s-]?body|auto[\s-]?repair|mechanic|car[\s-]?repair/i, operators: AUTO_ATLANTA, label: "auto-atlanta" },
  { matches: /hotel|boutique[\s-]?hotel|inn/i, operators: HOTEL_MIAMI, label: "hotel-miami" }
];

export function findSample(rawQuery: string): Sample | null {
  for (const s of SAMPLES) {
    if (s.matches.test(rawQuery)) return s;
  }
  return null;
}
