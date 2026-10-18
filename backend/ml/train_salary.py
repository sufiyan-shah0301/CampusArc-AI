"""Expected starting-salary model (Kaggle: manishkc06/engineering-graduate-salary-prediction, AMCAT data, INR).

Inputs are things a student can enter on our platform: 10th / 12th %, college GPA (%), degree, specialization, college
tier and (optional) aptitude scores. Missing aptitude scores are imputed with the median.

Salary is intrinsically noisy, so the app shows a *range*: point estimate x the 10th/90th percentile of the
cross-validated residuals (an empirical prediction interval), not a single number.

    python -m ml.train_salary
"""
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, median_absolute_error, r2_score
from sklearn.model_selection import KFold, cross_val_predict, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

ROOT = Path(__file__).parent
DATA = ROOT / "data" / "salary_raw" / "Engineering_graduate_salary.csv"
OUT = ROOT / "models"
SEED = 42
APTITUDE = ["English", "Logical", "Quant", "ComputerProgramming"]
NUM = ["10percentage", "12percentage", "collegeGPA", "CollegeTier"] + APTITUDE
CAT = ["Degree", "Specialization"]
TOP_SPEC = 12


def pipe(reg):
    num = Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler())])
    pre = ColumnTransformer([("num", num, NUM), ("cat", OneHotEncoder(handle_unknown="ignore"), CAT)])
    return Pipeline([("pre", pre), ("reg", reg)])


def main() -> None:
    OUT.mkdir(exist_ok=True)
    df = pd.read_csv(DATA)
    df = df[(df["collegeGPA"] > 30) & (df["Salary"] > 0) & (df["Salary"] < 2_000_000)].copy()   # data-entry errors / extreme outliers
    for c in APTITUDE:
        df[c] = df[c].replace(-1, np.nan)                                                     # -1 = test not taken
    top = df["Specialization"].value_counts().head(TOP_SPEC).index
    df["Specialization"] = df["Specialization"].where(df["Specialization"].isin(top), "other")
    X, y = df[NUM + CAT], np.log(df["Salary"])
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=SEED)
    print(f"rows: {len(df)}  median salary: INR {df['Salary'].median():,.0f}")

    models = {
        "Baseline (mean)": DummyRegressor(),
        "Ridge": Ridge(alpha=3.0),
        "RandomForest": RandomForestRegressor(n_estimators=300, min_samples_leaf=5, n_jobs=-1, random_state=SEED),
        "GradientBoosting": GradientBoostingRegressor(n_estimators=250, max_depth=3, learning_rate=0.05, subsample=0.8, random_state=SEED),
    }
    kf = KFold(5, shuffle=True, random_state=SEED)
    results = {}
    for name, reg in models.items():
        m = pipe(reg).fit(Xtr, ytr)
        pred, true = np.exp(m.predict(Xte)), np.exp(yte)
        cv = cross_val_score(pipe(reg), X, y, cv=kf, scoring="r2", n_jobs=-1)
        results[name] = {"r2_log": round(float(r2_score(yte, m.predict(Xte))), 4), "cv5_r2_log": round(float(cv.mean()), 4),
                         "mae_inr": int(mean_absolute_error(true, pred)), "median_abs_error_inr": int(median_absolute_error(true, pred))}
        print(f"{name:18s}", results[name])

    deployed = max((k for k in results if k != "Baseline (mean)"), key=lambda k: results[k]["cv5_r2_log"])
    oof = cross_val_predict(pipe(models[deployed]), X, y, cv=kf, n_jobs=-1)
    lo, hi = np.quantile(y - oof, [0.10, 0.90])
    final = pipe(models[deployed]).fit(X, y)
    joblib.dump({"model": final, "interval_log": [float(lo), float(hi)], "top_specializations": list(top),
                 "degrees": sorted(df["Degree"].unique()), "medians": {c: float(df[c].median()) for c in APTITUDE}}, OUT / "salary.joblib", compress=3)
    coverage = float(((y - oof >= lo) & (y - oof <= hi)).mean())
    (OUT / "metrics_salary.json").write_text(json.dumps({
        "dataset": "Kaggle: manishkc06/engineering-graduate-salary-prediction", "n_samples": int(len(df)), "currency": "INR",
        "median_salary": int(df["Salary"].median()), "deployed_model": deployed, "comparison_on_holdout": results,
        "interval": {"level": "80% (10th-90th percentile of CV residuals)", "log_low": round(float(lo), 3), "log_high": round(float(hi), 3), "empirical_coverage": round(coverage, 3)},
        "note": "Salary depends mostly on factors outside these inputs (skills, company, city). R2 is modest by nature; treat the range as a rough benchmark.",
    }, indent=2))
    print(f"deployed: {deployed}   80% interval x{np.exp(lo):.2f} .. x{np.exp(hi):.2f}   saved salary.joblib")


if __name__ == "__main__":
    main()
