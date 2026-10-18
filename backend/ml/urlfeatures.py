"""Lexical URL features (no page fetch needed). Same code for training and serving."""
import math
import re
from urllib.parse import urlparse

SUSPICIOUS_TLDS = {"zip", "mov", "tk", "ml", "ga", "cf", "gq", "xyz", "top", "click", "country", "kim", "work", "loan", "date", "download", "review", "stream", "science"}
SHORTENERS = {"bit.ly", "tinyurl.com", "goo.gl", "t.co", "ow.ly", "is.gd", "buff.ly", "rebrand.ly", "cutt.ly", "shorturl.at", "rb.gy"}
KEYWORDS = ("login", "signin", "secure", "verify", "account", "update", "bank", "paypal", "password", "confirm", "wallet", "free", "bonus", "prize", "invoice", "support")
IP_HOST = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")

FEATURES = ["url_len", "host_len", "path_len", "query_len", "dots", "hyphens", "digits", "digit_ratio", "at_sign", "has_ip_host", "subdomains", "suspicious_tld",
            "entropy", "slashes", "https", "double_slash_in_path", "special_chars", "shortener", "keyword_hits", "host_digit_ratio", "longest_token", "punycode",
            "port_specified", "percent_encoding", "host_hyphens"]


def normalise(url: str) -> str:
    """Strip scheme/www so the model cannot learn dataset artefacts ("http://" present or not)."""
    u = url.strip()
    u = re.sub(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", "", u)
    return re.sub(r"^www\.", "", u)


def entropy(s: str) -> float:
    if not s:
        return 0.0
    return -sum((s.count(c) / len(s)) * math.log2(s.count(c) / len(s)) for c in set(s))


def features(raw_url: str) -> list[float]:
    https = float(raw_url.strip().lower().startswith("https://"))
    u = normalise(raw_url)
    try:
        parsed = urlparse("//" + u)
        host, path, query = (parsed.hostname or "").lower(), parsed.path or "", parsed.query or ""
        has_port = parsed.port is not None
    except ValueError:                      # malformed input (bad port / IPv6): fall back to naive splitting
        host, _, rest = u.partition("/")
        host, path, query, has_port = host.split("@")[-1].lower(), "/" + rest.split("?")[0], rest.partition("?")[2], True
    parts = host.split(".") if host else []
    tld = parts[-1] if parts else ""
    tokens = re.split(r"[^a-zA-Z0-9]+", u)
    n = max(len(u), 1)
    return [len(u), len(host), len(path), len(query), u.count("."), u.count("-"), sum(c.isdigit() for c in u), sum(c.isdigit() for c in u) / n,
            float("@" in u), float(bool(IP_HOST.match(host))), max(len(parts) - 2, 0), float(tld in SUSPICIOUS_TLDS), entropy(u), u.count("/"), https,
            float("//" in u[1:]), sum(not c.isalnum() and c not in "./-:" for c in u), float(host in SHORTENERS),
            sum(k in u.lower() for k in KEYWORDS), sum(c.isdigit() for c in host) / max(len(host), 1), max((len(t) for t in tokens), default=0),
            float("xn--" in host), float(has_port), float("%" in u), host.count("-")]


def reasons(raw_url: str) -> list[str]:
    f = dict(zip(FEATURES, features(raw_url)))
    out = []
    if f["has_ip_host"]:
        out.append("Uses a raw IP address instead of a domain name")
    if f["at_sign"]:
        out.append("Contains '@', which can hide the real destination")
    if f["suspicious_tld"]:
        out.append("Uses a top-level domain popular with throw-away sites")
    if f["shortener"]:
        out.append("Link shortener: the real destination is hidden")
    if f["punycode"]:
        out.append("Look-alike (punycode) characters in the domain")
    if f["subdomains"] >= 3:
        out.append("Unusually many subdomains")
    if f["keyword_hits"] >= 2:
        out.append("Several 'account/verify/login' style words in the address")
    if f["url_len"] > 90:
        out.append("Very long address")
    if not f["https"]:
        out.append("Not using HTTPS")
    return out
