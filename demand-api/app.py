"""LongTail Scout — demand-index read API.

A tiny, read-only HTTP service over the business-scrape table (overlordng2.public.results)
that powers LongTail Scout's "demand index". Split out of the domainsearch (domain-buying)
app so LongTail Scout owns its own endpoint and doesn't ride on an unrelated product.

It speaks the same paths + response shapes the worker already calls, so DEMAND_API_BASE can
point here with **no worker code change**:

  GET /health
  GET /api/research?q=<niche>                      -> {"query","demand","results":[]}
  GET /api/businesses?q=&city=&state=&limit=        -> {"query","city","state","count","businesses":[...]}

Read-only by construction: connects with a read-only DB role and only ever runs SELECTs.

Run:  uvicorn app:app --host 127.0.0.1 --port 8090
Env:  SCRAPER_DATABASE_URL (required, read-only role), and optionally
      SCRAPER_SCHEMA / SCRAPER_TABLE / SCRAPER_NAME_COL / SCRAPER_CATEGORY_COL
      (default public / results / name / category).
"""
import os
import re

from fastapi import FastAPI, Header, HTTPException, Query
from sqlalchemy import create_engine, text

DB_URL = os.environ["SCRAPER_DATABASE_URL"]
# When set, data endpoints require Authorization: Bearer <token>. The demand index is the moat;
# this keeps anonymous traffic from enumerating it. Unset = open (so it's safe to deploy before
# the worker has the matching secret). /health stays open.
_API_TOKEN = os.environ.get("DEMAND_API_TOKEN")
_SCHEMA = os.environ.get("SCRAPER_SCHEMA", "public")
_TABLE = os.environ.get("SCRAPER_TABLE", "results")
_NAME_COL = os.environ.get("SCRAPER_NAME_COL", "name")
_CAT_COL = os.environ.get("SCRAPER_CATEGORY_COL", "category")

_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _ident(name: str) -> str:
    if not _IDENT.match(name):
        raise ValueError(f"unsafe identifier: {name!r}")
    return name


SCHEMA = _ident(_SCHEMA)
TABLE = _ident(_TABLE)
NAME_COL = _ident(_NAME_COL)
CAT_COL = _ident(_CAT_COL)

engine = create_engine(DB_URL, pool_pre_ping=True, pool_size=4, max_overflow=4)
app = FastAPI(title="longtail-scout demand-index", docs_url=None, redoc_url=None)


def _require_auth(authorization: str | None) -> None:
    if _API_TOKEN and authorization != f"Bearer {_API_TOKEN}":
        raise HTTPException(status_code=401, detail="unauthorized")


@app.get("/health")
def health() -> dict:
    return {"ok": True, "service": "demand-index"}


@app.get("/api/research")
def research(
    q: str,
    # accepted (and ignored) for drop-in compatibility with the old domainsearch path:
    count_only: bool = Query(default=True),
    tlds: list[str] | None = Query(default=None),
    authorization: str | None = Header(default=None),
) -> dict:
    """Demand count = how many indexed businesses match this niche keyword. Index-assisted by the
    GIN trigram indexes on (name, category), so this is sub-second."""
    _require_auth(authorization)
    sql = text(
        f"SELECT count(*) FROM {SCHEMA}.{TABLE} "
        f"WHERE {NAME_COL} ILIKE :pat OR {CAT_COL} ILIKE :pat"
    )
    with engine.connect() as conn:
        n = int(conn.execute(sql, {"pat": f"%{q}%"}).scalar_one())
    return {"query": q, "demand": n, "results": []}


@app.get("/api/businesses")
def businesses(
    q: str,
    city: str | None = None,
    state: str | None = None,
    limit: int = Query(default=50, ge=1, le=1000),
    authorization: str | None = Header(default=None),
) -> dict:
    """Geotagged business records for a niche (+ optional exact city / state)."""
    _require_auth(authorization)
    where = [
        f"({NAME_COL} ILIKE :q_pat OR {CAT_COL} ILIKE :q_pat)",
        "latitude IS NOT NULL",
        "longitude IS NOT NULL",
    ]
    params: dict = {"q_pat": f"%{q}%", "lim": limit}
    if city:
        # Exact (case-insensitive) city match — substring ILIKE over-matched ("York" -> New York,
        # Yorktown, Yorkville). Exact still catches metros that straddle a state line (Kansas City MO+KS).
        where.append("LOWER(city) = LOWER(:city_exact)")
        params["city_exact"] = city
    if state:
        where.append("(state ILIKE :state_pat OR state = :state_exact)")
        params["state_pat"] = f"%{state}%"
        params["state_exact"] = state

    sql = text(
        "SELECT name, city, state, latitude, longitude, rating, review_count, website, category, full_address "
        f"FROM {SCHEMA}.{TABLE} WHERE " + " AND ".join(where) +
        " ORDER BY review_count DESC NULLS LAST, rating DESC NULLS LAST LIMIT :lim"
    )
    with engine.connect() as conn:
        rows = conn.execute(sql, params).fetchall()

    records = [
        {
            "name": r.name,
            "city": r.city,
            "state": r.state,
            "lat": float(r.latitude) if r.latitude is not None else None,
            "lng": float(r.longitude) if r.longitude is not None else None,
            "rating": float(r.rating) if r.rating is not None else None,
            "review_count": r.review_count or 0,
            "website": r.website,
            "category": r.category,
            "address": r.full_address,
        }
        for r in rows
    ]
    return {"query": q, "city": city, "state": state, "count": len(records), "businesses": records}
