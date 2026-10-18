"""Skill extraction with a data-driven vocabulary (mined from 2,400 real resumes by ml/build_skills.py)
plus a curated tech list. Pure Python: no model download, runs in microseconds."""
import json
import re
from functools import lru_cache
from pathlib import Path

VOCAB_FILE = Path(__file__).parent / "models" / "skills_vocab.json"
TOKEN = re.compile(r"[a-z0-9+#./-]+")
# words that are common in prose and would create false positives
AMBIGUOUS = {"go", "word", "access", "email", "phone", "director", "benefits", "closing", "windows", "hardware", "strategic", "organizational",
             "filing", "hiring", "staffing", "coaching", "strategy", "retail", "finance", "billing", "administrative", "presentations", "excel"}
KEEP_EVEN_IF_AMBIGUOUS = {"excel"}   # a skills-list token, and rarely a verb in resumes


@lru_cache(maxsize=1)
def _vocab() -> tuple[frozenset, int]:
    if not VOCAB_FILE.exists():
        return frozenset(), 1
    skills = json.loads(VOCAB_FILE.read_text())["skills"]
    vocab = frozenset(s for s in skills if s not in AMBIGUOUS or s in KEEP_EVEN_IF_AMBIGUOUS)
    return vocab, max((len(s.split()) for s in vocab), default=1)


def extract(text: str, limit: int = 40) -> list[str]:
    vocab, longest = _vocab()
    tokens = [t.strip(".-/") for t in TOKEN.findall(str(text).lower())]
    tokens = [t for t in tokens if t]
    found: dict[str, int] = {}
    i = 0
    while i < len(tokens):
        for n in range(min(longest, 3), 0, -1):          # prefer the longest phrase ("machine learning" over "machine")
            phrase = " ".join(tokens[i:i + n])
            if phrase in vocab:
                found[phrase] = found.get(phrase, 0) + 1
                i += n
                break
        else:
            i += 1
    return [s for s, _ in sorted(found.items(), key=lambda kv: -kv[1])][:limit]
