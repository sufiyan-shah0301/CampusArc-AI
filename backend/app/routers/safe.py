"""Safe browsing: ML check of a link's address + a disposable server-side browser preview."""
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from ml import service as ml
from ml.urlfeatures import reasons as url_reasons
from .. import sandbox
from ..deps import current_user
from ..ssrf import UnsafeUrl, acheck_url
from .auth import limiter
from fastapi import HTTPException

router = APIRouter(prefix="/api/safe", tags=["safe-browsing"])


class UrlIn(BaseModel):
    url: str = Field(min_length=3, max_length=2048)


class OpenIn(UrlIn):
    javascript: bool = False


def level(score: float) -> str:
    return "high" if score >= 0.7 else "medium" if score >= 0.4 else "low"


@router.post("/check-url")
@limiter.limit("60/minute")
async def check_url(request: Request, body: UrlIn, _: dict = Depends(current_user)):
    """Instant lexical check with the trained phishing model. Nothing is fetched."""
    p = await ml.url_risk(body.url)
    return {"url": body.url, "riskScore": round(p * 100), "riskLevel": level(p), "reasons": url_reasons(body.url)[:5]}


@router.post("/open")
@limiter.limit("8/minute")
async def open_link(request: Request, body: OpenIn, user: dict = Depends(current_user)):
    """Opens the link in a disposable browser on the server and reports what it found. Nothing is stored."""
    try:
        url = await acheck_url(body.url)
    except UnsafeUrl as e:
        raise HTTPException(422, str(e))
    result = await sandbox.open_in_sandbox(url, body.javascript)
    p = await ml.url_risk(result.get("finalUrl") or url)
    page_weight = sum(s["weight"] for s in result.get("signals", []))
    score = min(1.0, 0.65 * p + page_weight)
    reasons = url_reasons(result.get("finalUrl") or url)[:4] + [s["reason"] for s in result.get("signals", [])]
    return {**result, "urlModelScore": round(p * 100), "riskScore": round(score * 100), "riskLevel": level(score), "reasons": reasons[:8]}
