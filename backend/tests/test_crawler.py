import pytest

from app.models import Content, CrawlSite
from app.services import crawler, dedup, robots
from app.services.extract import extract

HTML = """
<html><head><title>示例文章标题</title>
<meta name="description" content="这是摘要描述。">
<meta name="author" content="张三">
</head><body>
<nav>导航</nav>
<article><h1>正文标题</h1><p>第一段正文内容足够长用于测试抽取。</p>
<p>第二段内容。</p></article>
<script>ignore()</script><footer>页脚</footer>
</body></html>
"""


def make_fetcher(pages: dict[str, tuple[int, str]]):
    def fetch(url):
        if url not in pages:
            raise RuntimeError(f"unexpected fetch {url}")
        return pages[url]
    return fetch


# --- extract / dedup units ---


def test_extract_strips_chrome_and_pulls_fields():
    data = extract(HTML, "https://example.com/post")
    assert data.title == "示例文章标题"
    assert "第一段正文" in data.body
    assert "导航" not in data.body and "页脚" not in data.body
    assert data.author == "张三"
    assert data.source_domain == "example.com"


def test_checksum_and_jaccard():
    assert dedup.checksum("Hello World") == dedup.checksum("hello   world")
    assert dedup.is_near_duplicate("a b c d e", "a b c d e f", threshold=0.7)
    assert not dedup.is_near_duplicate("a b c", "x y z")


# --- robots ---


def test_robots_allows_when_missing():
    fetch = make_fetcher({"https://example.com/robots.txt": (404, "")})
    d = robots.check("https://example.com/page", fetch)
    assert d.allowed and d.decision == "no_robots"


def test_robots_disallow_and_crawl_delay():
    body = "User-agent: *\nDisallow: /private\nCrawl-delay: 5\n"
    fetch = make_fetcher({"https://example.com/robots.txt": (200, body)})
    blocked = robots.check("https://example.com/private/x", fetch)
    assert not blocked.allowed and blocked.decision == "disallowed"
    ok = robots.check("https://example.com/public/x", fetch)
    assert ok.allowed and ok.crawl_delay == 5


def test_robots_network_error_treated_as_allowed():
    def boom(_):
        raise RuntimeError("dns")
    d = robots.check("https://x.test/p", boom)
    assert d.allowed and d.decision == "no_robots"


# --- crawler orchestration ---


def test_crawl_success_creates_pending_content(db):
    fetch = make_fetcher({
        "https://example.com/robots.txt": (200, "User-agent: *\nAllow: /\n"),
        "https://example.com/a": (200, HTML),
    })
    task = crawler.crawl_url(db, "https://example.com/a", fetcher=fetch)
    assert task.status == "done"
    assert task.robots_decision == "allowed"
    content = db.get(Content, task.content_id)
    assert content.status == "pending"
    assert content.source_type == "crawl"
    assert content.source_domain == "example.com"
    assert content.checksum


def test_crawl_blocked_by_robots(db):
    fetch = make_fetcher({
        "https://example.com/robots.txt": (200, "User-agent: *\nDisallow: /\n"),
    })
    task = crawler.crawl_url(db, "https://example.com/secret", fetcher=fetch)
    assert task.status == "disallowed"
    assert task.content_id is None


def test_crawl_url_dedup(db):
    fetch = make_fetcher({
        "https://example.com/robots.txt": (200, "User-agent: *\n"),
        "https://example.com/a": (200, HTML),
    })
    crawler.crawl_url(db, "https://example.com/a", fetcher=fetch)
    again = crawler.crawl_url(db, "https://example.com/a", fetcher=fetch)
    assert again.status == "skipped"
    assert "Duplicate URL" in again.last_error


def test_crawl_content_checksum_dedup(db):
    fetch = make_fetcher({
        "https://example.com/robots.txt": (200, "User-agent: *\n"),
        "https://example.com/a": (200, HTML),
        "https://other.test/robots.txt": (200, "User-agent: *\n"),
        "https://other.test/b": (200, HTML),  # same body, different URL/domain
    })
    crawler.crawl_url(db, "https://example.com/a", fetcher=fetch)
    dup = crawler.crawl_url(db, "https://other.test/b", fetcher=fetch)
    assert dup.status == "skipped"
    assert "checksum" in dup.last_error


def test_crawl_blacklisted_site(db):
    db.add(CrawlSite(domain="bad.test", is_blacklisted=1))
    db.commit()
    fetch = make_fetcher({})
    task = crawler.crawl_url(db, "https://bad.test/x", fetcher=fetch)
    assert task.status == "skipped"


def test_crawl_fetch_failure_records_retry(db):
    def fetch(url):
        if url.endswith("robots.txt"):
            return 200, "User-agent: *\n"
        raise RuntimeError("timeout")
    task = crawler.crawl_url(db, "https://example.com/a", fetcher=fetch)
    assert task.status == "failed"
    assert task.retry_count == 1
    assert "Fetch error" in task.last_error


def test_crawl_non_200(db):
    fetch = make_fetcher({
        "https://example.com/robots.txt": (200, "User-agent: *\n"),
        "https://example.com/a": (503, ""),
    })
    task = crawler.crawl_url(db, "https://example.com/a", fetcher=fetch)
    assert task.status == "failed"
    assert "503" in task.last_error


def test_crawl_invalid_url(db):
    with pytest.raises(ValueError):
        crawler.crawl_url(db, "not-a-url", fetcher=make_fetcher({}))
