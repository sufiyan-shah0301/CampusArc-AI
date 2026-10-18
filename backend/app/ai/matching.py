"""Deterministic skill matching (no LLM): fast, free and explainable. Used for the apply-time match score
and for job recommendations."""
import re

ALIASES = {
    "js": "javascript", "ecmascript": "javascript", "ts": "typescript", "reactjs": "react", "react.js": "react",
    "nodejs": "node", "node.js": "node", "expressjs": "express", "vuejs": "vue", "nextjs": "next",
    "py": "python", "golang": "go", "postgres": "postgresql", "mongo": "mongodb", "ml": "machinelearning",
    "machine learning": "machinelearning", "ai": "artificialintelligence", "k8s": "kubernetes",
    "c++": "cpp", "c#": "csharp", "html5": "html", "css3": "css", "tailwindcss": "tailwind",
}


def norm(skill: str) -> str:
    s = str(skill).strip().lower()
    s = ALIASES.get(s, s)
    s = re.sub(r"[^a-z0-9+#]", "", s)
    return ALIASES.get(s, s)


def _same(a: str, b: str) -> bool:
    if a == b:
        return True
    short, long_ = sorted((a, b), key=len)
    return len(short) >= 4 and short in long_


def match_score(candidate_skills: list[str], required_skills: list[str]) -> dict:
    cand = [(s, norm(s)) for s in candidate_skills if str(s).strip()]
    req = [(s, norm(s)) for s in required_skills if str(s).strip()]
    if not req:
        return {"score": 0, "matched": [], "missing": []}
    matched, missing = [], []
    for original, n in req:
        (matched if any(_same(n, c) for _, c in cand) else missing).append(original)
    return {"score": round(100 * len(matched) / len(req)), "matched": matched, "missing": missing}
