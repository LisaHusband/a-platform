"""Dynamic XML sitemap.

Lists public static routes plus every published content detail page so external
search engines can index the (free) abstracts and previews. Set SITE_BASE_URL to
the production origin; defaults to the live domain. Served at the site root (no
/api prefix) per the sitemaps protocol. robots.txt stays a static frontend asset
and points here.
"""

import os
from datetime import UTC
from xml.sax.saxutils import escape

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Content

router = APIRouter(tags=["sitemap"])

BASE_URL = os.environ.get("SITE_BASE_URL", "https://www.a-platform.tech").rstrip("/")

STATIC_ROUTES = [
    ("/", "daily", "1.0"),
    ("/browse", "daily", "0.8"),
    ("/graph", "weekly", "0.6"),
]


def _url(loc: str, changefreq: str, priority: str, lastmod: str | None = None) -> str:
    parts = [f"    <loc>{escape(loc)}</loc>"]
    if lastmod:
        parts.append(f"    <lastmod>{lastmod}</lastmod>")
    parts.append(f"    <changefreq>{changefreq}</changefreq>")
    parts.append(f"    <priority>{priority}</priority>")
    body = "\n".join(parts)
    return f"  <url>\n{body}\n  </url>"


@router.get("/sitemap.xml")
def sitemap(db: Session = Depends(get_db)):
    urls = [_url(f"{BASE_URL}{path}", freq, pri) for path, freq, pri in STATIC_ROUTES]

    contents = (
        db.query(Content)
        .filter(Content.status == "published")
        .order_by(Content.published_at.desc())
        .all()
    )
    for c in contents:
        lastmod = None
        if c.published_at:
            dt = c.published_at
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=UTC)
            lastmod = dt.date().isoformat()
        urls.append(_url(f"{BASE_URL}/content/{c.id}", "weekly", "0.7", lastmod))

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>\n"
    )
    return Response(content=xml, media_type="application/xml")
