from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterIn(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=8)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    name: str
    role: str

    class Config:
        from_attributes = True


class TokenOut(BaseModel):
    token: str
    user: UserOut


class NamedOut(BaseModel):
    id: int
    slug: str
    name_zh: str
    name_en: str

    class Config:
        from_attributes = True


class CategoryOut(NamedOut):
    parent_id: int | None = None


class TopicOut(NamedOut):
    description_zh: str = ""
    description_en: str = ""


class AuthorOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class ContentCard(BaseModel):
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

    class Config:
        from_attributes = True


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


class PurchaseOut(BaseModel):
    id: int
    content: ContentCard
    price_paid: float
    created_at: datetime

    class Config:
        from_attributes = True


class SubscriptionOut(BaseModel):
    id: int
    plan: str
    topic: TopicOut | None
    started_at: datetime
    expires_at: datetime

    class Config:
        from_attributes = True


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
