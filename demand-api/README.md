# LongTail Scout — demand-index API

A tiny **read-only** HTTP service over the business-scrape table
(`overlordng2.public.results`) that powers LongTail Scout's "demand index" — the
**7M-business moat**. Split out of the `domainsearch` (domain-buying) app so LongTail
Scout owns its own endpoint instead of riding on an unrelated product.

It is drop-in compatible with the paths + response shapes the worker already calls, so
`DEMAND_API_BASE` points here with **no worker code change**.

## Endpoints
- `GET /health` → `{"ok": true, "service": "demand-index"}`
- `GET /api/research?q=<niche>` → `{"query", "demand", "results": []}` — demand count only
  (index-assisted by the GIN trigram indexes on `name`/`category`, so sub-second).
- `GET /api/businesses?q=&city=&state=&limit=` → `{"query","city","state","count","businesses":[…]}`
  — geotagged records; **exact** (case-insensitive) city match.

## Why it's safe
- Connects with a **read-only** DB role (`scraper_ro`) and only runs `SELECT`s.
- No write paths, no domain-registrar calls, no LLM — just two queries.

## Run / deploy (on the box that can reach the scraper DB, e.g. 192.168.1.29)
```bash
python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
export SCRAPER_DATABASE_URL='postgresql+psycopg://scraper_ro:***@192.168.1.29:5432/overlordng2'
uvicorn app:app --host 0.0.0.0 --port 8090
```
Optional env (defaults shown): `SCRAPER_SCHEMA=public SCRAPER_TABLE=results
SCRAPER_NAME_COL=name SCRAPER_CATEGORY_COL=category`.

Production runs under `deploy/longtail-demand-index.service` (systemd), reachable by the
`quiltmap-r720` Cloudflare Tunnel at `demand.longtailscout.com` (ingress
`http://192.168.1.29:8090`, managed via the Cloudflare API).
