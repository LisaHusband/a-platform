from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload

from ..auth import get_current_user, get_optional_user
from ..database import get_db
from ..models import Category, Content, ContentRelation, Tag, Topic, User
from ..schemas import (
    ContentCard,
    ContentDetail,
    ContentIn,
    GraphEdge,
    GraphNode,
    GraphOut,
    Page,
)
from ..services.access import has_access
from ..services.search_engine import INDEX

router = APIRouter(prefix="/contents", tags=["contents"])

PREVIEW_CHARS = 600


def _published(db: Session):
    return (
        db.query(Content)
        .options(
            selectinload(Content.tags),
            selectinload(Content.topics),
            selectinload(Content.author),
            selectinload(Content.category),
        )
        .filter(Content.status == "published")
    )


def _cards_in_order(db: Session, ids: list[int]) -> list[Content]:
    """按给定 id 顺序取回内容卡 / fetch content rows preserving the given id order."""
    if not ids:
        return []
    rows = _published(db).filter(Content.id.in_(ids)).all()
    by_id = {c.id: c for c in rows}
    return [by_id[i] for i in ids if i in by_id]


@router.get("", response_model=Page[ContentCard])
def list_contents(
    db: Session = Depends(get_db),
    category: str | None = None,
    tag: str | None = None,
    topic: str | None = None,
    content_type: str | None = None,
    lang: str | None = None,
    q: str | None = Query(None, description="关键词/关键字 / keyword search"),
    sort: str = Query("newest", pattern="^(relevance|newest|oldest|title)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """分类索引：分页 + 关键词检索。

    关键词查询走内存倒排索引（毫秒级，面向百万级目录），可叠加分类/标签/专题/
    类型/语言过滤；纯过滤浏览走带复合索引的数据库查询。
    Keyword queries use the in-memory inverted index (millisecond, million-scale)
    with optional facet filters; pure-filter browse uses indexed DB queries.
    """
    offset = (page - 1) * page_size

    # --- 关键词路径：复用可解释搜索索引 / keyword path via the search index ----
    if q and q.strip():
        raw = q.strip()
        if category:
            raw += f" category:{category}"
        if tag:
            raw += f" tag:{tag}"
        if topic:
            raw += f" topic:{topic}"
        if content_type:
            raw += f" type:{content_type}"
        if lang:
            raw += f" lang:{lang}"
        results, _ = INDEX.search(raw, sort=sort if sort != "newest" else "relevance")
        total = len(results)
        ids = [doc.id for doc, _, _ in results[offset : offset + page_size]]
        items = _cards_in_order(db, ids)
        return Page(
            items=[ContentCard.model_validate(c) for c in items],
            total=total,
            page=page,
            page_size=page_size,
            has_more=offset + page_size < total,
        )

    # --- 纯过滤路径：数据库复合索引 / pure-filter path via indexed DB query ----
    query = _published(db)
    if category:
        cat = db.query(Category).filter(Category.slug == category).first()
        if not cat:
            raise HTTPException(404, "Unknown category")
        ids = [cat.id]
        frontier = [cat.id]
        all_cats = db.query(Category).all()
        while frontier:
            children = [c.id for c in all_cats if c.parent_id in frontier]
            ids.extend(children)
            frontier = children
        query = query.filter(Content.category_id.in_(ids))
    if tag:
        query = query.join(Content.tags).filter(Tag.slug == tag)
    if topic:
        query = query.join(Content.topics).filter(Topic.slug == topic)
    if content_type:
        query = query.filter(Content.content_type == content_type)
    if lang:
        query = query.filter(Content.lang == lang)

    total = query.order_by(None).count()
    if sort == "oldest":
        query = query.order_by(Content.published_at.asc())
    elif sort == "title":
        query = query.order_by(Content.title.asc())
    else:  # newest / relevance fallback
        query = query.order_by(Content.published_at.desc())
    items = query.offset(offset).limit(page_size).all()
    return Page(
        items=[ContentCard.model_validate(c) for c in items],
        total=total,
        page=page,
        page_size=page_size,
        has_more=offset + page_size < total,
    )


@router.get("/graph", response_model=GraphOut)
def knowledge_graph(db: Session = Depends(get_db), topic: str | None = None):
    q = _published(db)
    if topic:
        q = q.join(Content.topics).filter(Topic.slug == topic)
    contents = q.all()
    ids = {c.id for c in contents}
    edges = (
        db.query(ContentRelation)
        .filter(ContentRelation.src_id.in_(ids), ContentRelation.dst_id.in_(ids))
        .all()
    )
    return GraphOut(
        nodes=[
            GraphNode(
                id=c.id,
                title=c.title,
                content_type=c.content_type,
                topic_slugs=[t.slug for t in c.topics],
            )
            for c in contents
        ],
        edges=[GraphEdge(src=e.src_id, dst=e.dst_id, relation=e.relation) for e in edges],
    )


@router.get("/{content_id}", response_model=ContentDetail)
def get_content(
    content_id: int,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    content = _published(db).filter(Content.id == content_id).first()
    if not content:
        # author/editor can see their own unpublished items
        content = db.get(Content, content_id)
        if not content or not user or (
            content.author_id != user.id and user.role not in ("editor", "expert", "admin")
        ):
            raise HTTPException(404, "Content not found")
    detail = ContentDetail.model_validate(content)
    detail.sources = content.sources or ""
    detail.preview = (content.body or "")[:PREVIEW_CHARS]
    if has_access(db, user, content):
        detail.has_access = True
        detail.body = content.body
    else:
        detail.has_access = False
        detail.body = None
    return detail


@router.get("/{content_id}/related", response_model=list[ContentCard])
def related(content_id: int, db: Session = Depends(get_db)):
    """Explicit editorial relations only — no behavioral 'you may also like'."""
    edges = db.query(ContentRelation).filter(
        (ContentRelation.src_id == content_id) | (ContentRelation.dst_id == content_id)
    ).all()
    other_ids = {e.dst_id if e.src_id == content_id else e.src_id for e in edges}
    if not other_ids:
        return []
    return _published(db).filter(Content.id.in_(other_ids)).all()


@router.post("", response_model=ContentDetail, status_code=201)
def create_content(
    data: ContentIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not db.get(Category, data.category_id):
        raise HTTPException(400, "Unknown category")
    content = Content(
        title=data.title,
        subtitle=data.subtitle,
        body=data.body,
        abstract=data.abstract,
        lang=data.lang,
        content_type=data.content_type,
        sources=data.sources,
        price=data.price,
        category_id=data.category_id,
        author_id=user.id,
        status="pending",
        reading_minutes=max(1, len(data.body) // 600),
    )
    content.tags = db.query(Tag).filter(Tag.slug.in_(data.tag_slugs)).all()
    content.topics = db.query(Topic).filter(Topic.slug.in_(data.topic_slugs)).all()
    db.add(content)
    db.commit()
    detail = ContentDetail.model_validate(content)
    detail.body = content.body
    detail.has_access = True
    detail.preview = content.body[:PREVIEW_CHARS]
    return detail


@router.post("/{content_id}/publish", response_model=ContentCard)
def publish(
    content_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role not in ("editor", "admin"):
        raise HTTPException(403, "Editors only")
    content = db.get(Content, content_id)
    if not content:
        raise HTTPException(404, "Content not found")
    if content.status not in ("tier1_passed", "tier2_passed"):
        raise HTTPException(409, f"Cannot publish from status '{content.status}'")
    content.status = "published"
    content.published_at = datetime.now(UTC)
    db.commit()
    INDEX.rebuild(db)
    return content
