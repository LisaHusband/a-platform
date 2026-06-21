"""投稿入口 / content submission (paste / URL / file upload).

支持三种来源：粘贴正文、提交网页 URL（走合规爬虫抽取）、上传文件。所有投稿进入
待审队列（status=pending）。
Three sources: pasted body, a web URL (via the compliant crawler/extractor), or
an uploaded file. Every submission enters the review queue (status=pending).
"""

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Content, Tag, Topic, User, utcnow
from ..schemas import ContentDetail, SubmissionIn
from ..services import crawler, dedup, storage

router = APIRouter(prefix="/submissions", tags=["submissions"])

PREVIEW_CHARS = 600


def _detail(content: Content) -> ContentDetail:
    detail = ContentDetail.model_validate(content)
    detail.body = content.body
    detail.has_access = True
    detail.preview = (content.body or "")[:PREVIEW_CHARS]
    detail.sources = content.sources or ""
    return detail


def _attach_taxonomy(db: Session, content: Content, tag_slugs, topic_slugs):
    if tag_slugs:
        content.tags = db.query(Tag).filter(Tag.slug.in_(tag_slugs)).all()
    if topic_slugs:
        content.topics = db.query(Topic).filter(Topic.slug.in_(topic_slugs)).all()


@router.post("", response_model=ContentDetail, status_code=201)
def submit(
    data: SubmissionIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if data.source_type == "url":
        if not data.url:
            raise HTTPException(400, "url required for url submissions")
        try:
            task = crawler.crawl_url(
                db, data.url, fetcher=crawler.default_fetcher,
                category_id=data.category_id, author_id=user.id,
            )
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
        if task.status == "disallowed":
            raise HTTPException(409, "Blocked by robots.txt")
        if task.status == "skipped":
            raise HTTPException(409, task.last_error or "Skipped")
        if task.status != "done" or not task.content_id:
            raise HTTPException(502, task.last_error or "Fetch failed")
        content = db.get(Content, task.content_id)
        return _detail(content)

    # paste
    if not data.title or not data.body:
        raise HTTPException(400, "title and body required for paste submissions")
    content = Content(
        title=data.title,
        body=data.body,
        abstract=data.abstract or data.body[:200],
        lang=data.lang,
        content_type=data.content_type,
        sources=data.sources,
        price=data.price,
        status="pending",
        source_type="paste",
        author_name=data.author_name,
        author_id=user.id,
        category_id=data.category_id,
        checksum=dedup.checksum(data.body),
        fetch_time=utcnow(),
        reading_minutes=max(1, len(data.body) // 600),
    )
    dup = dedup.find_exact_duplicate(db, content.checksum)
    if dup:
        raise HTTPException(409, "Duplicate content already exists")
    _attach_taxonomy(db, content, data.tag_slugs, data.topic_slugs)
    db.add(content)
    db.commit()
    return _detail(content)


@router.post("/file", response_model=ContentDetail, status_code=201)
async def submit_file(
    file: UploadFile = File(...),
    title: str = Form(...),
    content_type: str = Form("article"),
    category_id: int | None = Form(None),
    lang: str = Form("zh"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    raw = await file.read()
    stored = storage.save_upload(file.filename or "upload.bin", raw)
    text = storage.read_text_if_supported(file.filename or "", raw)
    body = text or f"(uploaded file: {file.filename})"
    content = Content(
        title=title,
        body=body,
        abstract=(text[:200] if text else f"上传文件 / uploaded file: {file.filename}"),
        lang=lang,
        content_type=content_type,
        status="pending",
        source_type="file",
        file_path=stored,
        author_id=user.id,
        category_id=category_id,
        checksum=dedup.checksum(body),
        fetch_time=utcnow(),
        reading_minutes=max(1, len(body) // 600),
    )
    db.add(content)
    db.commit()
    return _detail(content)


@router.get("/files/{name}")
def get_file(name: str):
    path = storage.path_for(name)
    if not path.exists():
        raise HTTPException(404, "File not found")
    return FileResponse(path)
