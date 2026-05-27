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

const SAMPLES: Sample[] = [
  { matches: /roof/i, operators: ROOFING_HOUSTON, label: "roofing-houston" },
  { matches: /hvac|heating|cooling|air[\s-]?conditioning/i, operators: HVAC_HOUSTON, label: "hvac-houston" }
];

export function findSample(rawQuery: string): Sample | null {
  for (const s of SAMPLES) {
    if (s.matches.test(rawQuery)) return s;
  }
  return null;
}
