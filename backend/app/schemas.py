from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORMModel(BaseModel):
    """Base for every schema projected from an ORM row.

    Centralises `from_attributes=True` so subclasses can be built with
    `Model.model_validate(orm_obj)` without repeating per-class config.
    """

    model_config = ConfigDict(from_attributes=True)


class RegisterIn(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=8)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(ORMModel):
    id: int
    email: str
    name: str
    role: str


class TokenOut(BaseModel):
    token: str
    user: UserOut


class NamedOut(ORMModel):
    id: int
    slug: str
    name_zh: str
    name_en: str


class CategoryOut(NamedOut):
    parent_id: int | None = None


class TopicOut(NamedOut):
    description_zh: str = ""
    description_en: str = ""


class AuthorOut(ORMModel):
    id: int
    name: str


class ContentCard(ORMModel):
    """List/preview projection — never includes the paid body."""

    id: int
    title: str
    subtitle: str
    abstract: str
    lang: str
    content_type: str
    price: float
    status: str
    reading_minutes: int
    published_at: datetime | None
    author: AuthorOut | None
    category: CategoryOut | None
    tags: list[NamedOut] = []
    topics: list[NamedOut] = []


class ContentDetail(ContentCard):
    body: str | None = None  # None when locked behind paywall
    sources: str = ""
    has_access: bool = False
    preview: str = ""  # leading slice of body, always available


class ContentIn(BaseModel):
    title: str = Field(min_length=4)
    subtitle: str = ""
    body: str = Field(min_length=1)
    abstract: str = ""
    lang: str = "zh"
    content_type: str = "article"
    sources: str = ""
    price: float = 0.0
    category_id: int
    tag_slugs: list[str] = []
    topic_slugs: list[str] = []


class ReviewIn(BaseModel):
    verdict: str  # pass | reject
    detail: str = ""


class PurchaseOut(ORMModel):
    id: int
    content: ContentCard
    price_paid: float
    created_at: datetime


class SubscriptionOut(ORMModel):
    id: int
    plan: str
    topic: TopicOut | None
    started_at: datetime
    expires_at: datetime


class SubscribeIn(BaseModel):
    plan: str = "monthly"
    topic_slug: str | None = None


class SearchHit(BaseModel):
    content: ContentCard
    score: float
    snippet: str
    explanation: list[str]  # human-readable scoring breakdown


class SearchOut(BaseModel):
    query: str
    total: int
    page: int
    page_size: int
    took_ms: float
    did_you_mean: str | None
    hits: list[SearchHit]


class GraphNode(BaseModel):
    id: int
    title: str
    content_type: str
    topic_slugs: list[str]


class GraphEdge(BaseModel):
    src: int
    dst: int
    relation: str


class GraphOut(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
