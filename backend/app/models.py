from datetime import UTC, datetime

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
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
    title = Column(String, nullable=False)
    subtitle = Column(String, default="")
    body = Column(Text, nullable=False)  # markdown
    abstract = Column(Text, default="")  # free preview text
    lang = Column(String, default="zh")  # zh | en
    content_type = Column(String, default="article")  # article | report | series | video | audio
    sources = Column(Text, default="")  # cited sources, one per line
    price = Column(Float, default=0.0)  # 0 = included in subscription only
    is_standalone_purchase = Column(Integer, default=1)
    status = Column(String, default="pending")
    # pending | tier1_passed | tier2_passed | published | rejected
    review_notes = Column(Text, default="")
    author_id = Column(Integer, ForeignKey("users.id"))
    category_id = Column(Integer, ForeignKey("categories.id"))
    published_at = Column(DateTime, nullable=True)
    reading_minutes = Column(Integer, default=10)

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
