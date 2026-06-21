"""贴吧式讨论社区 / Tieba-style discussion community.

提供：吧（板块）、主题帖、楼层回复、点赞、置顶/锁定/精华、分页与搜索。
Boards, threads, floor replies, likes, pin/lock/feature moderation, pagination
and search. This module is an explicit social addition layered beside the core
(otherwise non-social) content platform.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from ..auth import get_current_user, require_role
from ..database import get_db
from ..models import Board, Like, Post, Thread, User, utcnow
from ..schemas import (
    BoardIn,
    BoardOut,
    Page,
    PostIn,
    PostOut,
    ThreadCard,
    ThreadDetail,
    ThreadIn,
    ThreadModerationIn,
)

router = APIRouter(prefix="/community", tags=["community"])


# --- 吧 / Boards --------------------------------------------------------------


@router.get("/boards", response_model=list[BoardOut])
def list_boards(db: Session = Depends(get_db)):
    return db.query(Board).order_by(Board.thread_count.desc(), Board.id).all()


@router.post("/boards", response_model=BoardOut, status_code=201)
def create_board(
    data: BoardIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("editor")),
):
    if db.query(Board).filter(Board.slug == data.slug).first():
        raise HTTPException(409, "Board slug already exists")
    board = Board(slug=data.slug, name=data.name, description=data.description)
    db.add(board)
    db.commit()
    return board


def _board_or_404(db: Session, slug: str) -> Board:
    board = db.query(Board).filter(Board.slug == slug).first()
    if not board:
        raise HTTPException(404, "Board not found")
    return board


# --- 主题帖 / Threads ---------------------------------------------------------


def _threads_query(db: Session):
    return db.query(Thread).options(selectinload(Thread.author))


@router.get("/boards/{slug}/threads", response_model=Page[ThreadCard])
def list_threads(
    slug: str,
    db: Session = Depends(get_db),
    q: str | None = Query(None, description="标题/正文关键词 / title+body keyword"),
    sort: str = Query("latest", pattern="^(latest|hot|new)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    board = _board_or_404(db, slug)
    query = _threads_query(db).filter(Thread.board_id == board.id)
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(or_(Thread.title.like(like), Thread.body.like(like)))
    total = query.order_by(None).count()
    # 置顶帖始终在前 / pinned threads always first, then by chosen sort
    if sort == "hot":
        order = (Thread.is_pinned.desc(), Thread.reply_count.desc(), Thread.like_count.desc())
    elif sort == "new":
        order = (Thread.is_pinned.desc(), Thread.created_at.desc())
    else:  # latest activity
        order = (Thread.is_pinned.desc(), Thread.last_activity_at.desc())
    items = query.order_by(*order).offset((page - 1) * page_size).limit(page_size).all()
    return Page(
        items=[ThreadCard.model_validate(t) for t in items],
        total=total,
        page=page,
        page_size=page_size,
        has_more=(page - 1) * page_size + page_size < total,
    )


@router.post("/boards/{slug}/threads", response_model=ThreadDetail, status_code=201)
def create_thread(
    slug: str,
    data: ThreadIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    board = _board_or_404(db, slug)
    thread = Thread(
        board_id=board.id,
        author_id=user.id,
        title=data.title,
        body=data.body,
        last_activity_at=utcnow(),
    )
    db.add(thread)
    board.thread_count += 1
    db.commit()
    db.refresh(thread)
    return thread


@router.get("/threads/{thread_id}", response_model=ThreadDetail)
def get_thread(thread_id: int, db: Session = Depends(get_db)):
    thread = _threads_query(db).filter(Thread.id == thread_id).first()
    if not thread:
        raise HTTPException(404, "Thread not found")
    thread.views += 1
    db.commit()
    return thread


@router.get("/threads/{thread_id}/posts", response_model=Page[PostOut])
def list_posts(
    thread_id: int,
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=100),
):
    if not db.get(Thread, thread_id):
        raise HTTPException(404, "Thread not found")
    base = db.query(Post).options(selectinload(Post.author)).filter(Post.thread_id == thread_id)
    total = base.order_by(None).count()
    items = base.order_by(Post.floor.asc()).offset((page - 1) * page_size).limit(page_size).all()
    return Page(
        items=[PostOut.model_validate(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
        has_more=(page - 1) * page_size + page_size < total,
    )


@router.post("/threads/{thread_id}/posts", response_model=PostOut, status_code=201)
def reply(
    thread_id: int,
    data: PostIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    thread = db.get(Thread, thread_id)
    if not thread:
        raise HTTPException(404, "Thread not found")
    if thread.is_locked:
        raise HTTPException(409, "Thread is locked")
    # 楼层 = 现有回复数 + 2（1 楼为楼主帖）/ floor = replies + 2 (OP is floor 1)
    next_floor = thread.reply_count + 2
    post = Post(thread_id=thread_id, author_id=user.id, body=data.body, floor=next_floor)
    db.add(post)
    thread.reply_count += 1
    thread.last_activity_at = utcnow()
    db.commit()
    db.refresh(post)
    return post


# --- 点赞 / Likes -------------------------------------------------------------


def _toggle_like(db: Session, user: User, target_type: str, target_id: int, owner) -> dict:
    existing = (
        db.query(Like)
        .filter(
            Like.user_id == user.id,
            Like.target_type == target_type,
            Like.target_id == target_id,
        )
        .first()
    )
    if existing:
        db.delete(existing)
        owner.like_count = max(0, owner.like_count - 1)
        liked = False
    else:
        db.add(Like(user_id=user.id, target_type=target_type, target_id=target_id))
        owner.like_count += 1
        liked = True
    db.commit()
    return {"liked": liked, "like_count": owner.like_count}


@router.post("/threads/{thread_id}/like")
def like_thread(
    thread_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    thread = db.get(Thread, thread_id)
    if not thread:
        raise HTTPException(404, "Thread not found")
    return _toggle_like(db, user, "thread", thread_id, thread)


@router.post("/posts/{post_id}/like")
def like_post(
    post_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    post = db.get(Post, post_id)
    if not post:
        raise HTTPException(404, "Post not found")
    return _toggle_like(db, user, "post", post_id, post)


# --- 版务 / Moderation --------------------------------------------------------


@router.post("/threads/{thread_id}/moderate", response_model=ThreadCard)
def moderate_thread(
    thread_id: int,
    data: ThreadModerationIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("editor")),
):
    thread = _threads_query(db).filter(Thread.id == thread_id).first()
    if not thread:
        raise HTTPException(404, "Thread not found")
    actions = {
        "pin": ("is_pinned", 1),
        "unpin": ("is_pinned", 0),
        "lock": ("is_locked", 1),
        "unlock": ("is_locked", 0),
        "feature": ("is_featured", 1),
        "unfeature": ("is_featured", 0),
    }
    if data.action not in actions:
        raise HTTPException(400, "Unknown moderation action")
    field, value = actions[data.action]
    setattr(thread, field, value)
    db.commit()
    return thread


# --- 搜索 / Search ------------------------------------------------------------


@router.get("/search", response_model=Page[ThreadCard])
def search_threads(
    db: Session = Depends(get_db),
    q: str = Query("", description="跨吧搜索主题帖 / search threads across boards"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    query = _threads_query(db)
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(or_(Thread.title.like(like), Thread.body.like(like)))
    total = query.order_by(None).count()
    items = (
        query.order_by(Thread.last_activity_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return Page(
        items=[ThreadCard.model_validate(t) for t in items],
        total=total,
        page=page,
        page_size=page_size,
        has_more=(page - 1) * page_size + page_size < total,
    )
