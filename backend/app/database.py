import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# DB location is overridable via APLATFORM_DB (used by the test suite to point
# at a throwaway temp file instead of the shipped a_platform.db).
DB_PATH = os.environ.get(
    "APLATFORM_DB", str(Path(__file__).resolve().parent.parent / "a_platform.db")
)
engine = create_engine(
    f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
