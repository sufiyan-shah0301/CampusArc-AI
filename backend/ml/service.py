"""Inference layer for the trained models. Everything loads lazily (the API starts instantly) and every public
coroutine runs the CPU-bound work in a worker thread so the event loop is never blocked."""
import asyncio
import hashlib
import json
import os
import re
import threading
from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from scipy.sparse import csr_matrix, hstack

from .text import clean, job_meta, job_text, reasons_from_meta

os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
MODELS = Path(__file__).parent / "models"
EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
_lock = threading.Lock()


class ModelsNotTrained(RuntimeError):
    pass


def _load(name: str):
    path = MODELS / name
    if not path.exists():
        raise ModelsNotTrained(f"{name} not found. Run:  python -m ml.train_all")
    return joblib.load(path)  # our own trained artefacts only


@lru_cache(maxsize=None)
def _resume_model():
    with _lock:
        return _load("resume_classifier.joblib")


@lru_cache(maxsize=None)
def _fake_models():
    with _lock:
        return _load("fakejob_rf.joblib"), _load("fakejob_if.joblib")


@lru_cache(maxsize=None)
def _embedder():
    with _lock:
        from sentence_transformers import SentenceTransformer
        return SentenceTransformer(EMBED_MODEL)


def available() -> dict:
    return {"resume_classifier": (MODELS / "resume_classifier.joblib").exists(),
            "fake_job_models": (MODELS / "fakejob_rf.joblib").exists() and (MODELS / "fakejob_if.joblib").exists(),
            "placement": (MODELS / "placement.joblib").exists(), "salary": (MODELS / "salary.joblib").exists(),
            "families": (MODELS / "families.joblib").exists(), "skills_vocab": (MODELS / "skills_vocab.json").exists(),
            "phishing": (MODELS / "phishing.joblib").exists(), "deepfake": (MODELS / "deepfake.joblib").exists()}


def metrics() -> dict:
    out = {}
    for key, fname in (("resume", "metrics_resume.json"), ("fakejob", "metrics_fakejob.json"), ("placement", "metrics_placement.json"),
                       ("salary", "metrics_salary.json"), ("families", "metrics_families.json"),
                       ("phishing", "metrics_phishing.json"), ("deepfake", "metrics_deepfake.json")):
        p = MODELS / fname
        out[key] = json.loads(p.read_text()) if p.exists() else None
    out["embedding_model"] = EMBED_MODEL
    out["available"] = available()
    return out


# ---------------------------------------------------------------- resume category (Random Forest + LogReg ensemble)
_SECTIONS = {"summary", "professional summary", "career summary", "objective", "career objective", "profile", "about me", "skills",
             "technical skills", "education", "experience", "work experience", "projects"}
_CONTACT = re.compile(r"@|linkedin|github|https?://|www\.|\+?\d[\d\s().-]{7,}\d|\|")


def strip_contact_header(text: str) -> str:
    """The classifier was trained on resumes whose first line is the job title, but real resumes open with the candidate's
    name and contact details. Drop that header so the title/summary lines are what the model sees as the 'head'."""
    lines = [ln for ln in text.splitlines() if ln.strip()]
    last = -1
    for i, ln in enumerate(lines[:4]):
        if _CONTACT.search(ln):
            last = i
    if last < 0:
        return text
    rest = lines[last + 1:]
    while len(rest) > 1 and rest[0].strip().rstrip(":").lower() in _SECTIONS:   # "SUMMARY", "OBJECTIVE", ...
        rest = rest[1:]
    return "\n".join(rest) if rest else text


def _classify_resume(text: str, topk: int) -> list[dict]:
    from .train_resume import frame  # same preprocessing as training

    pipe = _resume_model()
    proba = pipe.predict_proba(frame([strip_contact_header(text)]))[0]
    classes = pipe.classes_
    order = np.argsort(proba)[::-1][:topk]
    return [{"category": str(classes[i]).replace("-", " ").title(), "confidence": round(float(proba[i]), 4)} for i in order]


async def classify_resume(text: str, topk: int = 3) -> list[dict]:
    return await asyncio.to_thread(_classify_resume, text, topk)


# ---------------------------------------------------------------- fake job risk (Random Forest + Isolation Forest)
def _job_risk(title: str, description: str, skills: list[str], salary: str, location: str) -> dict:
    rf_bundle, if_bundle = _fake_models()
    req = ", ".join(skills or [])
    meta = job_meta(title, description, req, salary, location)
    text = job_text(title, description, req)

    X = hstack([rf_bundle["tfidf"].transform([text]), csr_matrix(rf_bundle["scaler"].transform([meta]))]).tocsr()
    prob = float(rf_bundle["calibrator"].predict(rf_bundle["rf"].predict_proba(X)[:, 1])[0])

    anomaly = -float(if_bundle["iforest"].score_samples(if_bundle["scaler"].transform([meta]))[0])
    pct = float(np.searchsorted(if_bundle["train_scores"], anomaly) / len(if_bundle["train_scores"]))
    anomalous = pct >= if_bundle["flag_pct"]

    thr = rf_bundle["thresholds"]
    medium_t, high_t = max(0.1, thr["medium"] * 0.5), thr["high"]
    level = "high" if prob >= high_t else "medium" if (prob >= medium_t or anomalous) else "low"
    reasons = reasons_from_meta(meta)
    # model-side explanation: the words in this posting that the Random Forest weighs most heavily
    row = rf_bundle["tfidf"].transform([text])
    if row.nnz:
        names = rf_bundle["tfidf"].get_feature_names_out()
        weights = rf_bundle["rf"].feature_importances_
        top = sorted(zip(row.indices, row.data), key=lambda t: -weights[t[0]] * t[1])[:3]
        words = [names[i] for i, _ in top if weights[i] > 0]
        if words and level != "low":
            reasons.append("Wording the model associates with scam postings: " + ", ".join(words))
    if anomalous:
        reasons.append("Unusual posting style compared with normal listings (anomaly detector)")
    return {"riskScore": round(prob * 100), "riskLevel": level, "anomalyPercentile": round(pct, 3), "anomalous": anomalous,
            "riskReasons": reasons[:5]}


async def job_risk(title: str, description: str, skills: list[str], salary: str = "", location: str = "") -> dict:
    try:
        return await asyncio.to_thread(_job_risk, title, description, skills, salary, location)
    except ModelsNotTrained:
        return {"riskScore": None, "riskLevel": "unknown", "anomalyPercentile": None, "anomalous": False, "riskReasons": []}


# ---------------------------------------------------------------- semantic similarity (sentence embeddings)
_cache: dict[str, np.ndarray] = {}


def _embed(texts: list[str]) -> np.ndarray:
    keys = [hashlib.sha1(t.encode()).hexdigest() for t in texts]
    missing = [(k, t) for k, t in zip(keys, texts) if k not in _cache]
    if missing:
        vecs = _embedder().encode([t for _, t in missing], normalize_embeddings=True, batch_size=32, show_progress_bar=False)
        for (k, _), v in zip(missing, vecs):
            _cache[k] = v
        if len(_cache) > 5000:  # crude bound
            for k in list(_cache)[:1000]:
                _cache.pop(k, None)
    return np.vstack([_cache[k] for k in keys])


def _semantic(query: str, docs: list[str]) -> list[float]:
    if not docs:
        return []
    vecs = _embed([query[:2000]] + [d[:2000] for d in docs])
    return [float(x) for x in vecs[1:] @ vecs[0]]


def normalise_similarity(cos: float) -> float:
    """MiniLM cosine for related career texts sits roughly in 0.10-0.70; stretch that to 0-1 for display."""
    return float(min(1.0, max(0.0, (cos - 0.10) / 0.60)))


async def embed_text(text: str) -> list[float]:
    vec = await asyncio.to_thread(lambda: _embed([text[:2000]])[0])
    return [round(float(x), 4) for x in vec]


async def semantic_scores(query: str, docs: list[str]) -> list[float]:
    """Cosine similarity of `query` to each doc, already normalised to 0-1."""
    cos = await asyncio.to_thread(_semantic, query, docs)
    return [normalise_similarity(c) for c in cos]


# ---------------------------------------------------------------- placement probability + what-if
@lru_cache(maxsize=None)
def _placement():
    with _lock:
        return _load("placement.joblib")


STREAMS = {  # free-text stream on a profile -> the six streams the model knows
    "computer science": "Computer Science", "cse": "Computer Science", "information technology": "Information Technology", "it": "Information Technology",
    "electronics": "Electronics And Communication", "ece": "Electronics And Communication", "electrical": "Electrical", "mechanical": "Mechanical", "civil": "Civil",
}


def normalise_stream(stream: str) -> str | None:
    s = str(stream or "").strip().lower()
    for key, value in STREAMS.items():
        if key == s or (len(key) > 3 and key in s):
            return value
    return None


def _placement_prob(stream: str, cgpa: float, internships: int, backlogs: bool) -> float:
    bundle = _placement()

    def raw_at(c: float) -> float:
        X = pd.DataFrame([{"Stream": stream, "Internships": int(internships), "CGPA": float(c), "HistoryOfBacklogs": int(bool(backlogs))}])
        return float(bundle["model"].predict_proba(X)[0, 1])

    # The training data only contains whole-number CGPAs (5-9), so the model is a staircase. Interpolate between the two nearest
    # whole numbers instead of pretending to know what happens inside a step.
    lo, hi = int(np.floor(cgpa)), int(np.ceil(cgpa))
    lo, hi = max(5, min(9, lo)), max(5, min(9, hi))
    raw = raw_at(lo) if lo == hi else raw_at(lo) + (raw_at(hi) - raw_at(lo)) * (min(max(cgpa, 5), 9) - lo)
    # The training set is small with sharp CGPA thresholds, so raw scores saturate near 0 and 1. Shrink into 5-95%: never promise or rule out a job.
    return 0.05 + 0.90 * raw


def _placement_report(stream: str, cgpa: float, internships: int, backlogs: bool) -> dict:
    base = _placement_prob(stream, cgpa, internships, backlogs)
    ideas = []
    if internships < 3:
        ideas.append(("Complete one more internship", _placement_prob(stream, cgpa, internships + 1, backlogs)))
    if cgpa < 9.5:
        ideas.append((f"Raise CGPA to {min(10.0, round(cgpa + 0.5, 1))}", _placement_prob(stream, min(10.0, cgpa + 0.5), internships, backlogs)))
    if backlogs:
        ideas.append(("Clear your backlogs", _placement_prob(stream, cgpa, internships, False)))
    what_if = sorted(({"action": a, "newProbability": round(p, 3), "gain": round(100 * (p - base))} for a, p in ideas if p - base >= 0.01),
                     key=lambda d: -d["gain"])
    band = "high" if base >= 0.7 else "medium" if base >= 0.45 else "low"
    return {"probability": round(base, 3), "band": band, "whatIf": what_if}


async def placement_report(stream: str, cgpa: float, internships: int, backlogs: bool) -> dict | None:
    try:
        return await asyncio.to_thread(_placement_report, stream, cgpa, internships, backlogs)
    except ModelsNotTrained:
        return None


# ---------------------------------------------------------------- expected starting salary (range)
@lru_cache(maxsize=None)
def _salary():
    with _lock:
        return _load("salary.joblib")


SPECIALIZATION = {
    "Computer Science": "computer science & engineering", "Information Technology": "information technology",
    "Electronics And Communication": "electronics and communication engineering", "Electrical": "electrical engineering",
    "Mechanical": "mechanical engineering", "Civil": "other",
}


def _salary_range(stream: str, cgpa: float, tenth: float, twelfth: float, tier: int, degree: str, aptitude: dict) -> dict:
    b = _salary()
    spec = SPECIALIZATION.get(stream, "other")
    row = {"10percentage": tenth, "12percentage": twelfth, "collegeGPA": min(100.0, cgpa * 9.5), "CollegeTier": tier,
           "English": aptitude.get("English"), "Logical": aptitude.get("Logical"), "Quant": aptitude.get("Quant"),
           "ComputerProgramming": aptitude.get("ComputerProgramming"), "Degree": degree if degree in b["degrees"] else "B.Tech/B.E.",
           "Specialization": spec if spec in b["top_specializations"] else "other"}
    frame = pd.DataFrame([row]).astype({k: float for k in ("English", "Logical", "Quant", "ComputerProgramming")})
    mid = float(np.exp(b["model"].predict(frame)[0]))
    lo, hi = b["interval_log"]
    rnd = lambda v: int(round(v, -3))
    return {"low": rnd(mid * np.exp(lo)), "expected": rnd(mid), "high": rnd(mid * np.exp(hi)), "currency": "INR", "level": "80% interval"}


async def salary_range(stream: str, cgpa: float, tenth: float, twelfth: float, tier: int = 2, degree: str = "B.Tech/B.E.", aptitude: dict | None = None) -> dict | None:
    try:
        return await asyncio.to_thread(_salary_range, stream, cgpa, tenth, twelfth, tier, degree, aptitude or {})
    except ModelsNotTrained:
        return None


# ---------------------------------------------------------------- job families (K-Means)
@lru_cache(maxsize=None)
def _families():
    with _lock:
        return _load("families.joblib")


def _family(title: str, description: str, skills: list[str]) -> dict:
    b = _families()
    z = b["svd"].transform(b["tfidf"].transform([job_text(title, description, ", ".join(skills or []))]))
    fid = int(b["kmeans"].predict(z)[0])
    return {"familyId": fid, "family": b["families"][fid]["name"]}


async def job_family(title: str, description: str, skills: list[str]) -> dict:
    try:
        return await asyncio.to_thread(_family, title, description, skills)
    except ModelsNotTrained:
        return {}


# ---------------------------------------------------------------- local interview-answer scorer
def _chunks(answer: str) -> list[str]:
    """Sentences plus short sliding windows, so a key point is compared with the part of the answer that addresses it."""
    import re

    sentences = [x.strip() for x in re.split(r"[.!?;\n]+", answer) if len(x.split()) >= 3]
    words = answer.split()
    windows = [" ".join(words[i:i + 8]) for i in range(0, max(1, len(words) - 4), 4)]
    return (sentences + windows)[:24] or [answer]


async def score_answer(answer: str, model_answer: str, expected_points: list[str]) -> dict:
    """Embedding-based relevance of an answer to the ideal answer / key points, mapped to 0-10.
    Runs locally; shown next to the LLM grade as an independent second opinion."""
    if not model_answer and not expected_points:
        return {"localScore": None}
    overall = (await semantic_scores(answer, [model_answer]))[0] if model_answer else None
    chunks = _chunks(answer)
    covered = 0
    points = [str(p) for p in expected_points[:6] if str(p).strip()]
    for point in points:
        best = max(await semantic_scores(point, chunks))
        covered += best >= 0.72      # a key point counts only when a part of the answer clearly states it
    coverage = covered / len(points) if points else (overall or 0.0)
    overall = overall if overall is not None else coverage
    words = len(answer.split())
    # Embeddings measure topical closeness, not completeness: a one-line answer on the right topic would otherwise score ~10.
    depth = min(1.0, words / 60)
    too_long = min(1.0, 250 / max(words, 1))
    score = 10 * (0.4 + 0.6 * depth) * (0.4 * overall + 0.6 * coverage) * too_long
    return {"localScore": round(float(score), 1), "relevance": round(100 * overall), "pointsCovered": int(covered), "pointsTotal": len(points)}


# ---------------------------------------------------------------- phishing URL model (Random Forest + char n-gram LogReg)
@lru_cache(maxsize=None)
def _phishing():
    with _lock:
        return _load("phishing.joblib")


def _url_risk(url: str) -> float:
    from .urlfeatures import features, normalise

    b = _phishing()
    p_rf = float(b["rf"].predict_proba(np.asarray([features(url)]))[0, 1])
    p_lr = float(b["lr"].predict_proba(b["tfidf"].transform([normalise(url)]))[0, 1])
    return 0.5 * (p_rf + p_lr)


async def url_risk(url: str) -> float:
    try:
        return await asyncio.to_thread(_url_risk, url)
    except ModelsNotTrained:
        return 0.0
