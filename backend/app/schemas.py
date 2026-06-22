from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORMModel(BaseModel):
    """Base for every schema projected from an ORM row.

    Centralises `from_attributes=True` so subclasses can be built with
    `Model.model_validate(orm_obj)` without repeating per-class config.
    """

    model_config = ConfigDict(from_attributes=True)


class Page[T](BaseModel):
    """通用分页信封 / generic pagination envelope."""

    items: list[T]
    total: int
    page: int
    page_size: int
    has_more: bool


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
    balance: float = 0.0


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
    # 来源标注 / provenance attribution
    source_type: str = "manual"
    source_url: str = ""
    source_domain: str = ""
    author_name: str = ""
    quality_score: float = 0.0


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


# --- 支付 / Payments ----------------------------------------------------------


class WalletOut(BaseModel):
    balance: float
    currency: str = "CNY"


class PaymentCreateIn(BaseModel):
    kind: str  # content | subscription
    ref: str  # content id (as str), or "monthly" / "topic:<slug>"
    method: str = "balance"  # balance | alipay | paypal


class PaymentOrderOut(ORMModel):
    id: int
    kind: str
    ref: str
    amount: float
    method: str
    status: str
    provider_txn: str
    created_at: datetime


class PaymentCreateOut(BaseModel):
    order: PaymentOrderOut
    # 沙箱跳转/二维码：balance 直接 paid，第三方返回模拟支付地址。
    # Sandbox redirect/QR: balance is paid immediately; third parties return a
    # simulated approval URL (and a QR payload for Alipay).
    approval_url: str | None = None
    qr_code: str | None = None


# --- 投稿 / Submissions -------------------------------------------------------


class SubmissionIn(BaseModel):
    source_type: str = "paste"  # paste | url
    url: str = ""
    title: str = ""
    body: str = ""
    abstract: str = ""
    author_name: str = ""
    lang: str = "zh"
    content_type: str = "article"
    sources: str = ""
    price: float = 0.0
    category_id: int | None = None
    tag_slugs: list[str] = []
    topic_slugs: list[str] = []


# --- 采集与合规 / Crawling -----------------------------------------------------


class CrawlSiteIn(BaseModel):
    domain: str = Field(min_length=3)
    start_url: str = ""
    sitemap_url: str = ""
    allowed: int = 1
    is_blacklisted: int = 0
    crawl_delay: float = 1.0
    max_concurrency: int = 2


class CrawlSiteOut(ORMModel):
    id: int
    domain: str
    start_url: str
    sitemap_url: str
    allowed: int
    is_blacklisted: int
    crawl_delay: float
    max_concurrency: int


class CrawlTaskOut(ORMModel):
    id: int
    domain: str
    url: str
    status: str
    retry_count: int
    robots_decision: str
    last_error: str
    content_id: int | None
    created_at: datetime


class CrawlEnqueueIn(BaseModel):
    url: str = Field(min_length=8)
    category_id: int | None = None


class RobotsCheckOut(BaseModel):
    allowed: bool
    decision: str
    crawl_delay: float | None
    robots_url: str


# --- 审核审计 / Moderation -----------------------------------------------------


class ModerationIn(BaseModel):
    action: str  # approve | reject | needs_fix | archive | reclassify | retag | set_quality
    comment: str = ""
    category_id: int | None = None
    tag_slugs: list[str] | None = None
    quality_score: float | None = None


class ReviewRecordOut(ORMModel):
    id: int
    action: str
    comment: str
    before_status: str
    after_status: str
    reviewer: AuthorOut | None
    created_at: datetime


# --- 下架/投诉 / Takedowns -----------------------------------------------------


class TakedownIn(BaseModel):
    content_id: int
    reason: str = Field(min_length=4)
    requester_email: str = ""


class TakedownResolveIn(BaseModel):
    status: str  # resolved | rejected
    resolution: str = ""


class TakedownOut(ORMModel):
    id: int
    content_id: int
    requester_email: str
    reason: str
    status: str
    resolution: str
    created_at: datetime
