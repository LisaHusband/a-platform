"""robots.txt 合规检查 / robots.txt compliance.

抓取前必须调用 `check`：请求目标域 robots.txt、解析 User-agent 规则、判定 URL 是否
允许，并读取 crawl-delay。结果用于审计（CrawlTask.robots_decision）。
Call `check` before any fetch: it requests the domain's robots.txt, parses the
User-agent rules, decides whether the URL may be fetched, and reads crawl-delay.
The result feeds the audit trail (CrawlTask.robots_decision).
"""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

USER_AGENT = "A-PLATFORM-Bot"

# fetcher(url) -> (status_code, text). Injected so the crawler/tests control I/O.
Fetcher = "callable"


@dataclass
class RobotsDecision:
    allowed: bool
    decision: str  # allowed | disallowed | no_robots
    crawl_delay: float | None
    robots_url: str


def robots_url_for(url: str) -> str:
    parts = urlparse(url)
    return f"{parts.scheme}://{parts.netloc}/robots.txt"


def check(url: str, fetcher, user_agent: str = USER_AGENT) -> RobotsDecision:
    """判定 url 是否允许抓取 / decide whether `url` may be crawled."""
    r_url = robots_url_for(url)
    try:
        status, text = fetcher(r_url)
    except Exception:  # noqa: BLE001 - network failure => treat as no robots
        status, text = 0, ""

    # 无 robots.txt（404/不可达）视为允许 / missing robots => allowed by convention
    if status != 200 or not text.strip():
        return RobotsDecision(True, "no_robots", None, r_url)

    rp = RobotFileParser()
    rp.parse(text.splitlines())
    allowed = rp.can_fetch(user_agent, url)
    try:
        delay = rp.crawl_delay(user_agent)
    except Exception:  # noqa: BLE001
        delay = None
    return RobotsDecision(
        allowed=bool(allowed),
        decision="allowed" if allowed else "disallowed",
        crawl_delay=float(delay) if delay is not None else None,
        robots_url=r_url,
    )
