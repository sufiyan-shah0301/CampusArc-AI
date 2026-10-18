"""Deepfake verification endpoints (needs the trained model in ml/models and the Kaggle test images in ml/data)."""
import glob
import io
import os
import tempfile

import cv2
import imagehash
import numpy as np
import pytest
from PIL import Image

from ml import deepfake
from tests.test_api import client, register, RUN  # noqa: F401

DATA = os.path.join(os.path.dirname(__file__), "..", "ml", "data", "deepfake_raw", "Dataset", "Test")
pytestmark = pytest.mark.skipif(not deepfake.available() or not glob.glob(os.path.join(DATA, "Fake", "*.jpg")), reason="model or dataset not available")


def pick(cls, n=0):
    return sorted(glob.glob(os.path.join(DATA, cls, "*.jpg")))[n]


def jpeg_bytes(path):
    return open(path, "rb").read()


def test_image_analysis_shape_and_validation(client):
    sh, _, _ = register(client, "student", 71)
    r = client.post("/api/media/analyze", headers=sh, files={"file": ("face.jpg", jpeg_bytes(pick("Fake")), "image/jpeg")})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["kind"] == "image" and 0 <= d["fakeProbability"] <= 1 and d["verdict"] in ("likely_fake", "uncertain", "likely_real")
    assert d["heatmap"].startswith("data:image/png;base64,") and d["cleared"] is True and "anomalyPercentile" in d

    assert client.post("/api/media/analyze", files={"file": ("a.jpg", jpeg_bytes(pick("Fake")), "image/jpeg")}).status_code == 401
    assert client.post("/api/media/analyze", headers=sh, files={"file": ("evil.jpg", b"<html><script>alert(1)</script></html>", "image/jpeg")}).status_code == 415   # type is judged by content, not name
    assert client.post("/api/media/analyze", headers=sh, files={"file": ("x.exe", b"MZ" + b"\x00" * 3000, "application/octet-stream")}).status_code == 415
    assert client.post("/api/media/analyze", headers=sh, files={"file": ("big.jpg", jpeg_bytes(pick("Fake"))[:1000] + b"\x00" * (9 * 1024 * 1024), "image/jpeg")}).status_code == 413
    assert client.post("/api/media/analyze", headers=sh, files={"file": ("cut.jpg", jpeg_bytes(pick("Real"))[:300], "image/jpeg")}).status_code == 422                # truncated image


def test_detector_separates_real_from_fake_on_unseen_images(client):
    """Not a benchmark (see the admin ML page), just a sanity check that the shipped model beats chance on unseen faces."""
    sh, _, _ = register(client, "student", 72)
    probs = {"Real": [], "Fake": []}
    for cls in probs:
        for n in range(6):
            r = client.post("/api/media/analyze", headers=sh, files={"file": ("f.jpg", jpeg_bytes(pick(cls, n * 37)), "image/jpeg")})
            probs[cls].append(r.json()["fakeProbability"])
    assert np.mean(probs["Fake"]) > np.mean(probs["Real"]) + 0.15


def test_known_reference_match_and_saved_report_expires(client, monkeypatch):
    sh, _, _ = register(client, "student", 73)
    path = pick("Fake", 3)
    h = np.uint64(int(str(imagehash.phash(Image.open(path))), 16))
    monkeypatch.setattr(deepfake, "_phash_index", lambda: (np.array([h], dtype=np.uint64), np.array([1])))
    d = client.post("/api/media/analyze", headers=sh, files={"file": ("f.jpg", jpeg_bytes(path), "image/jpeg")}, data={"save": "true"}).json()
    assert d["knownMatch"]["label"] == "fake" and d["knownMatch"]["distance"] == 0

    reports = client.get("/api/media/reports", headers=sh).json()
    assert len(reports) == 1 and "heatmap" not in reports[0] and reports[0]["fakeProbability"] == d["fakeProbability"]     # a summary only, never the media
    raw = client.portal.call(lambda: __import__("app.db", fromlist=["col"]).col("media_reports").find_one({"userId": reports[0]["userId"]}))
    assert raw["expireAt"] > raw["createdAt"]                                                                               # TTL index deletes it after 24 h
    assert client.delete("/api/media/reports", headers=sh).json()["deleted"] == 1
    assert client.get("/api/media/reports", headers=sh).json() == []


def test_video_analysis_and_temp_file_is_deleted(client):
    sh, _, _ = register(client, "student", 74)
    tmpdir = tempfile.gettempdir()
    before = set(glob.glob(os.path.join(tmpdir, "cb_media_*")))
    out = os.path.join(tmpdir, f"cb_test_{RUN}.mp4")
    writer = cv2.VideoWriter(out, cv2.VideoWriter_fourcc(*"mp4v"), 10, (256, 256))
    for n in range(20):
        writer.write(cv2.cvtColor(np.asarray(Image.open(pick("Real", n)).convert("RGB").resize((256, 256))), cv2.COLOR_RGB2BGR))
    writer.release()
    data = open(out, "rb").read()
    os.remove(out)
    r = client.post("/api/media/analyze", headers=sh, files={"file": ("clip.mp4", data, "video/mp4")})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["kind"] == "video" and d["framesAnalysed"] >= 8 and len(d["timeline"]) == d["framesAnalysed"] and 0 <= d["temporalFlicker"] <= 1
    assert set(glob.glob(os.path.join(tmpdir, "cb_media_*"))) == before                                                      # automatic data clearance
    assert client.post("/api/media/analyze", headers=sh, files={"file": ("broken.mp4", b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 4000, "video/mp4")}).status_code == 422


def test_live_frame_endpoint(client):
    sh, _, _ = register(client, "student", 75)
    r = client.post("/api/media/frame", headers=sh, files={"file": ("frame.jpg", jpeg_bytes(pick("Real", 5)), "image/jpeg")})
    assert r.status_code == 200 and set(r.json()) == {"fakeProbability", "verdict", "faceFound", "anomalyPercentile"}
    assert client.post("/api/media/frame", headers=sh, files={"file": ("frame.jpg", b"not an image" * 100, "image/jpeg")}).status_code == 415
