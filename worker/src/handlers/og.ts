/**
 * /api/og.svg?q=<query> — generated OG card as SVG (1200×630).
 *
 * SVG is widely supported by Slack/Discord/Twitter (newer X) link unfurls. Sites that don't
 * render SVG OG images (e.g. older Facebook crawlers) still get the title + description from
 * the share page's meta tags, just without a hero image. We accept that trade-off — Slack and
 * Twitter cover ~95% of the relevant share traffic.
 *
 * /share?q=<query> — HTML wrapper page that sets og:image + og:title + og:description and then
 * client-redirects to the actual app. This is the URL the "Copy share URL" button now produces.
 */
import { demandHeaders } from "../demand/client";
import type { Env } from "../index";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Build the OG card SVG. All values inline; no external font loading (uses Georgia/system fallbacks). */
function buildOgSvg(opts: { query: string; demand?: number | null; operatorCount?: number | null; totalUsd?: number | null }): string {
  const { query, demand, operatorCount, totalUsd } = opts;
  const headline = query.length > 60 ? query.slice(0, 57) + "…" : query;

  // Stat strip — show 3-4 chunks of proof. Hide whatever isn't passed.
  const stats: Array<{ value: string; label: string; color: string }> = [];
  stats.push({ value: "≈ 0", label: "Apollo finds", color: "#A8351F" }); // rust
  if (operatorCount !== null && operatorCount !== undefined) {
    stats.push({ value: String(operatorCount), label: "LongTail finds", color: "#3E6B2C" }); // moss
  }
  if (demand !== null && demand !== undefined && demand > 0) {
    stats.push({ value: demand.toLocaleString(), label: "in our index", color: "#1A1814" });
  }
  if (totalUsd !== null && totalUsd !== undefined && totalUsd > 0) {
    stats.push({ value: `$${totalUsd.toFixed(2)}`, label: "scout cost", color: "#8B5E1E" }); // ochre-dk
  }

  // Layout — 4-up stat strip if we have 4, otherwise centered
  const cardW = 1200;
  const cardH = 630;
  const statCount = stats.length;
  const statY = 480;
  const statBoxW = Math.min(220, (cardW - 120) / statCount);
  const statStart = (cardW - statBoxW * statCount) / 2;

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${cardW}" height="${cardH}" viewBox="0 0 ${cardW} ${cardH}">
  <defs>
    <pattern id="contour" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#DBD4C7" stroke-width="0.5" />
    </pattern>
  </defs>

  <!-- paper background + subtle contour grid -->
  <rect width="${cardW}" height="${cardH}" fill="#F5F0E4"/>
  <rect width="${cardW}" height="${cardH}" fill="url(#contour)" opacity="0.5"/>

  <!-- topographic curve accents -->
  <g fill="none" stroke="#BFB8AC" stroke-width="1" opacity="0.6">
    <path d="M-50,180 C200,140 350,260 600,230 C850,200 1000,300 1280,260"/>
    <path d="M-50,220 C220,200 380,300 640,270 C900,240 1060,340 1280,300"/>
    <path d="M-50,290 C300,290 480,350 700,340 C920,330 1100,380 1280,370"/>
  </g>

  <!-- wordmark, top-left -->
  <g transform="translate(60,80)">
    <text font-family="Georgia, serif" font-size="40" font-weight="700" fill="#1A1814">
      <tspan font-style="italic" font-weight="500">longtail</tspan><tspan font-weight="700">scout</tspan><tspan font-family="monospace" font-size="16" font-weight="400" fill="#A39C90" dy="-3"> .com</tspan>
    </text>
  </g>

  <!-- edition strip, top-right -->
  <g transform="translate(${cardW - 60},80)" font-family="monospace" font-size="12" font-weight="600" fill="#857E73" letter-spacing="2" text-anchor="end">
    <text>VOL. 1 · FIELD MANUAL · EST. MAY 2026</text>
  </g>

  <!-- "apollo can't see this" stamp -->
  <g transform="translate(60,160)">
    <rect x="-2" y="-22" width="220" height="32" fill="none" stroke="#A8351F" stroke-width="2" rx="3" transform="rotate(-0.4)"/>
    <text font-family="monospace" font-size="13" font-weight="700" fill="#A8351F" letter-spacing="2" y="0" transform="rotate(-0.4)">APOLLO CAN'T SEE THIS</text>
  </g>

  <!-- Query as the eyebrow -->
  <text x="60" y="240" font-family="monospace" font-size="14" font-weight="600" fill="#6B645B" letter-spacing="3">SCOUT · ${escapeXml(headline.toUpperCase())}</text>

  <!-- Big headline -->
  <text x="60" y="320" font-family="Georgia, serif" font-size="56" font-weight="600" fill="#1A1814">The operators</text>
  <text x="60" y="380" font-family="Georgia, serif" font-size="56" font-weight="500" font-style="italic" fill="#A8351F">your data vendor</text>
  <text x="60" y="440" font-family="Georgia, serif" font-size="56" font-weight="600" fill="#1A1814">forgot to crawl.</text>

  <!-- Stat strip -->
  <g>
    ${stats.map((s, i) => {
      const x = statStart + i * statBoxW;
      const showLeftBorder = i > 0;
      return `
        <g transform="translate(${x},${statY})">
          ${showLeftBorder ? `<line x1="0" y1="10" x2="0" y2="110" stroke="#DBD4C7" stroke-width="1"/>` : ""}
          <text x="${statBoxW / 2}" y="55" font-family="Georgia, serif" font-size="50" font-weight="600" fill="${s.color}" text-anchor="middle" letter-spacing="-2">${escapeXml(s.value)}</text>
          <text x="${statBoxW / 2}" y="85" font-family="-apple-system, Inter, sans-serif" font-size="12" fill="#6B645B" text-anchor="middle">${escapeXml(s.label)}</text>
        </g>
      `;
    }).join("")}
  </g>

  <!-- bottom strip — credit -->
  <rect x="0" y="600" width="${cardW}" height="30" fill="#1A1814"/>
  <text x="60" y="620" font-family="monospace" font-size="11" font-weight="500" fill="#F5F0E4" letter-spacing="2">BUILT ON BRIGHT DATA · DEEPSEEK · A PRIVATE ~7M-RECORD DEMAND INDEX</text>
</svg>`;
}

export async function ogImageHandler(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
  if (!query) return new Response("missing q", { status: 400 });

  // Pull live demand count + recent-runs operator count if available, so the OG card reflects reality.
  let demand: number | null = null;
  let operatorCount: number | null = null;
  let totalUsd: number | null = null;
  try {
    // Demand probe
    const nicheGuess = query.replace(/\s+(?:in|near|around)\s+.+$/i, "").trim();
    if (nicheGuess) {
      const r = await fetch(`${env.DEMAND_API_BASE.replace(/\/$/, "")}/api/research?q=${encodeURIComponent(nicheGuess.toLowerCase())}&tlds=com&limit=1`, {
        headers: demandHeaders(env.DEMAND_API_TOKEN, { "user-agent": "longtailscout-og/1.0" })
      });
      if (r.ok) {
        const j = await r.json() as { demand?: number };
        if (typeof j.demand === "number") demand = j.demand;
      }
    }
  } catch { /* best-effort */ }

  try {
    // Recent runs lookup — if this exact query has a recent completion, use its op count + cost
    const recent = await env.CACHE.get("recent_runs", "json") as Array<{ query: string; operator_count: number; total_usd: number }> | null;
    const match = recent?.find(r => r.query.toLowerCase().trim() === query.toLowerCase().trim());
    if (match) {
      operatorCount = match.operator_count;
      totalUsd = match.total_usd;
    }
  } catch { /* best-effort */ }

  const svg = buildOgSvg({ query, demand, operatorCount, totalUsd });
  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      // Cache aggressively — same query renders same card. 1 hour browser, 24h CDN.
      "cache-control": "public, max-age=3600, s-maxage=86400"
    }
  });
}

/** /share?q=<query> — HTML wrapper that sets og:image + og:title + og:description + redirects to the app. */
export async function shareHandler(req: Request, _env: Env): Promise<Response> {
  const url = new URL(req.url);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
  if (!query) {
    return Response.redirect("https://longtailscout.com/", 302);
  }
  const ogImg = `https://longtailscout.com/api/og.svg?q=${encodeURIComponent(query)}`;
  const appUrl = `https://longtailscout.com/?q=${encodeURIComponent(query)}&run=1`;
  const title = `LongTail Scout — ${query}`;
  const desc = `Live prospect scout: net-new operators for "${query}" that Apollo, ZoomInfo, and Clay can't see. Built on Bright Data + DeepSeek + a private ~7M-business demand index.`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(desc)}" />

  <!-- OpenGraph -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://longtailscout.com/share?q=${encodeURIComponent(query)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(desc)}" />
  <meta property="og:image" content="${ogImg}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />

  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(desc)}" />
  <meta name="twitter:image" content="${ogImg}" />

  <!-- Redirect humans to the app -->
  <meta http-equiv="refresh" content="0; url=${escapeHtml(appUrl)}" />
  <script>window.location.replace(${JSON.stringify(appUrl)});</script>
  <style>
    body { font-family: -apple-system, "Inter", sans-serif; background: #F5F0E4; color: #1A1814; padding: 60px; max-width: 720px; margin: 0 auto; }
    a { color: #A8351F; }
  </style>
</head>
<body>
  <p>Redirecting to <a href="${escapeHtml(appUrl)}">LongTail Scout</a>…</p>
  <p style="color:#6B645B;font-size:13px">If your browser doesn't redirect, <a href="${escapeHtml(appUrl)}">click here</a>.</p>
</body>
</html>`;
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300"
    }
  });
}
