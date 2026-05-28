# longtail-scout-bridge

A tiny HTTP service that bridges the Cloudflare Worker to Bright Data's Browser API (which is WSS/CDP-only, not REST-accessible). Designed to run on a single home-server box, exposed via a Cloudflare Tunnel hostname.

## Why this exists

Bright Data's Browser API (the only zone type provisionable on the LongTail Scout account without a payment method on file) can only be driven via WebSocket using the Chrome DevTools Protocol. Cloudflare Workers cannot run Playwright. So we run Playwright here and expose two simple endpoints:

- `POST /render { url, waitMs?, selector? }` — fetch any URL via Bright Data's remote Chrome, return rendered HTML.
- `POST /serp { query, num? }` — perform a Google search via Bright Data's remote Chrome, return parsed organic results.
- `GET /health` — liveness.

## Deploy

### 1. Install on the host (e.g. 192.168.1.29 alongside the demand API)

```bash
cd /path/to/longtail-scout-bridge
cp .env.example .env
# Edit .env — BRIDGE_AUTH_TOKEN is REQUIRED in production (server refuses to start
# with NODE_ENV=production unless it's set). Generate with: openssl rand -hex 32
npm ci         # bridge ships package-lock.json — use npm here, not pnpm
npm start
```

Expected log:
```
[bridge] connecting to Bright Data Browser API…
[bridge] connected
[bridge] listening on :8081
```

### 2. Optional systemd unit for persistence

`/etc/systemd/system/longtail-scout-bridge.service`:
```
[Unit]
Description=LongTail Scout bridge
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/longtail-scout-bridge
EnvironmentFile=/path/to/longtail-scout-bridge/.env
ExecStart=/usr/bin/node --enable-source-maps --import tsx server.ts
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

### 3. Add a CF Tunnel route

In the existing tunnel (e.g. `quiltmap-r720`), add a public hostname:
- Subdomain: `bridge`
- Domain: `longtailscout.com`
- Service: `http://localhost:8081`

This gives the Worker a callable URL: `https://bridge.longtailscout.com/render`.

## Auth

`BRIDGE_AUTH_TOKEN` is **required when `NODE_ENV=production`** — the server refuses to start otherwise. The bridge sits behind a public CF Tunnel, so an empty token would expose Bright Data render endpoints to anyone on the internet (and burn our BD credits).

In production: all non-`/health` requests require `Authorization: Bearer <token>`. The Worker passes this from its own `BRIDGE_AUTH_TOKEN` secret.

In local dev (no `NODE_ENV`): empty `BRIDGE_AUTH_TOKEN` is allowed but logs a warning.

## Why playwright-core (not playwright)

We connect to a remote browser via `chromium.connectOverCDP(...)` — no local browser binaries needed. `playwright-core` is the same API surface without bundled browsers, so installs are fast and the image stays small.
