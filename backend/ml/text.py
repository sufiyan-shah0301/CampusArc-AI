"""Text cleaning and feature engineering shared by training scripts and the API (same code path = no train/serve skew)."""
import math
import re

import numpy as np

_NON_WORD = re.compile(r"[^a-z0-9+#\s]")
_WS = re.compile(r"\s+")
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_FREE_MAIL = re.compile(r"@(gmail|yahoo|hotmail|outlook|rediffmail)\.", re.I)
_CHAT_APPS = re.compile(r"whatsapp|telegram|signal app|text us|call us now", re.I)
_MONEY = re.compile(r"\$\s?\d|earn\s+(up\s+to\s+)?\$?\d|per\s+(week|day|hour)|weekly\s+pay|₹\s?\d+\s?(k|lakh)", re.I)
_URGENT = re.compile(r"urgent|immediate(ly)?|apply now|limited (seats|slots|vacanc)|no experience (needed|required)|hiring fast|guaranteed", re.I)
_FEE = re.compile(r"registration fee|processing fee|security deposit|pay (a )?fee|training fee|send money|bank (details|account)", re.I)

META_FEATURES = [
    "log_desc_len", "log_req_len", "log_title_len", "upper_ratio", "exclaim_count", "has_email", "has_free_mail",
    "has_chat_app", "money_hits", "urgent_hits", "fee_hits", "has_salary", "has_location", "digit_ratio",
]


def clean(text: str) -> str:
    text = _EMAIL.sub(" emailaddr ", str(text or "").lower())
    return _WS.sub(" ", _NON_WORD.sub(" ", text)).strip()


def job_text(title: str, description: str, requirements: str) -> str:
    return clean(f"{title} {description} {requirements}")


def job_meta(title: str, description: str, requirements: str, salary: str, location: str) -> list[float]:
    """Numeric features that exist on *our* platform (title, description, skills, salary, location)."""
    desc, req, title = str(description or ""), str(requirements or ""), str(title or "")
    letters = sum(c.isalpha() for c in desc) or 1
    allc = len(desc) or 1
    blob = f"{title} {desc} {req}"
    return [
        math.log1p(len(desc)), math.log1p(len(req)), math.log1p(len(title)),
        sum(c.isupper() for c in desc) / letters, desc.count("!"),
        float(bool(_EMAIL.search(blob))), float(bool(_FREE_MAIL.search(blob))), float(bool(_CHAT_APPS.search(blob))),
        len(_MONEY.findall(blob)), len(_URGENT.findall(blob)), len(_FEE.findall(blob)),
        float(bool(str(salary or "").strip() and str(salary).strip().lower() != "nan")),
        float(bool(str(location or "").strip() and str(location).strip().lower() != "nan")),
        sum(c.isdigit() for c in desc) / allc,
    ]


def reasons_from_meta(meta: list[float]) -> list[str]:
    """Human-readable red flags (explanations; the model decides the score)."""
    f = dict(zip(META_FEATURES, meta))
    out = []
    if f["log_desc_len"] < math.log1p(120):
        out.append("Very short job description")
    if f["fee_hits"] > 0:
        out.append("Asks candidates for a fee or bank details")
    if f["has_chat_app"] > 0:
        out.append("Pushes contact through WhatsApp/Telegram or phone")
    if f["has_free_mail"] > 0:
        out.append("Uses a free personal e-mail address")
    if f["money_hits"] >= 2:
        out.append("Emphasises easy money / pay amounts")
    if f["urgent_hits"] >= 2:
        out.append("Pressure wording (urgent, no experience needed, guaranteed)")
    if f["upper_ratio"] > 0.35:
        out.append("Excessive capital letters")
    if f["exclaim_count"] >= 3:
        out.append("Excessive exclamation marks")
    if f["log_req_len"] == 0:
        out.append("No requirements / skills listed")
    return out


def meta_matrix(rows: list[list[float]]) -> np.ndarray:
    return np.asarray(rows, dtype=np.float64)
