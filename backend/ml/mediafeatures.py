"""Image-forensics features used by the deepfake detector (training and serving share this code).

Each feature targets a known weakness of generated / manipulated faces:
  * ELA (error-level analysis): re-compress at a fixed JPEG quality and look at how the error is distributed; edited or
    synthesised regions compress differently from camera-original ones.
  * Noise residual statistics: real sensors leave a characteristic noise; generators produce smoother or oddly structured noise.
  * Frequency spectrum: GAN up-sampling leaves periodic energy / an abnormal high-frequency fall-off.
  * Colour statistics and sharpness.
"""
import io

import cv2
import numpy as np
from PIL import Image
from scipy.stats import kurtosis, skew

SIZE = 256
FORENSIC_NAMES = (
    ["ela_mean", "ela_std", "ela_p99", "ela_max", "ela_frac_gt8", "ela_block_std", "ela_block_range", "ela_block_cv"]
    + ["noise_std", "noise_abs_mean", "noise_kurtosis", "noise_skew", "noise_rg_corr", "noise_gb_corr"]
    + ["lap_var", "edge_density", "sobel_mean"]
    + [f"fft_ring_{i}" for i in range(8)] + ["fft_slope", "fft_high_ratio", "fft_peak_ratio"]
    + ["sat_mean", "sat_std", "hue_std", "rg_corr", "gb_corr", "cb_std", "cr_std", "luma_std", "luma_mean"]
)


def prep(img: Image.Image) -> Image.Image:
    return img.convert("RGB").resize((SIZE, SIZE), Image.BILINEAR)


def ela_map(img: Image.Image, quality: int = 90) -> np.ndarray:
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=quality)
    buf.seek(0)
    rec = Image.open(buf).convert("RGB")
    return np.abs(np.asarray(img, dtype=np.float32) - np.asarray(rec, dtype=np.float32)).mean(axis=2)


def forensic(img: Image.Image) -> np.ndarray:
    img = prep(img)
    arr = np.asarray(img, dtype=np.float32)
    gray8 = cv2.cvtColor(arr.astype(np.uint8), cv2.COLOR_RGB2GRAY)
    gray = gray8.astype(np.float32)

    ela = ela_map(img)
    blocks = ela.reshape(8, SIZE // 8, 8, SIZE // 8).mean(axis=(1, 3)).ravel()
    f = [ela.mean(), ela.std(), np.percentile(ela, 99), ela.max(), (ela > 8).mean(), blocks.std(), blocks.max() - blocks.min(), blocks.std() / (blocks.mean() + 1e-6)]

    den = cv2.medianBlur(gray8, 3).astype(np.float32)
    res = gray - den
    rch = arr[..., 0] - cv2.medianBlur(arr[..., 0].astype(np.uint8), 3)
    gch = arr[..., 1] - cv2.medianBlur(arr[..., 1].astype(np.uint8), 3)
    bch = arr[..., 2] - cv2.medianBlur(arr[..., 2].astype(np.uint8), 3)
    corr = lambda a, b: float(np.corrcoef(a.ravel(), b.ravel())[0, 1]) if a.std() > 1e-6 and b.std() > 1e-6 else 0.0
    f += [res.std(), np.abs(res).mean(), kurtosis(res.ravel()), skew(res.ravel()), corr(rch, gch), corr(gch, bch)]

    lap = cv2.Laplacian(gray8, cv2.CV_32F)
    sob = np.hypot(cv2.Sobel(gray, cv2.CV_32F, 1, 0), cv2.Sobel(gray, cv2.CV_32F, 0, 1))
    f += [lap.var(), (cv2.Canny(gray8, 100, 200) > 0).mean(), sob.mean()]

    spec = np.log1p(np.abs(np.fft.fftshift(np.fft.fft2(gray - gray.mean()))))
    yy, xx = np.indices(spec.shape)
    r = np.hypot(yy - SIZE / 2, xx - SIZE / 2)
    rings = [spec[(r >= lo) & (r < hi)].mean() for lo, hi in zip(np.linspace(0, SIZE / 2, 9)[:-1], np.linspace(0, SIZE / 2, 9)[1:])]
    slope = np.polyfit(np.arange(8), rings, 1)[0]
    high = spec[(r >= SIZE / 4) & (r < SIZE / 2)]
    f += rings + [slope, float(high.mean() / (spec[(r > 2) & (r < SIZE / 8)].mean() + 1e-6)), float(high.max() / (high.mean() + 1e-6))]

    hsv = cv2.cvtColor(arr.astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
    ycc = cv2.cvtColor(arr.astype(np.uint8), cv2.COLOR_RGB2YCrCb).astype(np.float32)
    f += [hsv[..., 1].mean(), hsv[..., 1].std(), hsv[..., 0].std(), corr(arr[..., 0], arr[..., 1]), corr(arr[..., 1], arr[..., 2]),
          ycc[..., 2].std(), ycc[..., 1].std(), ycc[..., 0].std(), ycc[..., 0].mean()]
    out = np.nan_to_num(np.asarray(f, dtype=np.float64), nan=0.0, posinf=1e6, neginf=-1e6)
    assert len(out) == len(FORENSIC_NAMES)
    return out


def ela_heatmap_png(img: Image.Image) -> bytes:
    """Colour-mapped error-level image for the UI (bright = regions that re-compress differently)."""
    img = prep(img)
    ela = ela_map(img)
    norm = np.clip(ela / max(np.percentile(ela, 99.5), 1e-3), 0, 1)
    heat = cv2.applyColorMap((norm * 255).astype(np.uint8), cv2.COLORMAP_INFERNO)
    ok, png = cv2.imencode(".png", heat)
    return png.tobytes()


_FACE = None


def crop_face(img: Image.Image) -> tuple[Image.Image, bool]:
    """Largest face (with margin) if OpenCV's Haar cascade finds one, else the whole image."""
    global _FACE
    if _FACE is None:
        _FACE = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    rgb = np.asarray(img.convert("RGB"))
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    scale = 640 / max(gray.shape) if max(gray.shape) > 640 else 1.0
    small = cv2.resize(gray, None, fx=scale, fy=scale) if scale != 1.0 else gray
    faces = _FACE.detectMultiScale(small, scaleFactor=1.1, minNeighbors=6, minSize=(48, 48))
    if len(faces) == 0:
        return img, False
    x, y, w, h = max(faces, key=lambda b: b[2] * b[3])
    m = 0.25
    x0, y0 = int(max(0, (x - m * w) / scale)), int(max(0, (y - m * h) / scale))
    x1, y1 = int(min(rgb.shape[1], (x + w * (1 + m)) / scale)), int(min(rgb.shape[0], (y + h * (1 + m)) / scale))
    return img.crop((x0, y0, x1, y1)), True
