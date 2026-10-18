"""Fake job posting detection on the Kaggle "Real / Fake Job Posting Prediction" dataset (shivamb/...).

Two models, both used by the platform:
  * Random Forest (supervised)  - probability that a posting is fraudulent, calibrated on a validation split.
  * Isolation Forest (unsupervised) - anomaly score trained ONLY on legitimate postings; catches odd postings
    that look unlike anything normal, even when they resemble no known scam.

Only features that exist on our platform are used (title, description, skills/requirements, salary, location),
so the models behave the same at serving time as in training.

    python -m ml.train_fakejob
"""
import json
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from scipy.sparse import csr_matrix, hstack
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, f1_score, precision_recall_curve, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from .text import META_FEATURES, job_meta, job_text

ROOT = Path(__file__).parent
DATA = ROOT / "data" / "fakejobs_raw" / "fake_job_postings.csv"
OUT = ROOT / "models"
SEED = 42


def build(df: pd.DataFrame):
    f = df.fillna("")
    texts = [job_text(t, d, r) for t, d, r in zip(f["title"], f["description"], f["requirements"])]
    meta = np.asarray([job_meta(t, d, r, s, l) for t, d, r, s, l in zip(f["title"], f["description"], f["requirements"], f["salary_range"], f["location"])])
    return texts, meta


def pick_thresholds(y, p):
    prec, rec, thr = precision_recall_curve(y, p)
    f1 = 2 * prec[:-1] * rec[:-1] / np.clip(prec[:-1] + rec[:-1], 1e-9, None)
    t_f1 = float(thr[int(np.argmax(f1))])
    ok = np.where(prec[:-1] >= 0.8)[0]
    t_high = float(thr[ok[0]]) if len(ok) else min(1.0, t_f1 * 1.5)
    return {"medium": round(max(0.05, min(t_f1, t_high)), 4), "high": round(max(t_high, t_f1), 4)}


def main() -> None:
    OUT.mkdir(exist_ok=True)
    df = pd.read_csv(DATA)
    texts, meta = build(df)
    y = df["fraudulent"].to_numpy()
    idx = np.arange(len(df))
    i_train, i_test = train_test_split(idx, test_size=0.2, stratify=y, random_state=SEED)
    i_fit, i_val = train_test_split(i_train, test_size=0.25, stratify=y[i_train], random_state=SEED)
    print(f"postings: {len(df)}  fraudulent: {int(y.sum())} ({y.mean():.1%})  fit/val/test: {len(i_fit)}/{len(i_val)}/{len(i_test)}")

    take = lambda ids: [texts[i] for i in ids]
    tfidf = TfidfVectorizer(sublinear_tf=True, ngram_range=(1, 2), min_df=5, max_df=0.8, max_features=8000, stop_words="english").fit(take(i_fit))
    scaler = StandardScaler().fit(meta[i_fit])
    X = lambda ids: hstack([tfidf.transform(take(ids)), csr_matrix(scaler.transform(meta[ids]))]).tocsr()
    Xf, Xv, Xt = X(i_fit), X(i_val), X(i_test)

    # ---------------- supervised: Random Forest (+ logistic baseline)
    t = time.time()
    rf = RandomForestClassifier(n_estimators=250, max_depth=40, min_samples_leaf=2, class_weight="balanced_subsample", n_jobs=-1, random_state=SEED).fit(Xf, y[i_fit])
    print(f"RF trained in {time.time() - t:.0f}s")
    lr = LogisticRegression(C=4, class_weight="balanced", max_iter=2000).fit(Xf, y[i_fit])

    iso_cal = IsotonicRegression(out_of_bounds="clip", y_min=0, y_max=1).fit(rf.predict_proba(Xv)[:, 1], y[i_val])
    thresholds = pick_thresholds(y[i_val], iso_cal.predict(rf.predict_proba(Xv)[:, 1]))

    def evaluate(prob, ids, thr):
        yt, pred = y[ids], prob >= thr
        return {"roc_auc": round(float(roc_auc_score(yt, prob)), 4), "pr_auc": round(float(average_precision_score(yt, prob)), 4),
                "precision": round(float(precision_score(yt, pred, zero_division=0)), 4), "recall": round(float(recall_score(yt, pred)), 4),
                "f1": round(float(f1_score(yt, pred)), 4), "threshold": round(float(thr), 4)}

    p_rf = iso_cal.predict(rf.predict_proba(Xt)[:, 1])
    rf_metrics = evaluate(p_rf, i_test, thresholds["medium"])
    lr_metrics = evaluate(lr.predict_proba(Xt)[:, 1], i_test, 0.5)
    print("Random Forest  (test):", rf_metrics)
    print("Logistic basel.(test):", lr_metrics)

    # ---------------- unsupervised: Isolation Forest on legitimate postings only
    legit = i_fit[y[i_fit] == 0]
    iso_scaler = StandardScaler().fit(meta[legit])
    iforest = IsolationForest(n_estimators=300, contamination=0.05, random_state=SEED, n_jobs=-1).fit(iso_scaler.transform(meta[legit]))
    train_scores = np.sort(-iforest.score_samples(iso_scaler.transform(meta[legit])))   # higher = more anomalous
    anomaly = -iforest.score_samples(iso_scaler.transform(meta[i_test]))
    pct = np.searchsorted(train_scores, anomaly) / len(train_scores)                  # percentile vs normal postings
    flag = pct >= 0.95
    if_metrics = {"roc_auc_vs_fraud_label": round(float(roc_auc_score(y[i_test], anomaly)), 4),
                  "flagged_share_of_all": round(float(flag.mean()), 4),
                  "fraud_rate_in_flagged": round(float(y[i_test][flag].mean()), 4) if flag.any() else 0.0,
                  "fraud_rate_in_unflagged": round(float(y[i_test][~flag].mean()), 4),
                  "recall_of_fraud_when_flagged": round(float(flag[y[i_test] == 1].mean()), 4)}
    print("Isolation Forest (test, label never used in training):", if_metrics)

    # ---------------- feature importance for the admin page
    names = [f"tfidf:{w}" for w in tfidf.get_feature_names_out()] + [f"meta:{m}" for m in META_FEATURES]
    top = np.argsort(rf.feature_importances_)[::-1][:15]
    importances = [{"feature": names[i], "importance": round(float(rf.feature_importances_[i]), 4)} for i in top]

    joblib.dump({"tfidf": tfidf, "scaler": scaler, "rf": rf, "calibrator": iso_cal, "thresholds": thresholds}, OUT / "fakejob_rf.joblib", compress=3)
    joblib.dump({"scaler": iso_scaler, "iforest": iforest, "train_scores": train_scores[:: max(1, len(train_scores) // 2000)], "flag_pct": 0.95}, OUT / "fakejob_if.joblib", compress=3)
    (OUT / "metrics_fakejob.json").write_text(json.dumps({
        "dataset": "Kaggle: shivamb/real-or-fake-fake-jobposting-prediction", "n_samples": int(len(df)), "n_fraudulent": int(y.sum()),
        "split": {"fit": len(i_fit), "validation": len(i_val), "test": len(i_test)},
        "random_forest": rf_metrics, "logistic_regression_baseline": lr_metrics, "thresholds": thresholds,
        "isolation_forest": if_metrics, "rf_top_features": importances,
    }, indent=2))
    for f in ("fakejob_rf.joblib", "fakejob_if.joblib"):
        print("saved", f, f"{(OUT / f).stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
