"""合规爬虫编排 / compliant crawl orchestration.

流程：解析域名 → 站点黑/白名单 → URL 去重 → robots 校验 → 抓取 → 正文抽取 →
内容指纹去重 → 入库（待审）并记录任务与审计。网络 I/O 通过 `fetcher` 注入，便于
测试与替换实现。
Flow: resolve domain → site allow/deny → URL dedup → robots check → fetch →
extract → fingerprint dedup → store (pending) with task + audit. Network I/O is
injected via `fetcher` for testability.
"""

from __future__ import annotations

import urllib.request
from urllib.parse import urlparse

from sqlalchemy.orm import Session

from ..models import Content, CrawlSite, CrawlTask, utcnow
from . import dedup, robots
from .extract import extract


def default_fetcher(url: str) -> tuple[int, str]:
    """标准库抓取器 / stdlib fetcher returning (status_code, text)."""
    req = urllib.request.Request(url, headers={"User-Agent": robots.USER_AGENT})
    with urllib.request.urlopen(req, timeout=15) as resp:  # noqa: S310 - http(s) only
        charset = resp.headers.get_content_charset() or "utf-8"
        return resp.status, resp.read().decode(charset, errors="replace")


def get_or_create_site(db: Session, domain: str) -> CrawlSite:
    site = db.query(CrawlSite).filter(CrawlSite.domain == domain).first()
    if not site:
        site = CrawlSite(domain=domain)
        db.add(site)
        db.flush()
    return site


def crawl_url(
    db: Session,
    url: str,
    *,
    fetcher=default_fetcher,
    category_id: int | None = None,
    author_id: int | None = None,
) -> CrawlTask:
    """抓取单个 URL 并返回任务记录 / crawl one URL, returning its task record."""
    domain = urlparse(url).netloc
    if not domain:
        raise ValueError("Invalid URL")

    site = get_or_create_site(db, domain)
    task = CrawlTask(site_id=site.id, domain=domain, url=url, status="queued")
    db.add(task)
    db.flush()

    # 1. 站点黑名单 / blacklist
    if site.is_blacklisted or not site.allowed:
        task.status = "skipped"
        task.last_error = "Domain blacklisted or not allowed"
        db.commit()
        return task

    # 2. URL 去重 / URL-level dedup
    if dedup.find_url_duplicate(db, url):
        task.status = "skipped"
        task.last_error = "Duplicate URL already ingested"
        db.commit()
        return task

    # 3. robots 合规 / robots compliance
    decision = robots.check(url, fetcher)
    task.robots_decision = decision.decision
    if decision.crawl_delay is not None:
        site.crawl_delay = decision.crawl_delay
    if not decision.allowed:
        task.status = "disallowed"
        task.last_error = "Blocked by robots.txt"
        db.commit()
        return task

    # 4. 抓取 / fetch (with retry accounting)
    try:
        status, html = fetcher(url)
    except Exception as exc:  # noqa: BLE001
        task.status = "failed"
        task.retry_count += 1
        task.last_error = f"Fetch error: {exc}"
        task.next_run_at = utcnow()
        db.commit()
        return task
    if status != 200:
        task.status = "failed"
        task.retry_count += 1
        task.last_error = f"HTTP {status}"
        task.next_run_at = utcnow()
        db.commit()
        return task

    # 5. 抽取 + 指纹去重 / extract + fingerprint dedup
    data = extract(html, url)
    digest = dedup.checksum(data.body)
    if dedup.find_exact_duplicate(db, digest):
        task.status = "skipped"
        task.last_error = "Duplicate content (checksum match)"
        db.commit()
        return task

    content = Content(
        title=data.title,
        body=data.body or data.summary or data.title,
        abstract=data.summary,
        lang="zh",
        content_type="article",
        status="pending",
        source_type="crawl",
        source_url=url,
        source_domain=domain,
        author_name=data.author,
        category_id=category_id,
        author_id=author_id,
        fetch_time=utcnow(),
        checksum=digest,
        reading_minutes=max(1, len(data.body) // 600),
    )
    db.add(content)
    db.flush()
    task.status = "done"
    task.content_id = content.id
    db.commit()
    return task
