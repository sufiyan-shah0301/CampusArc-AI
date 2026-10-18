"""Media verification: deepfake detection for images, videos and live frames. Uploaded media is analysed in memory
(videos in a temp file that is deleted immediately) and never stored. Optionally a *summary* report can be kept for 24 h."""
import io
import os
import tempfile
from datetime import timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from PIL import Image, UnidentifiedImageError

from ml import deepfake
from ..db import col
from ..deps import current_user, uid
from ..serialize import doc_out, now
from .auth import limiter

router = APIRouter(prefix="/api/media", tags=["media"])
Image.MAX_IMAGE_PIXELS = 40_000_000             # decompression-bomb guard
MAX_IMAGE, MAX_VIDEO, MAX_FRAME = 8 * 1024 * 1024, 30 * 1024 * 1024, 600 * 1024


def kind_of(head: bytes) -> str | None:
    """Identify the real file type from its first bytes (never trust the file name or Content-Type)."""
    if head[:3] == b"\xff\xd8\xff" or head[:8] == b"\x89PNG\r\n\x1a\n" or (head[:4] == b"RIFF" and head[8:12] == b"WEBP"):
        return "image"
    if head[4:8] == b"ftyp" or head[:4] == b"\x1a\x45\xdf\xa3":
        return "video"
    return None


def open_image(data: bytes) -> Image.Image:
    try:
        Image.open(io.BytesIO(data)).verify()
        img = Image.open(io.BytesIO(data))
        img.load()
        return img.convert("RGB")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, SyntaxError):
        raise HTTPException(422, "This image could not be read. It may be corrupted.")


def need_model():
    if not deepfake.available():
        raise HTTPException(503, "The deepfake model is not installed on this server (run: python -m ml.train_deepfake).")


@router.post("/analyze")
@limiter.limit("12/minute")
async def analyze(request: Request, file: UploadFile = File(...), save: bool = Form(False), user: dict = Depends(current_user)):
    need_model()
    data = await file.read(MAX_VIDEO + 1)
    kind = kind_of(data[:16])
    if kind is None:
        raise HTTPException(415, "Please upload a JPEG, PNG or WebP image, or an MP4 / WebM / MOV video.")
    if (kind == "image" and len(data) > MAX_IMAGE) or len(data) > MAX_VIDEO:
        raise HTTPException(413, f"File is too large (max {MAX_IMAGE // 2**20} MB for images, {MAX_VIDEO // 2**20} MB for videos).")

    if kind == "image":
        result = await deepfake.analyse_image(open_image(data))
    else:
        fd, path = tempfile.mkstemp(suffix=".mp4", prefix="cb_media_")
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(data)
            try:
                result = await deepfake.analyse_video(path)
            except ValueError as e:
                raise HTTPException(422, str(e))
        finally:
            try:
                os.remove(path)                      # automatic data clearance
            except OSError:
                pass
    del data
    result.update({"kind": kind, "filename": os.path.basename(file.filename or "upload")[:80], "cleared": True})
    if save:
        keep = {k: v for k, v in result.items() if k not in ("heatmap", "timeline")}
        await col("media_reports").insert_one({**keep, "userId": uid(user), "createdAt": now(), "expireAt": now() + timedelta(hours=24)})
    return result


@router.post("/frame")
@limiter.limit("100/minute")
async def live_frame(request: Request, file: UploadFile = File(...), user: dict = Depends(current_user)):
    """One webcam frame from the live monitor. Analysed and discarded."""
    need_model()
    data = await file.read(MAX_FRAME + 1)
    if len(data) > MAX_FRAME or kind_of(data[:16]) != "image":
        raise HTTPException(415, "Send a JPEG/PNG frame under 600 KB.")
    r = await deepfake.analyse_frame(open_image(data))
    return {k: r[k] for k in ("fakeProbability", "verdict", "faceFound", "anomalyPercentile")}


@router.get("/reports")
async def my_reports(user: dict = Depends(current_user)):
    return [doc_out(d) async for d in col("media_reports").find({"userId": uid(user)}).sort("createdAt", -1).limit(30)]


@router.delete("/reports")
async def clear_reports(user: dict = Depends(current_user)):
    res = await col("media_reports").delete_many({"userId": uid(user)})
    return {"deleted": res.deleted_count}
