/**
 * Detect the vertical-SaaS and infrastructure tools an operator uses, by sniffing markers in
 * their homepage HTML. Zero added BD/LLM cost — we already have the HTML from enrich.
 *
 * Why this matters for the buyer:
 *   - If the operator already uses ServiceTitan, an AccuLynx SDR knows to avoid them (or pitch
 *     migration, hard sell).
 *   - If they use Greenhouse for ATS, that's a "real hiring infrastructure" signal.
 *   - If they use Calendly, they don't have Acuity → SDR for Acuity has a target.
 *
 * Detection is purely pattern-matching the HTML. Each entry has a label + match pattern.
 */

export interface TechMarker {
  /** Display name surfaced in the UI. */
  name: string;
  /** Category surfaced as a chip color hint. */
  category: "ats" | "field_service" | "scheduling" | "ecommerce" | "cms" | "analytics" | "payments" | "marketing" | "vertical_saas";
  /** Pattern over lowercased HTML (the caller pre-lowercases). */
  pattern: RegExp;
}

const MARKERS: TechMarker[] = [
  // ─── ATS / Hiring infrastructure ─────────────────────────────────────────
  { name: "Greenhouse",  category: "ats", pattern: /boards\.greenhouse\.io|greenhouse-job-board|greenhouse\.io\/embed/i },
  { name: "Lever",       category: "ats", pattern: /jobs\.lever\.co|lever-jobs|leverhq/i },
  { name: "Workday",     category: "ats", pattern: /myworkdayjobs|workday\.com\/.+\/job/i },
  { name: "Ashby",       category: "ats", pattern: /jobs\.ashbyhq\.com|ashbyhq\.com\/embed/i },
  { name: "BambooHR",    category: "ats", pattern: /bamboohr\.com\/jobs|bamboo[\s_-]?hr/i },
  { name: "Workable",    category: "ats", pattern: /apply\.workable\.com|workable\.com\/embed/i },
  { name: "JazzHR",      category: "ats", pattern: /jazzhr\.com|app\.jazz\.co/i },
  { name: "Recruitee",   category: "ats", pattern: /recruitee\.com\/career/i },
  { name: "SmartRecruiters", category: "ats", pattern: /smartrecruiters\.com\/job|smartapply/i },
  { name: "iCIMS",       category: "ats", pattern: /icims\.com\/jobs|icims-talent/i },
  { name: "Indeed Hire", category: "ats", pattern: /hire\.indeed\.com|indeed-apply/i },
  { name: "Paylocity",   category: "ats", pattern: /paylocity\.com\/recruit/i },
  { name: "ZipRecruiter Hiring", category: "ats", pattern: /ziprecruiter\.com\/apply|zr-apply/i },

  // ─── Vertical SaaS — field service ────────────────────────────────────────
  { name: "ServiceTitan", category: "field_service", pattern: /servicetitan|book\.servicetitan\.com/i },
  { name: "Jobber",      category: "field_service", pattern: /\bgetjobber|jobber\.com/i },
  { name: "Housecall Pro", category: "field_service", pattern: /housecallpro|housecall-pro/i },
  { name: "AccuLynx",    category: "vertical_saas",  pattern: /acculynx/i },
  { name: "JobNimbus",   category: "vertical_saas",  pattern: /jobnimbus/i },
  { name: "Roofr",       category: "vertical_saas",  pattern: /\broofr\b/i },
  { name: "FieldEdge",   category: "field_service",  pattern: /fieldedge/i },
  { name: "ServiceFusion", category: "field_service", pattern: /servicefusion/i },
  { name: "Workiz",      category: "field_service", pattern: /workiz/i },

  // ─── Scheduling / Booking ─────────────────────────────────────────────────
  { name: "Calendly",    category: "scheduling", pattern: /calendly\.com|calendly-widget|assets\.calendly/i },
  { name: "Acuity Scheduling", category: "scheduling", pattern: /acuityscheduling\.com|acuity-embed|acuity\.com\/schedule/i },
  { name: "Mindbody",    category: "scheduling", pattern: /mindbodyonline|mindbody\.io|clients\.mindbodyonline/i },
  { name: "SquareUp",    category: "payments", pattern: /squareup\.com\/appointments|square-online/i },
  { name: "Booksy",      category: "scheduling", pattern: /booksy\.com/i },
  { name: "Vagaro",      category: "scheduling", pattern: /vagaro\.com/i },
  { name: "OpenTable",   category: "scheduling", pattern: /opentable\.com\/reserve|opentable-widget/i },
  { name: "Resy",        category: "scheduling", pattern: /resy\.com\/cities|resy-widget/i },

  // ─── CRM / Marketing ──────────────────────────────────────────────────────
  { name: "HubSpot",     category: "marketing", pattern: /hs-scripts|hubspot\.com\/.*\/hs-/i },
  { name: "Mailchimp",   category: "marketing", pattern: /mailchimp\.com|chimpstatic|mc\.us\d+\.list-manage\.com/i },
  { name: "Klaviyo",     category: "marketing", pattern: /klaviyo\.com|static\.klaviyo|a\.klaviyo/i },
  { name: "Marketo",     category: "marketing", pattern: /marketo\.com\/munchkin|mktoresp/i },
  { name: "Intercom",    category: "marketing", pattern: /intercom\.io|widget\.intercom/i },
  { name: "Drift",       category: "marketing", pattern: /\bdrift\.com\/|js\.driftt\.com/i },
  { name: "ActiveCampaign", category: "marketing", pattern: /activecampaign|trackcmp\.net/i },

  // ─── Analytics / pixels ───────────────────────────────────────────────────
  { name: "Google Analytics", category: "analytics", pattern: /google-analytics\.com\/(?:analytics\.js|ga\.js)|gtag\(.config.,.G-/i },
  { name: "GA4 (gtag)",  category: "analytics", pattern: /gtag\/js\?id=G-[A-Z0-9]+|googletagmanager\.com\/gtag/i },
  { name: "Google Tag Manager", category: "analytics", pattern: /googletagmanager\.com\/gtm\.js/i },
  { name: "Meta Pixel",  category: "analytics", pattern: /connect\.facebook\.net\/.+\/fbevents\.js|fbq\(.init.,/i },
  { name: "Mixpanel",    category: "analytics", pattern: /cdn\.mxpnl\.com|mixpanel\.com/i },
  { name: "Segment",     category: "analytics", pattern: /cdn\.segment\.com\/analytics\.js|segment\.io\/analytics/i },
  { name: "Heap",        category: "analytics", pattern: /cdn\.heap(?:analytics)?\.com\/heap/i },
  { name: "Hotjar",      category: "analytics", pattern: /static\.hotjar\.com|hj\.q\.push/i },

  // ─── Payments ─────────────────────────────────────────────────────────────
  { name: "Stripe",      category: "payments", pattern: /js\.stripe\.com|stripe\.com\/v3/i },
  { name: "PayPal",      category: "payments", pattern: /paypal\.com\/sdk|paypalobjects\.com/i },
  { name: "Klarna",      category: "payments", pattern: /klarna\.com\/external|klarna-checkout/i },
  { name: "Affirm",      category: "payments", pattern: /affirm\.com\/js|affirm-checkout/i },

  // ─── E-commerce platforms ─────────────────────────────────────────────────
  { name: "Shopify",     category: "ecommerce", pattern: /cdn\.shopify\.com|shopify\.com\/s\/files|myshopify\.com/i },
  { name: "BigCommerce", category: "ecommerce", pattern: /bigcommerce\.com|cdn11\.bigcommerce/i },
  { name: "WooCommerce", category: "ecommerce", pattern: /woocommerce\.com|wp-content\/.+woocommerce/i },
  { name: "Square Online", category: "ecommerce", pattern: /square\.site|squareup\.com\/store/i },

  // ─── CMS ──────────────────────────────────────────────────────────────────
  { name: "WordPress",   category: "cms", pattern: /\/wp-content\/|wp-includes|wordpress\.com/i },
  { name: "Squarespace", category: "cms", pattern: /static1\.squarespace|squarespace-cdn|sqs-cdn/i },
  { name: "Wix",         category: "cms", pattern: /static\.parastorage\.com|wix\.com\/_partials/i },
  { name: "Webflow",     category: "cms", pattern: /assets\.website-files\.com|webflow\.js|webflow\.com/i },
  { name: "Duda",        category: "cms", pattern: /lirp\.cdn-website\.com|irp-cdn\.multiscreensite\.com/i },
  { name: "GoDaddy Builder", category: "cms", pattern: /img1\.wsimg\.com|godaddysites|website-builder/i },
];

export function detectTechStack(html: string): string[] {
  if (!html) return [];
  const found = new Set<string>();
  for (const m of MARKERS) {
    if (m.pattern.test(html)) found.add(m.name);
  }
  return Array.from(found).slice(0, 12);
}

/** Map a detected tech name back to its category — used for color-coding chips in the UI. */
export function techCategory(name: string): TechMarker["category"] | "other" {
  const m = MARKERS.find(m => m.name === name);
  return m?.category ?? "other";
}
