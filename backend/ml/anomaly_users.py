"""Suspicious-account detection with an Isolation Forest over behavioural features.

There is no labelled "bot" data, so this is unsupervised: the model learns what normal students look like and scores
how unusual each account is. With fewer than MIN_FIT real students it is fitted on a clearly-labelled synthetic prior
of plausible normal behaviour; as soon as enough real accounts exist it is re-fitted on them (the admin page shows
which one is active).
"""
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

FEATURES = ["apps_total", "apps_per_day", "apps_last_24h", "distinct_recruiters", "avg_match_score", "account_age_days",
            "profile_fields_filled", "skills_count", "resume_scans", "chats_started"]
MIN_FIT = 40
LABELS = {
    "apps_total": "very many applications", "apps_per_day": "unusually fast application rate", "apps_last_24h": "burst of applications in 24h",
    "distinct_recruiters": "applying to an unusual number of recruiters", "avg_match_score": "applies to jobs that do not match the profile",
    "account_age_days": "brand-new account", "profile_fields_filled": "almost empty profile", "skills_count": "no skills listed",
    "resume_scans": "no resume scanned", "chats_started": "unusual messaging volume",
}


def synthetic_prior(n: int = 600, seed: int = 7) -> np.ndarray:
    """Plausible normal students. Many accounts are young and apply to a few jobs right after signing up (that is
    normal), so the prior has lots of young accounts and rates are computed against max(age, 1 day)."""
    r = np.random.default_rng(seed)
    age = r.gamma(1.3, 20, n) + 0.1
    apps = r.poisson(1.0 + np.minimum(age, 60) / 6)
    rate_age = np.maximum(age, 1.0)
    return np.column_stack([
        apps, apps / rate_age, np.minimum(apps, r.poisson(0.9, n)), np.minimum(apps, r.poisson(2, n) + 1), np.clip(r.normal(55, 20, n), 0, 100),
        age, np.clip(r.normal(4, 1.8, n), 0, 7), np.clip(r.poisson(5, n), 0, 20), r.binomial(2, 0.4, n), r.poisson(1.0, n)])


class UserAnomalyModel:
    def __init__(self, X: np.ndarray, source: str):
        self.source = source
        self.scaler = StandardScaler().fit(X)
        Z = self.scaler.transform(X)
        self.forest = IsolationForest(n_estimators=300, contamination="auto", random_state=7).fit(Z)
        self.ref = np.sort(-self.forest.score_samples(Z))
        self.mean, self.std = X.mean(axis=0), X.std(axis=0) + 1e-9

    def score(self, X: np.ndarray) -> list[dict]:
        raw = -self.forest.score_samples(self.scaler.transform(X))
        pct = np.searchsorted(self.ref, raw) / len(self.ref)
        out = []
        for row, p in zip(X, pct):
            z = (row - self.mean) / self.std
            idx = np.argsort(-np.abs(z))[:3]
            reasons = [LABELS[FEATURES[i]] for i in idx if abs(z[i]) > 2.0 and (z[i] > 0) == (FEATURES[i] in
                       {"apps_total", "apps_per_day", "apps_last_24h", "distinct_recruiters", "chats_started"} or z[i] > 0)]
            low_is_bad = {"avg_match_score", "profile_fields_filled", "skills_count", "resume_scans", "account_age_days"}
            reasons = [LABELS[FEATURES[i]] for i in idx if abs(z[i]) > 2.0 and ((FEATURES[i] in low_is_bad) == (z[i] < 0))]
            out.append({"anomalyPercentile": round(float(p), 3), "suspicious": bool(p >= 0.99), "reasons": reasons})
        return out


def build(real: np.ndarray | None) -> UserAnomalyModel:
    if real is not None and len(real) >= MIN_FIT:
        return UserAnomalyModel(real, f"live data ({len(real)} students)")
    return UserAnomalyModel(synthetic_prior(), "synthetic prior (not enough real students yet)")
