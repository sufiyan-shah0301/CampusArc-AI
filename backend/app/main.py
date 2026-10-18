import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .config import get_settings
from .db import close_db, init_db
from .routers import ai, auth, crud, special, ws
from .routers import insights, integrity, media, reports, safe, security
from .routers import ml as ml_router


def warm_up_models() -> None:
    """Load the ML models in the background so the first user request is not the one that pays the load time."""
    try:
        from ml import service

        service._embedder()
        service._resume_model()
        service._fake_models()
        service._placement()
        service._salary()
        service._families()
        service._phishing()
        from ml import deepfake

        if deepfake.available():
            deepfake._bundle()
            deepfake._clip()
        print("[ML] models warmed up")
    except Exception as e:  # the API still works; models then load lazily
        print(f"[ML] warm-up skipped: {type(e).__name__}: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    warm = asyncio.create_task(asyncio.to_thread(warm_up_models))
    yield
    warm.cancel()
    await close_db()


app = FastAPI(title="CampusArc AI API", version="1.0.0", lifespan=lifespan)
app.state.limiter = auth.limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(CORSMiddleware, allow_origins=get_settings().cors_list, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])


@app.middleware("http")
async def security_headers(request: Request, call_next):
    resp = await call_next(request)
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("X-Frame-Options", "DENY")
    resp.headers.setdefault("Referrer-Policy", "no-referrer")
    return resp


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    print(f"[ERROR] {request.method} {request.url.path}: {type(exc).__name__}: {exc}")
    return JSONResponse({"detail": "Internal server error"}, status_code=500)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# order matters: specific routes first, the generic /{collection} routes last
app.include_router(auth.router)
app.include_router(ai.router)
app.include_router(ml_router.router)
app.include_router(insights.router)
app.include_router(security.router)
app.include_router(safe.router)
app.include_router(media.router)
app.include_router(reports.router)
app.include_router(integrity.router)
app.include_router(special.router)
app.include_router(ws.router)
app.include_router(crud.router)
