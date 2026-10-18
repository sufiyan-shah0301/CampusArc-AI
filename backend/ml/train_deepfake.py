"""Deepfake / synthetic-face detector (Kaggle: manjilkarki/deepfake-and-real-images, 256x256 faces).

Models (trained on a balanced sample of the TRAIN split, tuned on a VALIDATION sample, reported on the official TEST split):
  * CLIP ViT-B/32 image embeddings -> logistic regression and a small MLP ("linear probe" style detectors)
  * Random Forest on image-forensics features (ELA, noise residual, frequency spectrum, colour)  - explainable signals
  * a stacking logistic regression that combines the three probabilities (fitted on the validation sample)
  * Isolation Forest fitted ONLY on real images (anomaly detection in CLIP space) as an unsupervised second opinion

Training images are randomly degraded (JPEG re-compression, down/up-scaling) so the detector survives social-media style
processing; the test split is evaluated both clean and degraded.

    python -m ml.train_deepfake [--n-train 12000] [--n-val 2000] [--n-test 2000]
"""
import argparse
import io
import json
import random
import time
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import imagehash
import joblib
import numpy as np
from PIL import Image
from sklearn.decomposition import PCA
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler

from .mediafeatures import FORENSIC_NAMES, forensic

ROOT = Path(__file__).parent
DATA = ROOT / "data" / "deepfake_raw" / "Dataset"
OUT = ROOT / "models"
CACHE = ROOT / "data" / "deepfake_features_v2.npz"
SEED = 42
CLIP = "sentence-transformers/clip-ViT-B-32"


def degrade(img: Image.Image, rnd: random.Random) -> Image.Image:
    """Social-media style damage: random down/up-scaling and JPEG re-compression."""
    if rnd.random() < 0.5:
        s = rnd.uniform(0.55, 0.95)
        w, h = img.size
        img = img.resize((max(32, int(w * s)), max(32, int(h * s))), Image.BILINEAR).resize((w, h), Image.BILINEAR)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=rnd.randint(45, 90))
    buf.seek(0)
    return Image.open(buf).convert("RGB")


def sample(split: str, n: int, seed: int) -> tuple[list[str], np.ndarray]:
    rnd = random.Random(seed)
    paths, labels = [], []
    for label, cls in ((0, "Real"), (1, "Fake")):
        files = sorted((DATA / split / cls).glob("*.jpg"))
        paths += [str(p) for p in rnd.sample(files, n // 2)]
        labels += [label] * (n // 2)
    return paths, np.asarray(labels)


def _forensic_one(args) -> np.ndarray:
    path, seed, damage = args
    img = Image.open(path).convert("RGB")
    if damage:
        img = degrade(img, random.Random(seed))
    return forensic(img)


def features(paths: list[str], *, damage_share: float, seed: int, clip=None):
    """Returns forensic matrix, CLIP matrix, perceptual hashes. `damage_share` of the images are degraded."""
    rnd = random.Random(seed)
    damage = [rnd.random() < damage_share for _ in paths]
    t = time.time()
    with ProcessPoolExecutor(max_workers=6) as ex:
        F = np.vstack(list(ex.map(_forensic_one, [(p, seed + i, d) for i, (p, d) in enumerate(zip(paths, damage))], chunksize=32)))
    imgs = [degrade(Image.open(p).convert("RGB"), random.Random(seed + i)) if d else Image.open(p).convert("RGB") for i, (p, d) in enumerate(zip(paths, damage))]
    E = clip.encode(imgs, batch_size=32, normalize_embeddings=True, show_progress_bar=False)
    H = np.asarray([int(str(imagehash.phash(Image.open(p))), 16) for p in paths], dtype=np.uint64)
    print(f"  {len(paths)} images in {time.time() - t:.0f}s (degraded share {damage_share})")
    return F, E, H


def evaluate(y, prob, thr=0.5):
    pred = prob >= thr
    return {"roc_auc": round(float(roc_auc_score(y, prob)), 4), "pr_auc": round(float(average_precision_score(y, prob)), 4), "accuracy": round(float((pred == y).mean()), 4),
            "precision": round(float(precision_score(y, pred, zero_division=0)), 4), "recall": round(float(recall_score(y, pred)), 4), "f1": round(float(f1_score(y, pred)), 4)}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n-train", type=int, default=12000)
    ap.add_argument("--n-val", type=int, default=2000)
    ap.add_argument("--n-test", type=int, default=2000)
    a = ap.parse_args()
    OUT.mkdir(exist_ok=True)

    if CACHE.exists():
        c = np.load(CACHE, allow_pickle=False)
        d = {k: c[k] for k in c.files}
        print("loaded cached features")
    else:
        from sentence_transformers import SentenceTransformer

        clip = SentenceTransformer(CLIP)
        d = {}
        for name, split, n, seed, dmg in (("tr", "Train", a.n_train, 1, 0.4), ("va", "Validation", a.n_val, 2, 0.4), ("te", "Test", a.n_test, 3, 0.0), ("td", "Test", a.n_test, 3, 1.0)):
            paths, y = sample(split, n, seed if name != "td" else 3)
            print(f"extracting {name}: {len(paths)} {split} images")
            d[f"F{name}"], d[f"E{name}"], d[f"H{name}"] = features(paths, damage_share=dmg, seed=seed * 1000, clip=clip)
            d[f"y{name}"] = y
        np.savez_compressed(CACHE, **d)

    Ftr, Etr, ytr, Htr = d["Ftr"], d["Etr"], d["ytr"], d["Htr"]
    Fva, Eva, yva = d["Fva"], d["Eva"], d["yva"]
    Fte, Ete, yte, Ftd, Etd = d["Fte"], d["Ete"], d["yte"], d["Ftd"], d["Etd"]

    # ---- base models
    lr = LogisticRegression(C=4.0, max_iter=5000).fit(Etr, ytr)
    mlp = MLPClassifier(hidden_layer_sizes=(256, 64), alpha=1e-3, early_stopping=True, n_iter_no_change=8, max_iter=200, random_state=SEED).fit(Etr, ytr)
    rf = RandomForestClassifier(n_estimators=400, min_samples_leaf=2, n_jobs=-1, random_state=SEED, class_weight="balanced").fit(Ftr, ytr)
    base = lambda F, E: np.column_stack([lr.predict_proba(E)[:, 1], mlp.predict_proba(E)[:, 1], rf.predict_proba(F)[:, 1]])

    # ---- stacking meta-model (fitted on the validation sample, never on training predictions)
    logit = lambda p: np.log(np.clip(p, 1e-4, 1 - 1e-4) / (1 - np.clip(p, 1e-4, 1 - 1e-4)))
    stack = LogisticRegression(C=1.0, max_iter=2000).fit(logit(base(Fva, Eva)), yva)
    final = lambda F, E: stack.predict_proba(logit(base(F, E)))[:, 1]

    results = {}
    for tag, (F, E) in (("clean", (Fte, Ete)), ("degraded", (Ftd, Etd))):
        b = base(F, E)
        results[tag] = {"Logistic Regression (CLIP)": evaluate(yte, b[:, 0]), "MLP (CLIP)": evaluate(yte, b[:, 1]), "Random Forest (forensic features)": evaluate(yte, b[:, 2]),
                        "Stacked ensemble (shipped)": evaluate(yte, final(F, E))}
        print(f"--- test images, {tag}")
        for k, v in results[tag].items():
            print(f"  {k:36s}", v)

    # ---- Isolation Forest: real images only, in CLIP-PCA space
    real = ytr == 0
    pca = PCA(n_components=32, random_state=SEED).fit(Etr[real])
    iforest = IsolationForest(n_estimators=400, contamination="auto", random_state=SEED, n_jobs=-1).fit(pca.transform(Etr[real]))
    ref = np.sort(-iforest.score_samples(pca.transform(Etr[real])))
    anomaly = -iforest.score_samples(pca.transform(Ete))
    pct = np.searchsorted(ref, anomaly) / len(ref)
    flagged = pct >= 0.95
    if_metrics = {"roc_auc_vs_fake_label": round(float(roc_auc_score(yte, anomaly)), 4), "flagged_share": round(float(flagged.mean()), 4),
                  "fake_rate_in_flagged": round(float(yte[flagged].mean()), 4) if flagged.any() else 0.0, "fake_rate_in_unflagged": round(float(yte[~flagged].mean()), 4)}
    print("Isolation Forest (real-only, CLIP space):", if_metrics)

    scaler = StandardScaler().fit(Ftr[real])
    top = np.argsort(rf.feature_importances_)[::-1][:10]
    imp = [{"feature": FORENSIC_NAMES[i], "importance": round(float(rf.feature_importances_[i]), 4)} for i in top]
    joblib.dump({"lr": lr, "mlp": mlp, "rf": rf, "stack": stack, "scaler": scaler, "pca": pca, "iforest": iforest, "ref": ref[:: max(1, len(ref) // 2000)], "clip": CLIP},
                OUT / "deepfake.joblib", compress=3)
    np.savez_compressed(OUT / "phash_index.npz", hashes=Htr, labels=ytr)
    (OUT / "metrics_deepfake.json").write_text(json.dumps({
        "dataset": "Kaggle: manjilkarki/deepfake-and-real-images", "n_train": int(len(ytr)), "n_validation": int(len(yva)), "n_test": int(len(yte)),
        "test_split": "official Test folder (never seen in training); 'degraded' = same images re-compressed / rescaled",
        "deployed_model": "Stacked ensemble (CLIP logistic regression + CLIP MLP + forensic Random Forest)",
        "comparison_on_test": results["clean"], "comparison_on_test_degraded": results["degraded"], "isolation_forest": if_metrics, "rf_top_features": imp, "clip_model": CLIP,
        "note": "Trained on faces from one family of generators. Deepfakes from other tools can score lower; treat the result as a risk signal, not proof.",
    }, indent=2))
    print("saved deepfake.joblib + phash_index.npz")


if __name__ == "__main__":
    main()
