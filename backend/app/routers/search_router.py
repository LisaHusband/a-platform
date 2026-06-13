import time

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Content
from ..schemas import ContentCard, SearchHit, SearchOut
from ..services.search_engine import INDEX, parse_query

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=SearchOut)
def search(
    q: str = Query("", max_length=300),
    sort: str = Query("relevance", pattern="^(relevance|newest|oldest|title)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    t0 = time.perf_counter()
    results, dym = INDEX.search(q, sort=sort)
    parsed = parse_query(q)
    window = results[(page - 1) * page_size : page * page_size]
    ids = [doc.id for doc, _, _ in window]
    rows = (
        db.query(Content)
        .options(
            selectinload(Content.tags),
            selectinload(Content.topics),
            selectinload(Content.author),
            selectinload(Content.category),
        )
        .filter(Content.id.in_(ids))
        .all()
    )
    by_id = {c.id: c for c in rows}
    hits = [
        SearchHit(
            content=ContentCard.model_validate(by_id[doc.id]),
            score=round(score, 3),
            snippet=INDEX.snippet(doc, parsed.raw_terms or parsed.terms, parsed.phrases),
            explanation=explanation,
        )
        for doc, score, explanation in window
        if doc.id in by_id
    ]
    return SearchOut(
        query=q,
        total=len(results),
        page=page,
        page_size=page_size,
        took_ms=round((time.perf_counter() - t0) * 1000, 2),
        did_you_mean=dym,
        hits=hits,
    )


@router.get("/suggest", response_model=list[str])
def suggest(q: str = Query("", max_length=100)):
    return INDEX.suggest(q)
