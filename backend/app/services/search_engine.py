"""Explainable full-text search.

Deliberately NOT PageRank and NOT behavioral: ranking uses only BM25 term
relevance over title/abstract/body plus explicit, user-visible field matches.
Every hit ships a human-readable breakdown of its score so ranking stays
auditable, per the platform's "no black-box ordering" principle.

Supported query syntax:
    "exact phrase"      phrase match (post-filter)
    -word               exclude documents containing word
    tag:slug            restrict by tag
    category:slug       restrict by category (includes descendants)
    topic:slug          restrict by topic
    type:article        restrict by content type
    lang:zh / lang:en   restrict by language
    author:name         restrict by author name substring
    before:2026-01-01   published before date
    after:2025-01-01    published after date
"""

from __future__ import annotations

import difflib
import math
import re
import threading
import time
from collections import Counter, defaultdict
from dataclasses import dataclass, field

from sqlalchemy.orm import Session, selectinload

from ..models import Category, Content

_CJK = re.compile(r"[一-鿿]")
_TOKEN = re.compile(r"[a-z0-9]+|[一-鿿]+", re.IGNORECASE)

FIELD_WEIGHTS = {"title": 3.0, "abstract": 2.0, "body": 1.0}
K1, B = 1.5, 0.75


def tokenize(text: str) -> list[str]:
    """Latin words as-is (lowercased); CJK runs as overlapping bigrams."""
    tokens: list[str] = []
    for run in _TOKEN.findall(text.lower()):
        if _CJK.search(run):
            if len(run) == 1:
                tokens.append(run)
            else:
                tokens.extend(run[i : i + 2] for i in range(len(run) - 1))
        else:
            tokens.append(run)
    return tokens


@dataclass
class Doc:
    id: int
    title: str
    abstract: str
    body: str
    lang: str
    content_type: str
    author_name: str
    category_path: set[str]
    tag_slugs: set[str]
    topic_slugs: set[str]
    published_at: float | None
    field_tokens: dict[str, list[str]] = field(default_factory=dict)
    length: int = 0


@dataclass
class ParsedQuery:
    terms: list[str]
    phrases: list[str]
    excludes: list[str]
    filters: dict[str, str]
    raw_terms: list[str] = field(default_factory=list)  # user words, for highlighting


def parse_query(raw: str) -> ParsedQuery:
    phrases = re.findall(r'"([^"]+)"', raw)
    rest = re.sub(r'"[^"]+"', " ", raw)
    filters: dict[str, str] = {}
    terms: list[str] = []
    excludes: list[str] = []
    for part in rest.split():
        m = re.match(r"^(tag|category|topic|type|lang|author|before|after):(.+)$", part)
        if m:
            filters[m.group(1)] = m.group(2).lower()
        elif part.startswith("-") and len(part) > 1:
            excludes.append(part[1:].lower())
        else:
            terms.append(part)
    # phrase words also count toward relevance
    term_tokens = tokenize(" ".join(terms + phrases))
    exclude_tokens = [t for w in excludes for t in tokenize(w)]
    return ParsedQuery(term_tokens, phrases, exclude_tokens, filters, raw_terms=terms)


class SearchIndex:
    """In-memory inverted index over published contents."""

    def __init__(self):
        self._lock = threading.Lock()
        self.docs: dict[int, Doc] = {}
        self.postings: dict[str, dict[int, dict[str, int]]] = {}
        self.avg_len = 1.0
        self.vocab: Counter[str] = Counter()
        self.suggest_phrases: list[str] = []

    # ---------- build ----------

    def rebuild(self, db: Session) -> None:
        contents = (
            db.query(Content)
            .options(
                selectinload(Content.tags),
                selectinload(Content.topics),
                selectinload(Content.author),
                selectinload(Content.category),
            )
            .filter(Content.status == "published")
            .all()
        )
        cat_parent = {c.id: c.parent_id for c in db.query(Category).all()}
        cat_slug = {c.id: c.slug for c in db.query(Category).all()}

        docs: dict[int, Doc] = {}
        postings: dict[str, dict[int, dict[str, int]]] = defaultdict(dict)
        vocab: Counter[str] = Counter()
        suggest: set[str] = set()
        total_len = 0

        for c in contents:
            path: set[str] = set()
            cid = c.category_id
            while cid is not None:
                path.add(cat_slug.get(cid, ""))
                cid = cat_parent.get(cid)
            doc = Doc(
                id=c.id,
                title=c.title,
                abstract=c.abstract or "",
                body=c.body or "",
                lang=c.lang,
                content_type=c.content_type,
                author_name=(c.author.name if c.author else "").lower(),
                category_path=path,
                tag_slugs={t.slug for t in c.tags},
                topic_slugs={t.slug for t in c.topics},
                published_at=c.published_at.timestamp() if c.published_at else None,
            )
            for fname, text in (
                ("title", doc.title),
                ("abstract", doc.abstract),
                ("body", doc.body),
            ):
                toks = tokenize(text)
                doc.field_tokens[fname] = toks
                doc.length += len(toks)
                for tok, n in Counter(toks).items():
                    postings[tok].setdefault(c.id, {})[fname] = n
                    vocab[tok] += n
            total_len += doc.length
            docs[c.id] = doc
            suggest.add(c.title)
            suggest.update(t.name_zh for t in c.tags)
            suggest.update(t.name_en for t in c.tags)
            suggest.update(t.name_zh for t in c.topics)
            suggest.update(t.name_en for t in c.topics)

        with self._lock:
            self.docs = docs
            self.postings = dict(postings)
            self.vocab = vocab
            self.avg_len = (total_len / len(docs)) if docs else 1.0
            self.suggest_phrases = sorted(suggest)

    # ---------- query ----------

    def _passes_filters(self, doc: Doc, f: dict[str, str]) -> bool:
        if "tag" in f and f["tag"] not in doc.tag_slugs:
            return False
        if "category" in f and f["category"] not in doc.category_path:
            return False
        if "topic" in f and f["topic"] not in doc.topic_slugs:
            return False
        if "type" in f and doc.content_type != f["type"]:
            return False
        if "lang" in f and doc.lang != f["lang"]:
            return False
        if "author" in f and f["author"] not in doc.author_name:
            return False
        for key, op in (("before", "lt"), ("after", "gt")):
            if key in f:
                try:
                    bound = time.mktime(time.strptime(f[key], "%Y-%m-%d"))
                except ValueError:
                    continue
                if doc.published_at is None:
                    return False
                if op == "lt" and doc.published_at >= bound:
                    return False
                if op == "gt" and doc.published_at <= bound:
                    return False
        return True

    def search(
        self, raw_query: str, sort: str = "relevance"
    ) -> tuple[list[tuple[Doc, float, list[str]]], str | None]:
        q = parse_query(raw_query)
        n_docs = len(self.docs) or 1

        # candidates: docs matching any term, or all (filter-only queries)
        if q.terms:
            candidate_ids: set[int] = set()
            for t in q.terms:
                candidate_ids.update(self.postings.get(t, {}))
        else:
            candidate_ids = set(self.docs)

        results: list[tuple[Doc, float, list[str]]] = []
        for doc_id in candidate_ids:
            doc = self.docs[doc_id]
            if not self._passes_filters(doc, q.filters):
                continue
            if any(doc_id in self.postings.get(x, {}) for x in q.excludes):
                continue
            full_text = f"{doc.title}\n{doc.abstract}\n{doc.body}".lower()
            if any(p.lower() not in full_text for p in q.phrases):
                continue

            score = 0.0
            explanation: list[str] = []
            for t in set(q.terms):
                hit = self.postings.get(t, {}).get(doc_id)
                if not hit:
                    continue
                df = len(self.postings.get(t, {}))
                idf = math.log(1 + (n_docs - df + 0.5) / (df + 0.5))
                term_score = 0.0
                fields_hit = []
                for fname, tf in hit.items():
                    w = FIELD_WEIGHTS[fname]
                    norm = tf * (K1 + 1) / (
                        tf + K1 * (1 - B + B * doc.length / self.avg_len)
                    )
                    term_score += w * idf * norm
                    fields_hit.append(f"{fname}×{tf}")
                score += term_score
                explanation.append(
                    f"term '{t}': bm25={term_score:.2f} (idf={idf:.2f}, {', '.join(fields_hit)})"
                )
            for p in q.phrases:
                score += 2.0
                explanation.append(f'phrase "{p}": exact match bonus +2.00')
            if not q.terms and not q.phrases:
                explanation.append("filter-only query: ordered by publish date")
            results.append((doc, score, explanation))

        if sort == "newest":
            results.sort(key=lambda r: r[0].published_at or 0, reverse=True)
        elif sort == "oldest":
            results.sort(key=lambda r: r[0].published_at or 0)
        elif sort == "title":
            results.sort(key=lambda r: r[0].title)
        else:
            results.sort(key=lambda r: (-r[1], -(r[0].published_at or 0)))

        return results, self.did_you_mean(q.terms, raw_query)

    # ---------- assist ----------

    def did_you_mean(self, terms: list[str], raw: str) -> str | None:
        corrected = raw
        changed = False
        for t in terms:
            if _CJK.search(t) or t in self.postings:
                continue
            close = difflib.get_close_matches(t, self.vocab.keys(), n=1, cutoff=0.78)
            if close:
                corrected = re.sub(rf"\b{re.escape(t)}\b", close[0], corrected)
                changed = True
        return corrected if changed and corrected != raw else None

    def suggest(self, prefix: str, limit: int = 8) -> list[str]:
        p = prefix.strip().lower()
        if not p:
            return []
        starts = [s for s in self.suggest_phrases if s.lower().startswith(p)]
        contains = [
            s for s in self.suggest_phrases
            if p in s.lower() and not s.lower().startswith(p)
        ]
        return (starts + contains)[:limit]

    def snippet(self, doc: Doc, terms: list[str], phrases: list[str], width=160) -> str:
        text = f"{doc.abstract} {doc.body}".replace("\n", " ")
        lower = text.lower()
        pos = -1
        for needle in [p.lower() for p in phrases] + terms:
            pos = lower.find(needle)
            if pos >= 0:
                break
        if pos < 0:
            pos = 0
        start = max(0, pos - width // 3)
        frag = text[start : start + width]
        for needle in sorted(set(terms + [p for p in phrases]), key=len, reverse=True):
            if not needle:
                continue
            frag = re.sub(
                f"({re.escape(needle)})", r"<mark>\1</mark>", frag, flags=re.IGNORECASE
            )
        prefix = "…" if start > 0 else ""
        suffix = "…" if start + width < len(text) else ""
        return f"{prefix}{frag}{suffix}"


INDEX = SearchIndex()
