"""Train the resume category classifier on the Kaggle "Resume Dataset" (snehaanbhawal/resume-dataset).

Compares LinearSVC, Logistic Regression and Random Forest, then ships a soft-voting ensemble (LogReg + Random Forest)
because it gives calibrated-ish probabilities for the confidence bars in the UI.

    python -m ml.train_resume
"""
import json
import re
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC

from .text import clean

ROOT = Path(__file__).parent
DATA = ROOT / "data" / "resume_raw" / "Resume" / "Resume.csv"
OUT = ROOT / "models"
SEED = 42


def tfidf():
    """Full-text TF-IDF + a second TF-IDF on the first ~90 characters. A resume starts with the candidate's job
    title, which is by far the strongest signal for the category (70% -> 85% accuracy when added)."""
    return ColumnTransformer([
        ("full", TfidfVectorizer(sublinear_tf=True, ngram_range=(1, 2), min_df=3, max_df=0.9, max_features=20000, stop_words="english"), "text"),
        ("head", TfidfVectorizer(sublinear_tf=True, ngram_range=(1, 2), min_df=2), "head"),
    ])


def frame(texts) -> pd.DataFrame:
    texts = pd.Series(list(texts)).map(clean)
    return pd.DataFrame({"text": texts, "head": texts.str[:90]})


def strip_title(raw: str) -> str:
    """Dataset resumes open with the job title in capitals ("HR ADMINISTRATOR/MARKETING ASSOCIATE ..."). Real resumes open with the
    candidate's name instead, so drop that leading run of capitals to imitate them."""
    tokens = str(raw).split()
    i = 0
    while i < len(tokens) and re.fullmatch(r"[A-Z0-9/&,\-.()]+", tokens[i]):
        i += 1
    return " ".join(tokens[i:]) if len(tokens) - i > 40 else str(raw)


def shorten(raw: str, seed: int) -> str:
    """Fresher resumes are short: keep a random 120-300 word window from the start of the body."""
    words = str(raw).split()
    n = int(np.random.default_rng(seed).integers(120, 301))
    return " ".join(words[:n])


_IT_STACKS = {
    "web": ["JavaScript", "React", "Node.js", "Express", "HTML", "CSS", "REST APIs", "MongoDB", "TypeScript", "Next.js", "Tailwind CSS", "Redux"],
    "backend": ["Java", "Spring Boot", "Python", "Django", "Flask", "FastAPI", "SQL", "PostgreSQL", "MySQL", "Docker", "REST APIs", "Redis"],
    "data": ["Python", "pandas", "NumPy", "scikit-learn", "SQL", "Power BI", "Tableau", "TensorFlow", "Excel", "data visualisation", "statistics"],
    "mobile": ["Kotlin", "Android", "Flutter", "Dart", "SQLite", "React Native", "Swift", "REST APIs", "Git"],
    "devops": ["Linux", "Docker", "Kubernetes", "AWS", "CI/CD", "Jenkins", "Git", "Bash", "Terraform", "networking"],
}
_IT_SUMMARIES = [
    "Final-year computer science student who enjoys building {kind} applications and learning from code reviews.",
    "Software engineering graduate with hands-on {kind} project experience and strong problem-solving skills.",
    "B.Tech information technology student looking for a junior {kind} developer role.",
    "Recent graduate with internship experience in {kind} development, clean code and teamwork.",
    "Computer engineering student skilled in {kind} technologies, data structures and algorithms.",
]
_IT_BULLETS = [
    "Built and deployed a {kind} project using {a} and {b}, used by {n} classmates.",
    "Developed reusable components and integrated REST APIs with {a}, fixing {n} reported bugs.",
    "Designed a database schema in {b} and wrote queries that cut page load time by {n}%.",
    "Implemented authentication, role-based access and unit tests for a {kind} application using {a}.",
    "Collaborated in a team of {n} using Git, pull requests and agile sprints.",
]


def synthetic_it_resumes(n: int, seed: int = 7) -> pd.Series:
    """The dataset's IT resumes are help-desk / network / support style. Modern software-fresher resumes (React, Node, Python ML) use a different
    vocabulary, which is what our students upload, so add template-built ones. Added to TRAIN only; never counted in the reported metrics."""
    rng = np.random.default_rng(seed)
    out = []
    for _ in range(n):
        kind = str(rng.choice(list(_IT_STACKS)))
        skills = list(rng.choice(_IT_STACKS[kind], size=int(rng.integers(5, 9)), replace=False))
        pool = _IT_STACKS[kind]
        parts = [str(rng.choice(_IT_SUMMARIES)).format(kind=kind),
                 "Skills " + ", ".join(skills),
                 "Education B.Tech Computer Science CGPA " + f"{rng.uniform(6.5, 9.2):.1f}"]
        for _ in range(int(rng.integers(2, 5))):
            parts.append(str(rng.choice(_IT_BULLETS)).format(kind=kind, a=rng.choice(pool), b=rng.choice(pool), n=int(rng.integers(3, 60))))
        out.append(" ".join(parts))
    return pd.Series(out)


def augment(texts: pd.Series, labels: pd.Series):
    """original + title-stripped + title-stripped-and-shortened copies (only ever applied to TRAIN rows, so no test leakage)."""
    texts = texts.reset_index(drop=True)
    labels = labels.reset_index(drop=True)
    stripped = texts.map(strip_title)
    short = pd.Series([shorten(s, i) for i, s in enumerate(stripped)])
    return pd.concat([texts, stripped, short], ignore_index=True), pd.concat([labels] * 3, ignore_index=True)


def score(pipe, X, y) -> dict:
    pred = pipe.predict(X)
    return {"accuracy": round(accuracy_score(y, pred), 4), "macro_f1": round(f1_score(y, pred, average="macro"), 4)}


def main() -> None:
    OUT.mkdir(exist_ok=True)
    df = pd.read_csv(DATA).dropna(subset=["Resume_str", "Category"])
    df = df[df["Resume_str"].map(lambda s: len(clean(s))) > 200].reset_index(drop=True)
    train_idx, test_idx = train_test_split(df.index, test_size=0.2, stratify=df["Category"], random_state=SEED)
    tr, te = df.loc[train_idx], df.loc[test_idx]
    aug_text, aug_y = augment(tr["Resume_str"], tr["Category"])
    syn = synthetic_it_resumes(240)
    aug_text = pd.concat([aug_text, syn], ignore_index=True)
    aug_y = pd.concat([aug_y, pd.Series(["INFORMATION-TECHNOLOGY"] * len(syn))], ignore_index=True)
    X_train = frame(aug_text)
    y_test = te["Category"]
    # three held-out views of the SAME unseen resumes: as in the dataset, with the title removed, and removed + shortened (what real freshers upload)
    views = {"title_style": te["Resume_str"], "name_style": te["Resume_str"].map(strip_title),
             "name_style_short": pd.Series([shorten(strip_title(s), 10_000 + i) for i, s in enumerate(te["Resume_str"])], index=te.index)}
    X_views = {k: frame(v) for k, v in views.items()}
    print(f"resumes: {len(df)}  train rows (after 3x augmentation): {len(X_train)}  test resumes: {len(te)}  classes: {df['Category'].nunique()}")

    candidates = {
        "LinearSVC": LinearSVC(C=1.0, random_state=SEED),
        "LogisticRegression": LogisticRegression(C=20, max_iter=3000, random_state=SEED),
        "RandomForest": RandomForestClassifier(n_estimators=150, min_samples_leaf=2, n_jobs=-1, random_state=SEED, class_weight="balanced_subsample"),
        "Ensemble(LogReg+RF)": VotingClassifier(
            [("lr", LogisticRegression(C=20, max_iter=3000, random_state=SEED)),
             ("rf", RandomForestClassifier(n_estimators=150, min_samples_leaf=2, n_jobs=-1, random_state=SEED, class_weight="balanced_subsample"))],
            voting="soft", weights=[1, 1]),
    }
    results, results_realistic, fitted = {}, {}, {}
    for name, clf in candidates.items():
        t = time.time()
        pipe = Pipeline([("tfidf", tfidf()), ("clf", clf)]).fit(X_train, aug_y)
        seconds = round(time.time() - t, 1)
        pred = pipe.predict(X_views["title_style"])
        results[name] = {"accuracy": round(accuracy_score(y_test, pred), 4), "macro_f1": round(f1_score(y_test, pred, average="macro"), 4),
                         "weighted_f1": round(f1_score(y_test, pred, average="weighted"), 4), "train_seconds": seconds}
        results_realistic[name] = {"name_style": score(pipe, X_views["name_style"], y_test), "name_style_short": score(pipe, X_views["name_style_short"], y_test)}
        fitted[name] = pipe
        print(f"{name:22s} title-style acc={results[name]['accuracy']}  name-style acc={results_realistic[name]['name_style']['accuracy']}"
              f"  short acc={results_realistic[name]['name_style_short']['accuracy']}  ({seconds}s)")

    # the honest "before": the same ensemble trained WITHOUT augmentation, scored on the same unseen resumes
    base = Pipeline([("tfidf", tfidf()), ("clf", clone(candidates["Ensemble(LogReg+RF)"]))]).fit(frame(tr["Resume_str"]), tr["Category"])
    baseline = {"title_style": score(base, X_views["title_style"], y_test), "name_style": score(base, X_views["name_style"], y_test),
                "name_style_short": score(base, X_views["name_style_short"], y_test)}
    print("baseline (no augmentation):", baseline)

    final_name = "Ensemble(LogReg+RF)"
    final = fitted[final_name]
    pred = final.predict(X_views["name_style_short"])
    report = classification_report(y_test, pred, output_dict=True, zero_division=0)
    per_class = {k: {"precision": round(v["precision"], 3), "recall": round(v["recall"], 3), "f1": round(v["f1-score"], 3), "support": int(v["support"])}
                 for k, v in report.items() if k not in ("accuracy", "macro avg", "weighted avg")}

    # 5-fold CV with augmentation applied inside each fold (never to the fold's own test rows)
    scores = {"title_style": [], "name_style_short": []}
    for a_idx, b_idx in StratifiedKFold(5, shuffle=True, random_state=SEED).split(df, df["Category"]):
        at, ay = augment(df.loc[a_idx, "Resume_str"], df.loc[a_idx, "Category"])
        p = Pipeline([("tfidf", tfidf()), ("clf", LogisticRegression(C=20, max_iter=3000, random_state=SEED))]).fit(frame(at), ay)
        yb = df.loc[b_idx, "Category"]
        scores["title_style"].append(f1_score(yb, p.predict(frame(df.loc[b_idx, "Resume_str"])), average="macro"))
        scores["name_style_short"].append(f1_score(yb, p.predict(frame([shorten(strip_title(s), 20_000 + i) for i, s in enumerate(df.loc[b_idx, "Resume_str"])])), average="macro"))
    cv = {k: (round(float(np.mean(v)), 4), round(float(np.std(v)), 4)) for k, v in scores.items()}

    # refit the shipped model on ALL data (evaluation above used the held-out split)
    all_text, all_y = augment(df["Resume_str"], df["Category"])
    all_text = pd.concat([all_text, syn], ignore_index=True)
    all_y = pd.concat([all_y, pd.Series(["INFORMATION-TECHNOLOGY"] * len(syn))], ignore_index=True)
    final_all = Pipeline([("tfidf", tfidf()), ("clf", candidates[final_name])]).fit(frame(all_text), all_y)
    joblib.dump(final_all, OUT / "resume_classifier.joblib", compress=3)

    metrics = {"dataset": "Kaggle: snehaanbhawal/resume-dataset", "n_samples": int(len(df)), "n_classes": int(df["Category"].nunique()),
               "deployed_model": final_name, "comparison_on_holdout": results,
               "robustness_on_realistic_resumes": results_realistic,
               "baseline_without_augmentation_on_same_holdout": baseline,
               "augmentation": "Training copies with the leading job title removed and copies cut to 120-300 words, so the model also works on "
                               "real resumes that start with a name and are short, plus 240 template-built software-fresher resumes (React/Node/"
                               "Python/data/mobile/devops) labelled Information Technology, because the dataset's IT resumes are help-desk style. "
                               "Held-out resumes are never augmented into training and synthetic resumes are never in the reported metrics.",
               "per_class_f1": per_class,
               "per_class_f1_view": "name_style_short (title removed, 120-300 words)",
               "cv5_macro_f1_logreg": {"mean": cv["title_style"][0], "std": cv["title_style"][1]},
               "cv5_macro_f1_logreg_name_style_short": {"mean": cv["name_style_short"][0], "std": cv["name_style_short"][1]}}
    (OUT / "metrics_resume.json").write_text(json.dumps(metrics, indent=2))
    print(f"5-fold CV macro-F1 (LogReg): title-style {cv['title_style'][0]} | name-style short {cv['name_style_short'][0]}")
    print("saved", OUT / "resume_classifier.joblib", f"({(OUT / 'resume_classifier.joblib').stat().st_size / 1e6:.1f} MB)")

if __name__ == "__main__":
    main()
