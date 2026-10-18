"""Placement probability predictor (Kaggle: tejashvi14/engineering-placements-prediction).

Uses only attributes students enter on our platform (stream, CGPA, internships, backlog history). Gender, age and
hostel are deliberately NOT used: they are not meaningful levers and would make a placement score discriminatory.

    python -m ml.train_placement
"""
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier, HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

ROOT = Path(__file__).parent
DATA = ROOT / "data" / "placement_raw" / "collegePlace.csv"
OUT = ROOT / "models"
SEED = 42
FEATURES = ["Stream", "Internships", "CGPA", "HistoryOfBacklogs"]


def pipe(clf):
    pre = ColumnTransformer([("stream", OneHotEncoder(handle_unknown="ignore", sparse_output=False), ["Stream"])], remainder="passthrough")
    return Pipeline([("pre", pre), ("clf", clf)])


def main() -> None:
    OUT.mkdir(exist_ok=True)
    df = pd.read_csv(DATA).drop_duplicates()
    X, y = df[FEATURES], df["PlacedOrNot"]
    print(f"rows after de-duplication: {len(df)}  placed: {y.mean():.1%}  streams: {sorted(df['Stream'].unique())}")
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.25, stratify=y, random_state=SEED)

    models = {
        "LogisticRegression": LogisticRegression(max_iter=2000),
        "RandomForest": RandomForestClassifier(n_estimators=300, min_samples_leaf=3, random_state=SEED, n_jobs=-1),
        "GradientBoosting": GradientBoostingClassifier(random_state=SEED),
        # more CGPA / internships can never LOWER the probability, backlogs can never raise it; shallow + regularised so it stays smooth
        "MonotonicGradientBoosting": HistGradientBoostingClassifier(
            max_depth=3, learning_rate=0.05, max_iter=300, l2_regularization=1.0, min_samples_leaf=20, random_state=SEED,
            monotonic_cst=[0] * df["Stream"].nunique() + [1, 1, -1]),   # one-hot streams, then Internships, CGPA, HistoryOfBacklogs
    }
    results, fitted = {}, {}
    for name, clf in models.items():
        p = pipe(clf).fit(Xtr, ytr)
        prob, pred = p.predict_proba(Xte)[:, 1], p.predict(Xte)
        cv = cross_val_score(pipe(clf), X, y, cv=StratifiedKFold(5, shuffle=True, random_state=SEED), scoring="roc_auc", n_jobs=-1)
        results[name] = {"accuracy": round(accuracy_score(yte, pred), 4), "f1": round(f1_score(yte, pred), 4),
                         "roc_auc": round(roc_auc_score(yte, prob), 4), "cv5_roc_auc": round(float(cv.mean()), 4)}
        fitted[name] = p
        print(f"{name:20s}", results[name])

    best = max(results, key=lambda k: results[k]["cv5_roc_auc"])         # best by cross-validated AUC
    # prefer the monotonic model when it is about as accurate: it never contradicts common sense (a higher CGPA lowering your chance)
    mono = "MonotonicGradientBoosting"
    deployed = mono if results[mono]["cv5_roc_auc"] >= results[best]["cv5_roc_auc"] - 0.015 else best
    final = pipe(models[deployed]).fit(X, y)
    joblib.dump({"model": final, "streams": sorted(df["Stream"].unique()), "features": FEATURES}, OUT / "placement.joblib", compress=3)
    rf = fitted[deployed]
    names = list(rf.named_steps["pre"].get_feature_names_out())
    clf = rf.named_steps["clf"]
    if hasattr(clf, "feature_importances_"):
        weights = clf.feature_importances_
    elif hasattr(clf, "coef_"):
        weights = np.abs(clf.coef_[0])
    else:   # HistGradientBoosting has neither: permutation importance on the held-out split (per original column, spread over its columns)
        from sklearn.inspection import permutation_importance
        pi = permutation_importance(rf, Xte, yte, n_repeats=10, random_state=SEED, scoring="roc_auc")
        by_col = dict(zip(FEATURES, pi.importances_mean))
        weights = np.array([by_col["Stream"] / max(1, sum(n.startswith("stream__") for n in names)) if n.startswith("stream__")
                            else by_col[n.split("__")[-1]] for n in names])
    imp = sorted(zip(names, weights), key=lambda t: -t[1])[:8]
    (OUT / "metrics_placement.json").write_text(json.dumps({
        "dataset": "Kaggle: tejashvi14/engineering-placements-prediction", "n_samples": int(len(df)), "placed_rate": round(float(y.mean()), 4),
        "deployed_model": deployed, "comparison_on_holdout": results,
        "feature_importance": [{"feature": n.split("__")[-1], "importance": round(float(v), 4)} for n, v in imp],
        "monotonic_constraints": deployed == mono,
        "note": "Gender, age and hostel were excluded on purpose (fairness). The dataset is small and has sharp CGPA thresholds, so the app "
                "shrinks displayed probabilities into 5-95% instead of showing a flat 0% or 100%.",
    }, indent=2))
    print("saved placement.joblib")


if __name__ == "__main__":
    main()
