"""Mine a skill vocabulary from the 2,483 Kaggle resumes: take the text of each "Skills" section, split it into
phrases and keep the ones that recur across many resumes. The vocabulary is data-driven, so it covers every one of the
24 professions in the dataset, not just IT.

    python -m ml.build_skills
"""
import json
import re
from collections import Counter
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).parent
DATA = ROOT / "data" / "resume_raw" / "Resume" / "Resume.csv"
OUT = ROOT / "models"

SECTION = re.compile(r"\bskills?\b(?:\s+(?:and|&)\s+\w+)?\s{2,}(.{30,1500}?)(?:\s{2,}(?:experience|education|work history|professional|summary|accomplishments|certifications|additional)\b|$)", re.I | re.S)
SPLIT = re.compile(r"[,;•·▪|\n]| {3,}|\s-\s|\s/\s")
STOP = {"and", "the", "of", "to", "in", "for", "with", "a", "an", "or", "on", "as", "at", "by", "skills", "experience", "company", "name", "city", "state", "years", "year", "well", "using", "including"}
GENERIC = {"clients", "client", "quality", "office", "policies", "word", "meetings", "documentation", "access", "processes", "research", "reporting",
           "personnel", "managing", "materials", "scheduling", "progress", "delivery", "market", "network", "budget", "budgets", "financial",
           "contracts", "inventory", "safety", "credit", "insurance", "sales", "company", "operations", "management", "training", "service",
           "services", "customer", "customers", "team", "support", "business", "staff", "records", "data", "systems", "system", "software",
           "development", "analysis", "planning", "program", "programs", "projects", "project", "process", "events", "event", "reports", "report"}
CURATED = [
    "python", "java", "javascript", "typescript", "c++", "c#", "sql", "mysql", "postgresql", "mongodb", "react", "angular", "vue", "node.js",
    "express", "django", "flask", "fastapi", "spring", "html", "css", "tailwind", "bootstrap", "git", "github", "docker", "kubernetes", "aws",
    "azure", "gcp", "linux", "rest api", "graphql", "redis", "kafka", "tensorflow", "pytorch", "scikit-learn", "pandas", "numpy",
    "machine learning", "deep learning", "nlp", "computer vision", "data analysis", "data science", "excel", "power bi", "tableau", "figma",
    "agile", "scrum", "jira", "ci/cd", "jenkins", "devops", "selenium", "testing", "junit", "cybersecurity", "networking", "android",
    "kotlin", "swift", "flutter", "react native", "php", "laravel", "ruby", "go", "rust", "communication", "leadership", "teamwork",
]


def norm(p: str) -> str:
    p = re.sub(r"[^a-z0-9+#./ &-]", " ", p.lower())
    return re.sub(r"\s+", " ", p).strip(" .-/&")


def main() -> None:
    OUT.mkdir(exist_ok=True)
    df = pd.read_csv(DATA).dropna(subset=["Resume_str"])
    doc_freq = Counter()
    n_sections = 0
    for text in df["Resume_str"]:
        m = SECTION.search(text)
        if not m:
            continue
        n_sections += 1
        phrases = {norm(p) for p in SPLIT.split(m.group(1))}
        doc_freq.update(p for p in phrases if 2 <= len(p) <= 32 and len(p.split()) <= 3 and p not in STOP and p not in GENERIC and not p.isdigit())
    vocab = {p: c for p, c in doc_freq.items() if c >= 6}
    for skill in CURATED:
        vocab[skill] = max(vocab.get(skill, 0), 6)
    ordered = sorted(vocab.items(), key=lambda kv: -kv[1])
    (OUT / "skills_vocab.json").write_text(json.dumps({"skills": [s for s, _ in ordered], "counts": dict(ordered)}))
    print(f"resumes with a skills section: {n_sections}/{len(df)}  vocabulary size: {len(ordered)}")
    print("top 40:", [s for s, _ in ordered[:40]])


if __name__ == "__main__":
    main()
