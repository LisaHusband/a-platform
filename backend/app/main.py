from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, SessionLocal, engine
from .routers import (
    admin_router,
    auth_router,
    billing_router,
    contents_router,
    crawl_router,
    payments_router,
    review_router,
    search_router,
    sitemap_router,
    submissions_router,
    system_router,
    taxonomy_router,
)
from .seed import seed_if_empty
from .services.search_engine import INDEX
from .version import APP_VERSION


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    db = SessionLocal()
    try:
        seed_if_empty(db)
        INDEX.rebuild(db)
    finally:
        db.close()
    yield


app = FastAPI(title="A-PLATFORM", version=APP_VERSION, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:15173", "http://127.0.0.1:15173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"

app.include_router(auth_router.router, prefix=API_PREFIX)
app.include_router(contents_router.router, prefix=API_PREFIX)
app.include_router(taxonomy_router.router, prefix=API_PREFIX)
app.include_router(search_router.router, prefix=API_PREFIX)
app.include_router(review_router.router, prefix=API_PREFIX)
app.include_router(billing_router.router, prefix=API_PREFIX)
app.include_router(payments_router.router, prefix=API_PREFIX)
app.include_router(submissions_router.router, prefix=API_PREFIX)
app.include_router(crawl_router.router, prefix=API_PREFIX)
app.include_router(admin_router.router, prefix=API_PREFIX)
app.include_router(system_router.router, prefix=API_PREFIX)
app.include_router(sitemap_router.router)  # /sitemap.xml stays at site root
