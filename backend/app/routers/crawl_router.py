"""爬虫与站点管理 / crawl & site management (editor/admin only).

录入站点、配置 robots 策略与抓取频率、入队抓取任务、预览 robots 判定。
Register sites, configure crawl policy/frequency, enqueue crawl tasks, and
preview robots decisions.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..auth import require_role
from ..database import get_db
from ..models import CrawlSite, CrawlTask, User
from ..schemas import (
    CrawlEnqueueIn,
    CrawlSiteIn,
    CrawlSiteOut,
    CrawlTaskOut,
    RobotsCheckOut,
)
from ..services import crawler, robots

router = APIRouter(prefix="/crawl", tags=["crawl"])


@router.get("/sites", response_model=list[CrawlSiteOut])
def list_sites(
    db: Session = Depends(get_db),
    _: User = Depends(require_role("editor")),
):
    return db.query(CrawlSite).order_by(CrawlSite.domain).all()


@router.post("/sites", response_model=CrawlSiteOut, status_code=201)
def create_site(
    data: CrawlSiteIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("editor")),
):
    if db.query(CrawlSite).filter(CrawlSite.domain == data.domain).first():
        raise HTTPException(409, "Site already exists")
    site = CrawlSite(**data.model_dump())
    db.add(site)
    db.commit()
    return site


@router.patch("/sites/{site_id}", response_model=CrawlSiteOut)
def update_site(
    site_id: int,
    data: CrawlSiteIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("editor")),
):
    site = db.get(CrawlSite, site_id)
    if not site:
        raise HTTPException(404, "Site not found")
    for k, v in data.model_dump().items():
        setattr(site, k, v)
    db.commit()
    return site


@router.get("/tasks", response_model=list[CrawlTaskOut])
def list_tasks(
    db: Session = Depends(get_db),
    status: str | None = None,
    _: User = Depends(require_role("editor")),
):
    q = db.query(CrawlTask)
    if status:
        q = q.filter(CrawlTask.status == status)
    return q.order_by(CrawlTask.id.desc()).limit(200).all()


@router.post("/tasks", response_model=CrawlTaskOut, status_code=201)
def enqueue(
    data: CrawlEnqueueIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("editor")),
):
    """抓取一个 URL（合规检查 + 抽取 + 去重）/ crawl a URL end-to-end."""
    try:
        task = crawler.crawl_url(
            db, data.url, fetcher=crawler.default_fetcher, category_id=data.category_id
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return task


@router.get("/check-robots", response_model=RobotsCheckOut)
def check_robots(
    url: str = Query(..., min_length=8),
    _: User = Depends(require_role("editor")),
):
    decision = robots.check(url, crawler.default_fetcher)
    return RobotsCheckOut(
        allowed=decision.allowed,
        decision=decision.decision,
        crawl_delay=decision.crawl_delay,
        robots_url=decision.robots_url,
    )
