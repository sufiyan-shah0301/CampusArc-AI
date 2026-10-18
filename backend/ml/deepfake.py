"""Inference for the deepfake detector: still images, video (sampled frames + temporal consistency) and single live frames.
Everything is processed in memory / a short-lived temp file; nothing is kept."""
import asyncio
import base64
import threading
from functools import lru_cache
from pathlib import Path

import cv2
import imagehash
import joblib
import numpy as np
from PIL import Image

from .mediafeatures import FORENSIC_NAMES, crop_face, ela_heatmap_png, forensic, prep

MODELS = Path(__file__).parent / "models"
_lock = threading.Lock()
_slots = asyncio.Semaphore(2)

HUMAN = {
    "ela_": "Compression error pattern is unusual (typical of edited or synthesised regions)",
    "noise_": "Sensor-noise statistics differ from real camera photos",
    "lap_var": "Sharpness / micro-texture differs from real photos",
    "edge_density": "Edge structure differs from real photos",
    "sobel_mean": "Edge structure differs from real photos",
    "fft_": "Frequency spectrum shows generator-like patterns",
    "sat_": "Colour saturation statistics are unusual",
    "hue_std": "Colour distribution is unusual",
    "rg_corr": "Colour-channel correlation is unusual", "gb_corr": "Colour-channel correlation is unusual",
    "cb_std": "Chroma statistics are unusual", "cr_std": "Chroma statistics are unusual", "luma_": "Brightness statistics are unusual",
}


class DeepfakeModelMissing(RuntimeError):
    pass


@lru_cache(maxsize=1)
def _bundle() -> dict:
    with _lock:
        p = MODELS / "deepfake.joblib"
        if not p.exists():
            raise DeepfakeModelMissing("Deepfake model not trained. Run: python -m ml.train_deepfake")
        return joblib.load(p)


@lru_cache(maxsize=1)
def _clip():
    with _lock:
        from sentence_transformers import SentenceTransformer

        return SentenceTransformer(_bundle()["clip"])


@lru_cache(maxsize=1)
def _phash_index():
    p = MODELS / "phash_index.npz"
    if not p.exists():
        return None
    d = np.load(p, allow_pickle=False)
    return d["hashes"].astype(np.uint64), d["labels"]


def available() -> bool:
    return (MODELS / "deepfake.joblib").exists()


def _explain(F: np.ndarray, b: dict) -> list[str]:
    """Which forensic signals deviate most from real images, weighted by how much the Random Forest relies on them."""
    z = (b["scaler"].transform(F)[0])
    imp = b["rf"].feature_importances_
    order = np.argsort(-(np.abs(z) * imp))[:6]
    out = []
    for i in order:
        name = FORENSIC_NAMES[i]
        if abs(z[i]) < 1.5:
            continue
        text = next((v for k, v in HUMAN.items() if name.startswith(k)), None)
        if text and text not in out:
            out.append(text)
    return out[:3]


def _logit(p: np.ndarray) -> np.ndarray:
    p = np.clip(p, 1e-4, 1 - 1e-4)
    return np.log(p / (1 - p))


def _score(img: Image.Image, *, detail: bool) -> dict:
    b = _bundle()
    face, found = crop_face(img)
    F = forensic(face).reshape(1, -1)
    E = _clip().encode([prep(face)], normalize_embeddings=True, show_progress_bar=False)
    p_lr = float(b["lr"].predict_proba(E)[0, 1])
    p_mlp = float(b["mlp"].predict_proba(E)[0, 1])
    p_rf = float(b["rf"].predict_proba(F)[0, 1])
    p = float(b["stack"].predict_proba(_logit(np.array([[p_lr, p_mlp, p_rf]])))[0, 1])     # stacked ensemble
    anomaly = -float(b["iforest"].score_samples(b["pca"].transform(E))[0])
    pct = float(np.searchsorted(b["ref"], anomaly) / len(b["ref"]))
    out = {"fakeProbability": round(p, 4), "forensicModel": round(p_rf, 4), "embeddingModel": round((p_lr + p_mlp) / 2, 4), "anomalyPercentile": round(pct, 3), "faceFound": bool(found)}
    if detail:
        out["reasons"] = _explain(F, b)
        out["heatmap"] = "data:image/png;base64," + base64.b64encode(ela_heatmap_png(face)).decode()
        idx = _phash_index()
        if idx is not None:
            h = np.uint64(int(str(imagehash.phash(img)), 16))
            dist = np.array([bin(int(x)).count("1") for x in (idx[0] ^ h)])
            j = int(dist.argmin())
            if dist[j] <= 6:
                out["knownMatch"] = {"label": "fake" if idx[1][j] else "real", "distance": int(dist[j]),
                                     "text": f"Matches a known {'synthetic' if idx[1][j] else 'authentic'} reference image in the database"}
    return out


def verdict(p: float) -> str:
    return "likely_fake" if p >= 0.7 else "likely_real" if p <= 0.3 else "uncertain"


def _analyse_image(img: Image.Image) -> dict:
    r = _score(img, detail=True)
    r["verdict"] = verdict(r["fakeProbability"])
    if r.get("knownMatch") and r["knownMatch"]["label"] == "fake" and r["verdict"] == "likely_real":
        r["verdict"] = "uncertain"
    if not r["faceFound"]:
        r.setdefault("reasons", []).append("No clear face was found, so the whole image was analysed (less reliable)")
    return r


def _analyse_video(path: str, frames: int) -> dict:
    cap = cv2.VideoCapture(path)
    try:
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        if total <= 0:
            raise ValueError("The video could not be read.")
        if total / fps > 180:
            raise ValueError("Videos longer than 3 minutes are not supported.")
        picks = np.linspace(0, total - 1, num=min(frames, total), dtype=int)
        results, best = [], None
        for n, f in enumerate(picks):
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(f))
            ok, bgr = cap.read()
            if not ok:
                continue
            img = Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
            r = _score(img, detail=False)
            r["time"] = round(f / fps, 1)
            results.append(r)
            if best is None or r["fakeProbability"] > best[0]:
                best = (r["fakeProbability"], img)
    finally:
        cap.release()
    if not results:
        raise ValueError("No frames could be decoded from this video.")
    probs = np.array([r["fakeProbability"] for r in results])
    mean, mx, fraction = float(probs.mean()), float(probs.max()), float((probs >= 0.5).mean())
    flicker = float(np.abs(np.diff(probs)).mean()) if len(probs) > 1 else 0.0       # sudden swings between frames = manipulated segments
    score = 0.7 * mean + 0.3 * mx if fraction >= 0.25 else mean
    reasons = []
    if fraction >= 0.5:
        reasons.append(f"{round(fraction * 100)}% of the sampled frames look synthetic")
    if flicker > 0.25:
        reasons.append("The authenticity score swings sharply between frames, which can indicate spliced or face-swapped segments")
    if sum(r["faceFound"] for r in results) < len(results) / 2:
        reasons.append("A face was visible in fewer than half of the frames, so confidence is lower")
    top = _analyse_image(best[1])
    return {"fakeProbability": round(score, 4), "verdict": verdict(score), "framesAnalysed": len(results), "meanProbability": round(mean, 4), "maxProbability": round(mx, 4),
            "fractionFakeFrames": round(fraction, 3), "temporalFlicker": round(flicker, 3), "timeline": [{"time": r["time"], "p": r["fakeProbability"]} for r in results],
            "reasons": (reasons + top.get("reasons", []))[:4], "heatmap": top.get("heatmap"), "faceFound": any(r["faceFound"] for r in results),
            "anomalyPercentile": round(float(np.mean([r["anomalyPercentile"] for r in results])), 3)}


async def analyse_image(img: Image.Image) -> dict:
    async with _slots:
        return await asyncio.to_thread(_analyse_image, img)


async def analyse_video(path: str, frames: int = 12) -> dict:
    async with _slots:
        return await asyncio.to_thread(_analyse_video, path, frames)


async def analyse_frame(img: Image.Image) -> dict:
    """Light-weight path for live monitoring (no heat-map, no database lookup)."""
    async with _slots:
        r = await asyncio.to_thread(_score, img, detail=False)
    r["verdict"] = verdict(r["fakeProbability"])
    return r
