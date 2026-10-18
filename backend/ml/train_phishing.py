"""Phishing / malicious URL classifier (Kaggle: taruntiwarihp/phishing-site-urls, ~549k labelled URLs).

Ensemble of a Random Forest on hand-made lexical features and a logistic regression on character n-grams. The scheme and
"www." are stripped before featurising so the model cannot cheat on dataset artefacts.

    python -m ml.train_phishing
"""
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from scipy.sparse import hstack
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split

from .urlfeatures import FEATURES, features, normalise

ROOT = Path(__file__).parent
DATA = ROOT / "data" / "phishing_raw" / "phishing_site_urls.csv"
OUT = ROOT / "models"
SEED = 42
N = 120_000


def main() -> None:
    OUT.mkdir(exist_ok=True)
    df = pd.read_csv(DATA).drop_duplicates("URL")
    df["y"] = (df["Label"] == "bad").astype(int)
    print(f"unique URLs: {len(df)}  bad: {df['y'].mean():.1%}")
    df = pd.concat([df[df["y"] == c].sample(min(int((df["y"] == c).sum()), N // 2), random_state=SEED) for c in (0, 1)])
    X_tr, X_te, y_tr, y_te = train_test_split(df["URL"], df["y"], test_size=0.2, stratify=df["y"], random_state=SEED)

    F_tr = np.asarray([features(u) for u in X_tr])
    F_te = np.asarray([features(u) for u in X_te])
    rf = RandomForestClassifier(n_estimators=120, min_samples_leaf=5, n_jobs=-1, class_weight="balanced_subsample", random_state=SEED).fit(F_tr, y_tr)

    tf = TfidfVectorizer(analyzer="char", ngram_range=(3, 4), min_df=8, max_features=40_000, sublinear_tf=True, lowercase=True)
    T_tr, T_te = tf.fit_transform(X_tr.map(normalise)), tf.transform(X_te.map(normalise))
    lr = LogisticRegression(C=4, max_iter=2000, n_jobs=-1).fit(T_tr, y_tr)

    p_rf, p_lr = rf.predict_proba(F_te)[:, 1], lr.predict_proba(T_te)[:, 1]
    p = 0.5 * p_rf + 0.5 * p_lr

    def ev(prob):
        pred = prob >= 0.5
        return {"roc_auc": round(float(roc_auc_score(y_te, prob)), 4), "pr_auc": round(float(average_precision_score(y_te, prob)), 4),
                "precision": round(float(precision_score(y_te, pred)), 4), "recall": round(float(recall_score(y_te, pred)), 4), "f1": round(float(f1_score(y_te, pred)), 4)}

    res = {"RandomForest (lexical features)": ev(p_rf), "LogisticRegression (char n-grams)": ev(p_lr), "Ensemble (50/50)": ev(p)}
    for k, v in res.items():
        print(f"{k:36s}", v)
    imp = sorted(zip(FEATURES, rf.feature_importances_), key=lambda t: -t[1])[:8]
    joblib.dump({"rf": rf, "tfidf": tf, "lr": lr}, OUT / "phishing.joblib", compress=3)
    (OUT / "metrics_phishing.json").write_text(json.dumps({
        "dataset": "Kaggle: taruntiwarihp/phishing-site-urls", "n_train_pool": int(len(df)), "deployed_model": "Ensemble (50/50)", "comparison_on_holdout": res,
        "rf_top_features": [{"feature": f, "importance": round(float(v), 4)} for f, v in imp],
        "note": "Lexical model: it judges the address only. Always combine with the sandbox preview; brand-new phishing domains can look clean.",
    }, indent=2))
    print("saved phishing.joblib", f"{(OUT / 'phishing.joblib').stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
