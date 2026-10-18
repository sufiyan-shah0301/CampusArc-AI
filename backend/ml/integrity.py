"""Plagiarism / duplicate detection for resumes.

* MinHash signature over 5-word shingles: estimates the Jaccard overlap of two documents, so copy-pasted text is
  caught even after small edits (names changed, a few sentences added).
* Sentence-embedding cosine catches paraphrased copies (done in the router with the shared embedder).
"""
import hashlib
import re
import struct

import numpy as np

K = 128
_PRIME = (1 << 61) - 1
_rng = np.random.default_rng(20240607)
_A = _rng.integers(1, _PRIME, size=K, dtype=np.uint64)
_B = _rng.integers(0, _PRIME, size=K, dtype=np.uint64)
_WORD = re.compile(r"[a-z0-9]+")


def shingles(text: str, size: int = 5) -> set[int]:
    words = _WORD.findall(text.lower())
    if len(words) < size:
        return {int.from_bytes(hashlib.blake2b(" ".join(words).encode(), digest_size=8).digest(), "big")} if words else set()
    return {int.from_bytes(hashlib.blake2b(" ".join(words[i:i + size]).encode(), digest_size=8).digest(), "big") % _PRIME
            for i in range(len(words) - size + 1)}


def signature(text: str) -> list[int]:
    sh = np.fromiter(shingles(text), dtype=np.uint64)
    if sh.size == 0:
        return [0] * K
    # (a*x + b) mod p for every hash function, take the minimum
    with np.errstate(over="ignore"):
        hashed = (np.outer(_A, sh) + _B[:, None]) % np.uint64(_PRIME)
    return [int(v) for v in hashed.min(axis=1)]


def similarity(sig_a: list[int], sig_b: list[int]) -> float:
    a, b = np.asarray(sig_a, dtype=np.uint64), np.asarray(sig_b, dtype=np.uint64)
    return float((a == b).mean())
