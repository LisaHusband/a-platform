"""HTML 正文抽取 / lightweight HTML content extraction.

仅用标准库 html.parser：去除 script/style/nav/footer/aside 等无关模块，提取标题、
meta 描述、作者与正文段落。面向 MVP 的规则式清洗，不依赖第三方解析器。
Stdlib-only (html.parser): strips script/style/nav/footer/aside, then pulls the
title, meta description, author and body paragraphs. Rule-based MVP cleaning.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from html.parser import HTMLParser
from urllib.parse import urlparse

_DROP_TAGS = {"script", "style", "nav", "footer", "aside", "form", "noscript", "header"}
_BLOCK_TAGS = {"p", "div", "section", "article", "br", "li", "h1", "h2", "h3", "h4"}


class _Extractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ""
        self.meta_desc = ""
        self.meta_author = ""
        self.meta_pubtime = ""
        self._chunks: list[str] = []
        self._skip_depth = 0
        self._in_title = False

    def handle_starttag(self, tag, attrs):
        if tag in _DROP_TAGS:
            self._skip_depth += 1
        if tag == "title":
            self._in_title = True
        if tag == "meta":
            a = dict(attrs)
            name = (a.get("name") or a.get("property") or "").lower()
            content = a.get("content") or ""
            if name in ("description", "og:description") and not self.meta_desc:
                self.meta_desc = content
            elif name in ("author", "article:author") and not self.meta_author:
                self.meta_author = content
            elif (
                name in ("article:published_time", "publishdate", "date")
                and not self.meta_pubtime
            ):
                self.meta_pubtime = content
        if tag in _BLOCK_TAGS and self._skip_depth == 0:
            self._chunks.append("\n")

    def handle_endtag(self, tag):
        if tag in _DROP_TAGS and self._skip_depth > 0:
            self._skip_depth -= 1
        if tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title:
            self.title += data
            return
        if self._skip_depth == 0:
            text = data.strip()
            if text:
                self._chunks.append(text)

    @property
    def text(self) -> str:
        raw = " ".join(self._chunks)
        # collapse whitespace, keep paragraph breaks
        raw = re.sub(r"[ \t]+", " ", raw)
        raw = re.sub(r"\n\s*\n+", "\n\n", raw)
        return raw.strip()


@dataclass
class Extracted:
    title: str
    body: str
    summary: str
    author: str
    publish_time: str
    source_domain: str
    extras: dict = field(default_factory=dict)


def extract(html: str, url: str = "") -> Extracted:
    p = _Extractor()
    p.feed(html or "")
    body = p.text
    title = (p.title or "").strip()
    if not title:
        # fall back to first heading-ish line
        first = body.split("\n", 1)[0] if body else ""
        title = first[:120]
    summary = (p.meta_desc or body[:200]).strip()
    domain = urlparse(url).netloc if url else ""
    return Extracted(
        title=title or "Untitled",
        body=body,
        summary=summary,
        author=(p.meta_author or "").strip(),
        publish_time=(p.meta_pubtime or "").strip(),
        source_domain=domain,
    )
