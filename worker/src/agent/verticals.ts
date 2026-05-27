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

const MARKETING_AGENCY: VerticalPack = {
  id: "marketing_agency",
  label: "marketing agencies / digital agencies",
  matches: /\b(marketing agency|digital agency|seo agency|ad agency|ppc agency|creative agency|brand agency)\b/i,
  buyer_examples: ["AgencyAnalytics", "Function Point", "Workamajig", "Productive", "Asana", "ClientFlow", "Mailshake"],
  signal_hints: [
    "service mix listed (SEO, PPC, social, content, design)",
    "case studies / client logos visible",
    "team count or 'meet the team' page",
    "white-label / partner-agency language",
    "AE / SEO specialist / paid-media buyer hiring"
  ],
  icp_examples: [
    "Boutique digital, 8-25 staff, full-service",
    "PPC-only specialty, Google + Meta",
    "SEO + content agency, retainer model",
    "Brand-design studio, project-based"
  ],
  serp_angles: ["digital marketing agency", "SEO agency", "PPC agency"],
  sales_angle_examples: [
    "PPC specialty + case studies in HVAC + hiring paid-media buyer → AgencyAnalytics / Function Point ICP for client reporting."
  ]
};

const INSURANCE_BROKER: VerticalPack = {
  id: "insurance_broker",
  label: "insurance brokers / agencies",
  matches: /\b(insurance|broker|underwrit|agency.*insurance|risk management)\b/i,
  buyer_examples: ["Applied Epic", "Sagitta", "AMS360", "EZLynx", "HawkSoft", "QQCatalyst", "AgencyZoom"],
  signal_hints: [
    "specialty lines (commercial, personal, life/health, benefits)",
    "carrier appointments listed",
    "P&C / E&O credentials",
    "producer / account manager / CSR hiring",
    "compliance / state-license mentions"
  ],
  icp_examples: [
    "Independent P&C broker, 5-15 producers",
    "Benefits-focused agency, mid-market",
    "Commercial-specialty broker, niche lines",
    "Multi-line family agency"
  ],
  serp_angles: ["insurance broker", "independent insurance agency", "commercial insurance broker"],
  sales_angle_examples: [
    "Multi-carrier P&C + 6 producers + hiring CSRs → Applied Epic / HawkSoft ICP for agency management."
  ]
};

const SALON: VerticalPack = {
  id: "salon",
  label: "salons / spas / beauty businesses",
  matches: /\b(salon|spa|barber|nail (bar|salon)|hair (studio|salon)|beauty (bar|studio)|med ?spa)\b/i,
  buyer_examples: ["Boulevard", "Vagaro", "Booker", "GlossGenius", "Square Appointments", "Mangomint", "Mindbody"],
  signal_hints: [
    "service menu visible (cuts, color, balayage, facials)",
    "online booking link",
    "stylist / esthetician roster",
    "membership / subscription tiers",
    "stylist / esthetician / front-desk hiring"
  ],
  icp_examples: [
    "Boutique hair salon, 4-12 chairs",
    "Med-spa, injectables + skincare",
    "Multi-location nail studio",
    "Independent barbershop with online booking"
  ],
  serp_angles: ["hair salon", "day spa", "med spa", "barber shop"],
  sales_angle_examples: [
    "Med-spa + online booking + hiring estheticians → Boulevard / Mangomint ICP for high-AOV scheduling."
  ]
};

const VET: VerticalPack = {
  id: "vet",
  label: "veterinary clinics",
  matches: /\b(vet(erinary)?|animal hospital|pet clinic|kennel|pet wellness)\b/i,
  buyer_examples: ["PetDesk", "Provet Cloud", "Vetspire", "Hippo Manager", "eVetPractice", "Cornerstone"],
  signal_hints: [
    "species treated (dogs/cats vs exotics)",
    "AAHA accreditation",
    "wellness plans / membership",
    "surgery / dental / urgent-care offerings",
    "DVM / vet tech / receptionist hiring"
  ],
  icp_examples: [
    "Single-doctor general practice",
    "Multi-doctor + ICU, AAHA-accredited",
    "Mobile / house-call vet",
    "Exotic / specialty clinic"
  ],
  serp_angles: ["veterinarian", "animal hospital", "vet clinic"],
  sales_angle_examples: [
    "AAHA-accredited + 3 DVMs + wellness plan + hiring vet tech → PetDesk / Vetspire ICP."
  ]
};

const TRUCKING: VerticalPack = {
  id: "trucking",
  label: "trucking / freight carriers",
  matches: /\b(trucking|freight|logistics|carrier|owner[\s-]?operator|haul(ing|er))\b/i,
  buyer_examples: ["Motive (KeepTruckin)", "Samsara", "McLeod", "Truckstop", "Tenstreet", "Truckbase", "Loadsmith"],
  signal_hints: [
    "fleet size visible (e.g., '40 trucks')",
    "DOT/MC number",
    "specialty: flatbed / reefer / dry van / specialized",
    "regional vs OTR vs local",
    "driver / dispatcher / safety-manager hiring"
  ],
  icp_examples: [
    "40-truck flatbed regional carrier",
    "Owner-operator + small fleet, 5-15 trucks",
    "Reefer specialty, mid-market",
    "Local last-mile carrier"
  ],
  serp_angles: ["trucking company", "freight carrier", "logistics provider"],
  sales_angle_examples: [
    "40-truck flatbed + hiring drivers + safety manager → Motive / McLeod ICP for ELD + dispatch."
  ]
};

const MEDICAL_SPECIALTY: VerticalPack = {
  id: "medical_specialty",
  label: "specialty medical clinics",
  matches: /\b(chiropract|physical therapy|dermatolog|pediatric|urgent care|optometr|podiatr|ortho|cardio|psychiatr|gastro)\b/i,
  buyer_examples: ["Tebra", "Practice Fusion", "DrChrono", "Kareo", "AthenaHealth", "WeaveHealth", "AdvancedMD"],
  signal_hints: [
    "specialty (chiropractic / PT / derm / podiatry / etc.)",
    "insurance accepted (specific carriers)",
    "telehealth offerings",
    "evening / weekend hours",
    "MA / front-desk / DPT hiring"
  ],
  icp_examples: [
    "Solo chiropractor, multi-modality clinic",
    "PT clinic, 3 therapists, sports + ortho",
    "Pediatric urgent care, multi-location",
    "Dermatology + medspa hybrid"
  ],
  serp_angles: ["chiropractor clinic", "physical therapy clinic", "dermatology practice"],
  sales_angle_examples: [
    "PT clinic + telehealth offerings + hiring DPTs → Tebra / WeaveHealth ICP."
  ]
};

const FOOD_TRUCK: VerticalPack = {
  id: "food_truck",
  label: "food trucks / mobile food",
  matches: /\b(food truck|food cart|mobile food|ghost kitchen|street food)\b/i,
  buyer_examples: ["Square for Restaurants", "Toast", "Roaming Hunger", "Best Food Trucks", "BentoBox"],
  signal_hints: [
    "cuisine type listed",
    "event catering availability",
    "social media (Instagram/TikTok) prominent",
    "weekly route / schedule visible",
    "cook / driver hiring"
  ],
  icp_examples: [
    "Single-truck operator, lunch route + events",
    "Multi-truck fleet, 3-8 vehicles",
    "Ghost-kitchen + delivery hybrid",
    "Specialty cuisine, growing brand"
  ],
  serp_angles: ["food truck", "mobile food vendor", "ghost kitchen"],
  sales_angle_examples: [
    "3-truck fleet + active Instagram + event catering → Square + BestFoodTrucks ICP."
  ]
};

const BREWERY: VerticalPack = {
  id: "brewery",
  label: "breweries / craft beverage",
  matches: /\b(brewery|brewer|brewing|distillery|distiller|cider(y)?|winery|taproom)\b/i,
  buyer_examples: ["Arryved", "Untappd for Business", "Ekos", "Beer30", "Encompass", "OrderPort"],
  signal_hints: [
    "barrel size visible (BBL/year)",
    "taproom or beer-garden",
    "self-distribution vs distributor",
    "events / tours offered",
    "brewer / server / sales-rep hiring"
  ],
  icp_examples: [
    "Microbrewery + taproom, 500-2000 BBL",
    "Regional craft brewery, 5+ taproom locations",
    "Distillery + cocktail bar",
    "Wine bar + tasting events"
  ],
  serp_angles: ["craft brewery", "microbrewery taproom", "local distillery"],
  sales_angle_examples: [
    "1,500-BBL microbrewery + taproom + hiring → Arryved / Ekos ICP."
  ]
};

const PHOTOGRAPHER: VerticalPack = {
  id: "photographer",
  label: "wedding / portrait photographers",
  matches: /\b(photograph(er|y)|wedding photo|portrait studio|videograph)\b/i,
  buyer_examples: ["HoneyBook", "17hats", "Studio Ninja", "Dubsado", "Tave", "Pixieset", "ShootProof"],
  signal_hints: [
    "specialty (wedding / portrait / commercial / family)",
    "portfolio + recent featured work",
    "package pricing tiers",
    "destination / travel availability",
    "second-shooter / editor / assistant hiring"
  ],
  icp_examples: [
    "Solo wedding photographer, 25-50 weddings/year",
    "Family portrait studio, brick-and-mortar",
    "Multi-shooter wedding team, destination",
    "Commercial product photographer"
  ],
  serp_angles: ["wedding photographer", "portrait photographer", "photography studio"],
  sales_angle_examples: [
    "50-weddings-a-year solo + destination work → HoneyBook / Studio Ninja ICP for booking + contracts."
  ]
};

const JEWELRY: VerticalPack = {
  id: "jewelry",
  label: "jewelry stores / jewelers",
  matches: /\b(jewel(er|ry)|diamond|gold smith|bridal jewel)\b/i,
  buyer_examples: ["The Edge", "Jewelers Mutual GemStar", "Trevipay", "Punchmark", "GemFind", "Edge Pulse"],
  signal_hints: [
    "specialty (bridal, custom, repairs)",
    "designer collections carried",
    "GIA-certified gemologist mentions",
    "appraisal / insurance services",
    "bench jeweler / sales / designer hiring"
  ],
  icp_examples: [
    "Independent fine-jewelry retailer, bridal focus",
    "Custom-design studio, in-house bench",
    "Multi-location regional chain",
    "Heirloom-restoration specialty"
  ],
  serp_angles: ["independent jeweler", "custom jewelry", "fine jewelry store"],
  sales_angle_examples: [
    "Custom-design + in-house bench + GIA gemologist → Punchmark / The Edge ICP for retail + repairs."
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
  LEGAL, MSP, ACCOUNTING, FITNESS, RESTAURANT, HOTEL, REAL_ESTATE, LANDSCAPING,
  MARKETING_AGENCY, INSURANCE_BROKER, SALON, VET, TRUCKING,
  MEDICAL_SPECIALTY, FOOD_TRUCK, BREWERY, PHOTOGRAPHER, JEWELRY
];

export function detectVertical(niche: string): VerticalPack {
  for (const p of PACKS) {
    if (p.matches.test(niche)) return p;
  }
  return GENERIC;
}

export const ALL_PACKS = [...PACKS, GENERIC];
