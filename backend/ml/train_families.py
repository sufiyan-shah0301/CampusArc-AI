"""Job families: unsupervised clustering (TF-IDF -> SVD -> K-Means) learned from the Kaggle job-posting corpus.
Each cluster is named from its highest-weighted terms. New postings on the platform are assigned to a family so that
students can browse by family and the "similar jobs" feature has a coarse structure.

    python -m ml.train_families
"""
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.cluster import MiniBatchKMeans
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import silhouette_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import Normalizer

from .text import job_text

ROOT = Path(__file__).parent
DATA = ROOT / "data" / "fakejobs_raw" / "fake_job_postings.csv"
OUT = ROOT / "models"
SEED = 42
K_RANGE = range(6, 17, 2)


def main() -> None:
    df = pd.read_csv(DATA).fillna("")
    df = df[df["fraudulent"] == 0]                                  # real postings only
    texts = [job_text(t, d, r) for t, d, r in zip(df["title"], df["description"], df["requirements"])]
    texts = [t for t in texts if len(t) > 150]
    tfidf = TfidfVectorizer(sublinear_tf=True, ngram_range=(1, 2), min_df=8, max_df=0.5, max_features=15000, stop_words="english")
    X = tfidf.fit_transform(texts)
    svd = make_pipeline(TruncatedSVD(100, random_state=SEED), Normalizer(copy=False))
    Z = svd.fit_transform(X)
    print(f"postings: {len(texts)}")

    scores = {}
    for k in K_RANGE:
        km = MiniBatchKMeans(k, random_state=SEED, n_init=5, batch_size=2048).fit(Z)
        scores[k] = float(silhouette_score(Z, km.labels_, sample_size=4000, random_state=SEED))
        print(f"k={k:2d} silhouette={scores[k]:.3f}")
    k = max(scores, key=scores.get)
    km = MiniBatchKMeans(k, random_state=SEED, n_init=10, batch_size=2048).fit(Z)

    terms = np.array(tfidf.get_feature_names_out())
    centroids_full = np.vstack([np.asarray(X[km.labels_ == c].mean(axis=0)).ravel() for c in range(k)])
    families = []
    for c in range(k):
        top = [t for t in terms[np.argsort(centroids_full[c])[::-1][:12]]][:6]
        families.append({"id": c, "name": " / ".join(top[:3]).title(), "keywords": top, "size": int((km.labels_ == c).sum())})
    joblib.dump({"tfidf": tfidf, "svd": svd, "kmeans": km, "families": families}, OUT / "families.joblib", compress=3)
    (OUT / "metrics_families.json").write_text(json.dumps({
        "dataset": "Kaggle: shivamb/real-or-fake-fake-jobposting-prediction (legitimate postings only)", "n_samples": len(texts),
        "k_selected_by_silhouette": k, "silhouette_by_k": {str(a): round(b, 4) for a, b in scores.items()}, "families": families,
    }, indent=2))
    for f in sorted(families, key=lambda f: -f["size"]):
        print(f"  [{f['id']:2d}] {f['size']:5d}  {f['name']}")


if __name__ == "__main__":
    main()
