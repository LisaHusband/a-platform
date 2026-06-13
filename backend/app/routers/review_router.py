from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_role
from ..database import get_db
from ..models import Content, ReviewEvent, User
from ..schemas import ContentCard, ReviewIn
from ..services.rules import run_tier1

router = APIRouter(prefix="/review", tags=["review"])


@router.get("/queue", response_model=list[ContentCard])
def queue(
    db: Session = Depends(get_db),
    user: User = Depends(require_role("editor", "expert")),
):
    statuses = (
        ["tier1_passed"] if user.role == "editor" else ["tier2_passed"]
    )
    if user.role == "admin":
        statuses = ["pending", "tier1_passed", "tier2_passed"]
    return db.query(Content).filter(Content.status.in_(statuses)).all()


@router.post("/{content_id}/tier1")
def tier1(
    content_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Run the fixed explainable rule set. Author or editor may trigger it."""
    content = db.get(Content, content_id)
    if not content:
        raise HTTPException(404, "Content not found")
    if content.author_id != user.id and user.role not in ("editor", "admin"):
        raise HTTPException(403, "Not your content")
    if content.status != "pending":
        raise HTTPException(409, f"Tier-1 runs on 'pending', current: '{content.status}'")
    passed, score, results = run_tier1(
        content.title, content.body, content.abstract, content.sources
    )
    detail = "\n".join(
        f"[{'PASS' if r.passed else 'FAIL'}] {r.rule}: {r.message}"
        + (f" (-{r.penalty})" if r.penalty else "")
        for r in results
    )
    content.status = "tier1_passed" if passed else "rejected"
    content.review_notes = f"Tier-1 score {score}/100\n{detail}"
    db.add(
        ReviewEvent(
            content_id=content.id,
            tier=1,
            verdict="pass" if passed else "reject",
            detail=detail,
        )
    )
    db.commit()
    return {
        "passed": passed,
        "score": score,
        "rules": [
            {"rule": r.rule, "passed": r.passed, "message": r.message, "penalty": r.penalty}
            for r in results
        ],
        "status": content.status,
    }


@router.post("/{content_id}/tier2")
def tier2(
    content_id: int,
    data: ReviewIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("editor")),
):
    return _human_review(
        db, user, content_id, data, tier=2,
        from_status="tier1_passed", to_status="tier2_passed",
    )


@router.post("/{content_id}/tier3")
def tier3(
    content_id: int,
    data: ReviewIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("expert")),
):
    return _human_review(
        db, user, content_id, data, tier=3,
        from_status="tier2_passed", to_status="tier2_passed",
    )


def _human_review(db, user, content_id, data: ReviewIn, tier, from_status, to_status):
    content = db.get(Content, content_id)
    if not content:
        raise HTTPException(404, "Content not found")
    if content.status != from_status:
        raise HTTPException(
            409, f"Tier-{tier} expects '{from_status}', current: '{content.status}'"
        )
    if data.verdict not in ("pass", "reject"):
        raise HTTPException(400, "verdict must be pass|reject")
    content.status = to_status if data.verdict == "pass" else "rejected"
    db.add(
        ReviewEvent(
            content_id=content.id,
            tier=tier,
            reviewer_id=user.id,
            verdict=data.verdict,
            detail=data.detail,
        )
    )
    db.commit()
    return {"status": content.status}
