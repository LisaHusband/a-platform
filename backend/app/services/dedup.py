"""去重 / deduplication.

URL 级与内容指纹级去重：checksum 为正文归一化后的 sha256（精确重复）；near-dup 用
token 集合的 Jaccard 相似度标记重复候选。
URL-level and content-fingerprint dedup: `checksum` is the sha256 of the
normalized body (exact duplicates); near-duplicates are flagged via Jaccard
similarity over token sets.
"""

from __future__ import annotations

import hashlib
import re

from sqlalchemy.orm import Session

from ..models import Content

NEAR_DUP_THRESHOLD = 0.85
_WORD = re.compile(r"[a-z0-9]+|[一-鿿]", re.IGNORECASE)


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


def checksum(body: str) -> str:
    return hashlib.sha256(normalize(body).encode("utf-8")).hexdigest()


def find_exact_duplicate(db: Session, digest: str, exclude_id: int | None = None) -> Content | None:
    if not digest:
        return None
    q = db.query(Content).filter(Content.checksum == digest)
    if exclude_id is not None:
        q = q.filter(Content.id != exclude_id)
    return q.first()


def find_url_duplicate(db: Session, source_url: str) -> Content | None:
    if not source_url:
        return None
    return db.query(Content).filter(Content.source_url == source_url).first()


def _tokens(text: str) -> set[str]:
    return set(_WORD.findall((text or "").lower()))


def jaccard(a: str, b: str) -> float:
    ta, tb = _tokens(a), _tokens(b)
    if not ta or not tb:
        return 0.0
    inter = len(ta & tb)
    union = len(ta | tb)
    return inter / union if union else 0.0


def is_near_duplicate(a: str, b: str, threshold: float = NEAR_DUP_THRESHOLD) -> bool:
    return jaccard(a, b) >= threshold
