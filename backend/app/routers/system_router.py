"""Operational endpoints used by the deploy pipeline's health checks.

`/health` reports liveness plus dependency status (DB, search index); `/version`
reports the running release. Both live under /api/v1 like every other endpoint.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.search_engine import INDEX
from ..version import APP_NAME, APP_VERSION

router = APIRouter(tags=["system"])


def _db_ok(db: Session) -> bool:
    try:
        db.execute(text("SELECT 1"))
        return True
    except Exception:  # noqa: BLE001 - any failure means "not connected"
        return False


@router.get("/health")
def health(db: Session = Depends(get_db)):
    """Liveness + readiness. Returns 200 with a per-dependency breakdown.

    `status` is "ok" only when every dependency is healthy, so a deploy's
    post-checks can assert on it.
    """
    db_ok = _db_ok(db)
    index_ok = len(INDEX.docs) > 0
    return {
        "status": "ok" if (db_ok and index_ok) else "degraded",
        "version": APP_VERSION,
        "indexed_docs": len(INDEX.docs),
        "dependencies": {
            "database": "ok" if db_ok else "error",
            "search_index": "ok" if index_ok else "empty",
        },
    }


@router.get("/version")
def version():
    return {"name": APP_NAME, "version": APP_VERSION}
