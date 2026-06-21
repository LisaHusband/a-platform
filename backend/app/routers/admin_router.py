"""管理端：内容审核（含审计）与下架处理 / admin moderation + takedowns.

审核动作写入 ReviewRecord（前后状态、操作人、备注），保证可审计、可追溯。
Every moderation action writes a ReviewRecord (before/after status, reviewer,
comment) for auditability.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload

from ..auth import get_optional_user, require_role
from ..database import get_db
from ..models import Category, Content, ReviewRecord, Tag, TakedownRequest, User
from ..schemas import (
    ContentCard,
    ModerationIn,
    Page,
    ReviewRecordOut,
    TakedownIn,
    TakedownOut,
    TakedownResolveIn,
)
from ..services.search_engine import INDEX

router = APIRouter(prefix="/admin", tags=["admin"])

PUBLIC_AFTER = {"approve": "published", "reject": "rejected", "needs_fix": "needs_fix",
                "archive": "archived"}


def _admin_query(db: Session):
    return db.query(Content).options(
        selectinload(Content.tags),
        selectinload(Content.topics),
        selectinload(Content.author),
        selectinload(Content.category),
    )


@router.get("/contents", response_model=Page[ContentCard])
def list_all_contents(
    db: Session = Depends(get_db),
    status: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _: User = Depends(require_role("editor")),
):
    q = _admin_query(db)
    if status:
        q = q.filter(Content.status == status)
    total = q.order_by(None).count()
    items = (
        q.order_by(Content.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return Page(
        items=[ContentCard.model_validate(c) for c in items],
        total=total,
        page=page,
        page_size=page_size,
        has_more=(page - 1) * page_size + page_size < total,
    )


@router.get("/contents/{content_id}/history", response_model=list[ReviewRecordOut])
def history(
    content_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("editor")),
):
    return (
        db.query(ReviewRecord)
        .options(selectinload(ReviewRecord.reviewer))
        .filter(ReviewRecord.content_id == content_id)
        .order_by(ReviewRecord.id.desc())
        .all()
    )


@router.post("/contents/{content_id}/moderate", response_model=ContentCard)
def moderate(
    content_id: int,
    data: ModerationIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("editor")),
):
    content = _admin_query(db).filter(Content.id == content_id).first()
    if not content:
        raise HTTPException(404, "Content not found")
    before = content.status
    action = data.action

    if action in PUBLIC_AFTER:
        content.status = PUBLIC_AFTER[action]
        if action == "approve":
            content.published_at = datetime.now(UTC)
    elif action == "reclassify":
        if not data.category_id:
            raise HTTPException(400, "category_id required to reclassify")
        category = db.get(Category, data.category_id)
        if not category:
            raise HTTPException(400, "Unknown category")
        content.category = category  # set relationship (FK alone won't refresh)
    elif action == "retag":
        slugs = data.tag_slugs or []
        content.tags = db.query(Tag).filter(Tag.slug.in_(slugs)).all()
    elif action == "set_quality":
        if data.quality_score is None:
            raise HTTPException(400, "quality_score required")
        content.quality_score = data.quality_score
    elif action in ("mark_low", "mark_duplicate", "mark_source_issue"):
        content.review_notes = (content.review_notes or "") + f"\n[{action}] {data.comment}"
    else:
        raise HTTPException(400, f"Unknown action '{action}'")

    db.add(
        ReviewRecord(
            content_id=content.id,
            reviewer_id=user.id,
            action=action,
            comment=data.comment,
            before_status=before,
            after_status=content.status,
        )
    )
    db.commit()
    # public visibility changed -> refresh the search index
    if action in ("approve", "archive", "reject"):
        INDEX.rebuild(db)
    return content


# --- 下架/投诉 / takedowns ----------------------------------------------------


@router.post("/takedowns", response_model=TakedownOut, status_code=201, tags=["takedowns"])
def request_takedown(
    data: TakedownIn,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """公开举报/下架入口（无需登录）/ public takedown/complaint intake."""
    if not db.get(Content, data.content_id):
        raise HTTPException(404, "Content not found")
    req = TakedownRequest(
        content_id=data.content_id,
        reason=data.reason,
        requester_email=data.requester_email or (user.email if user else ""),
    )
    db.add(req)
    db.commit()
    return req


@router.get("/takedowns", response_model=list[TakedownOut])
def list_takedowns(
    db: Session = Depends(get_db),
    status: str | None = None,
    _: User = Depends(require_role("editor")),
):
    q = db.query(TakedownRequest)
    if status:
        q = q.filter(TakedownRequest.status == status)
    return q.order_by(TakedownRequest.id.desc()).all()


@router.post("/takedowns/{req_id}/resolve", response_model=TakedownOut)
def resolve_takedown(
    req_id: int,
    data: TakedownResolveIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("editor")),
):
    req = db.get(TakedownRequest, req_id)
    if not req:
        raise HTTPException(404, "Request not found")
    if data.status not in ("resolved", "rejected"):
        raise HTTPException(400, "status must be resolved|rejected")
    req.status = data.status
    req.resolution = data.resolution
    # 受理下架 => 内容归档并移出索引 / accepted takedown archives the content
    if data.status == "resolved":
        content = db.get(Content, req.content_id)
        if content:
            before = content.status
            content.status = "archived"
            db.add(
                ReviewRecord(
                    content_id=content.id,
                    reviewer_id=user.id,
                    action="archive",
                    comment=f"takedown #{req.id}: {data.resolution}",
                    before_status=before,
                    after_status="archived",
                )
            )
    db.commit()
    if data.status == "resolved":
        INDEX.rebuild(db)
    return req
