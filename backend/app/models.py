from datetime import UTC, datetime

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import declarative_mixin, declared_attr, relationship

from .database import Base


def utcnow():
    return datetime.now(UTC)


# --- Reusable column mixins (shared type hierarchy) ---------------------------


@declarative_mixin
class IdMixin:
    """Surrogate integer primary key shared by every table."""

    id = Column(Integer, primary_key=True)


@declarative_mixin
class TimestampMixin:
    """`created_at` audit column, populated on insert."""

    @declared_attr
    def created_at(cls):  # noqa: N805 - SQLAlchemy declared_attr convention
        return Column(DateTime, default=utcnow)


@declarative_mixin
class NamedSlugMixin(IdMixin):
    """Bilingual, slug-addressable taxonomy node (Category / Tag / Topic)."""

    slug = Column(String, unique=True, nullable=False)
    name_zh = Column(String, nullable=False)
    name_en = Column(String, nullable=False)


content_tags = Table(
    "content_tags",
    Base.metadata,
    Column("content_id", ForeignKey("contents.id"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id"), primary_key=True),
)

content_topics = Table(
    "content_topics",
    Base.metadata,
    Column("content_id", ForeignKey("contents.id"), primary_key=True),
    Column("topic_id", ForeignKey("topics.id"), primary_key=True),
)


class User(IdMixin, TimestampMixin, Base):
    __tablename__ = "users"
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="reader")  # reader | author | editor | expert | admin
    # 测试用户免费余额（元）/ free sandbox wallet balance (RMB)
    balance = Column(Float, default=1000.0)

    purchases = relationship("Purchase", back_populates="user")
    subscriptions = relationship("Subscription", back_populates="user")


class Category(NamedSlugMixin, Base):
    __tablename__ = "categories"
    parent_id = Column(Integer, ForeignKey("categories.id"), nullable=True)

    children = relationship("Category")


class Tag(NamedSlugMixin, Base):
    __tablename__ = "tags"


class Topic(NamedSlugMixin, Base):
    __tablename__ = "topics"
    description_zh = Column(Text, default="")
    description_en = Column(Text, default="")


class Content(IdMixin, TimestampMixin, Base):
    __tablename__ = "contents"
    # 面向百万级目录的复合索引：按状态过滤 + 时间/分类排序，保证毫秒级分页。
    # Composite indexes for million-scale catalog: filter by status, then order
    # by time / scope, keeping paginated browse queries in the millisecond range.
    __table_args__ = (
        Index("ix_contents_status_published", "status", "published_at"),
        Index("ix_contents_status_category", "status", "category_id"),
        Index("ix_contents_status_type", "status", "content_type"),
        Index("ix_contents_status_lang", "status", "lang"),
        Index("ix_contents_checksum", "checksum"),
        Index("ix_contents_source_domain", "source_domain"),
    )
    title = Column(String, nullable=False)
    subtitle = Column(String, default="")
    body = Column(Text, nullable=False)  # markdown
    abstract = Column(Text, default="")  # free preview text / summary
    lang = Column(String, default="zh")  # zh | en
    content_type = Column(String, default="article")  # article | report | series | video | audio
    sources = Column(Text, default="")  # cited sources, one per line
    price = Column(Float, default=0.0)  # 0 = included in subscription only
    is_standalone_purchase = Column(Integer, default=1)
    status = Column(String, default="pending")
    # pending | tier1_passed | tier2_passed | published | rejected | needs_fix | archived
    review_notes = Column(Text, default="")
    author_id = Column(Integer, ForeignKey("users.id"))
    category_id = Column(Integer, ForeignKey("categories.id"))
    published_at = Column(DateTime, nullable=True)
    reading_minutes = Column(Integer, default=10)
    # 来源与采集元数据 / provenance & ingestion metadata
    source_type = Column(String, default="manual")  # manual | url | file | crawl | rss
    source_url = Column(String, default="")
    source_domain = Column(String, default="")
    author_name = Column(String, default="")  # original author (vs platform author_id)
    file_path = Column(String, default="")  # stored upload, if any
    publish_time = Column(DateTime, nullable=True)  # original publish time
    fetch_time = Column(DateTime, nullable=True)  # when crawled/ingested
    quality_score = Column(Float, default=0.0)
    checksum = Column(String, default="")  # sha256 of normalized body (dedup)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    author = relationship("User")
    category = relationship("Category")
    tags = relationship("Tag", secondary=content_tags)
    topics = relationship("Topic", secondary=content_topics)


class ContentRelation(IdMixin, Base):
    """Knowledge-graph edge between two contents (explicit, editorial)."""

    __tablename__ = "content_relations"
    __table_args__ = (UniqueConstraint("src_id", "dst_id", "relation"),)
    src_id = Column(Integer, ForeignKey("contents.id"), nullable=False)
    dst_id = Column(Integer, ForeignKey("contents.id"), nullable=False)
    relation = Column(String, default="related")  # related | cites | follows | contrasts


class Purchase(IdMixin, TimestampMixin, Base):
    __tablename__ = "purchases"
    __table_args__ = (UniqueConstraint("user_id", "content_id"),)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content_id = Column(Integer, ForeignKey("contents.id"), nullable=False)
    price_paid = Column(Float, default=0.0)

    user = relationship("User", back_populates="purchases")
    content = relationship("Content")


class Subscription(IdMixin, Base):
    __tablename__ = "subscriptions"
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    plan = Column(String, default="monthly")  # monthly | topic
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=True)
    started_at = Column(DateTime, default=utcnow)
    expires_at = Column(DateTime, nullable=False)

    user = relationship("User", back_populates="subscriptions")
    topic = relationship("Topic")


class ReviewEvent(IdMixin, TimestampMixin, Base):
    __tablename__ = "review_events"
    content_id = Column(Integer, ForeignKey("contents.id"), nullable=False)
    tier = Column(Integer, nullable=False)  # 1 | 2 | 3
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    verdict = Column(String, nullable=False)  # pass | reject
    detail = Column(Text, default="")  # explainable rule hits / editor notes


# --- 支付 / Payments ----------------------------------------------------------


class PaymentOrder(IdMixin, TimestampMixin, Base):
    """沙箱支付订单 / sandbox payment order.

    method=balance 即时扣减钱包；alipay/paypal 模拟「创建->跳转->回调确认」流程。
    Balance pays instantly; alipay/paypal simulate create -> approve -> callback.
    """

    __tablename__ = "payment_orders"
    __table_args__ = (Index("ix_orders_user_status", "user_id", "status"),)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    kind = Column(String, nullable=False)  # content | subscription
    ref = Column(String, nullable=False)  # content id, or "monthly" / "topic:<slug>"
    amount = Column(Float, nullable=False)
    method = Column(String, nullable=False)  # balance | alipay | paypal
    status = Column(String, default="created")  # created | paid | failed | canceled
    provider_txn = Column(String, default="")  # simulated provider transaction id

    user = relationship("User")


# --- 采集与合规 / Crawling & compliance --------------------------------------


class CrawlSite(IdMixin, TimestampMixin, Base):
    """爬虫站点配置 / per-domain crawl configuration."""

    __tablename__ = "crawl_sites"
    domain = Column(String, unique=True, nullable=False)
    start_url = Column(String, default="")
    sitemap_url = Column(String, default="")
    allowed = Column(Integer, default=1)  # operator allow flag
    is_blacklisted = Column(Integer, default=0)
    crawl_delay = Column(Float, default=1.0)  # seconds (min interval)
    max_concurrency = Column(Integer, default=2)


class CrawlTask(IdMixin, TimestampMixin, Base):
    """抓取任务 / a single fetch task with retry + robots audit trail."""

    __tablename__ = "crawl_tasks"
    __table_args__ = (Index("ix_crawltasks_status_next", "status", "next_run_at"),)
    site_id = Column(Integer, ForeignKey("crawl_sites.id"), nullable=True)
    domain = Column(String, nullable=False)
    url = Column(String, nullable=False)
    priority = Column(Integer, default=0)
    status = Column(String, default="queued")
    # queued | fetching | done | failed | skipped | disallowed
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    next_run_at = Column(DateTime, nullable=True)
    last_error = Column(Text, default="")
    robots_decision = Column(String, default="")  # allowed | disallowed | no_robots
    content_id = Column(Integer, ForeignKey("contents.id"), nullable=True)


class ReviewRecord(IdMixin, TimestampMixin, Base):
    """审核审计记录 / auditable moderation action with status transition."""

    __tablename__ = "review_records"
    content_id = Column(Integer, ForeignKey("contents.id"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)
    # approve | reject | needs_fix | archive | reclassify | retag | mark_low |
    # mark_duplicate | mark_source_issue | set_quality
    comment = Column(Text, default="")
    before_status = Column(String, default="")
    after_status = Column(String, default="")

    reviewer = relationship("User")


class TakedownRequest(IdMixin, TimestampMixin, Base):
    """下架/投诉请求 / rights-holder takedown or complaint."""

    __tablename__ = "takedown_requests"
    content_id = Column(Integer, ForeignKey("contents.id"), nullable=False)
    requester_email = Column(String, default="")
    reason = Column(Text, nullable=False)
    status = Column(String, default="open")  # open | resolved | rejected
    resolution = Column(Text, default="")

    content = relationship("Content")
