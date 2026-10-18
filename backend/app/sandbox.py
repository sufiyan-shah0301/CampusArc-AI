"""Disposable browser: opens a suspicious link inside a throw-away headless Chromium on the SERVER, so the user's own
browser, cookies and device never touch the page. Nothing is persisted: a fresh incognito-style context per request,
no profile directory, downloads refused, and everything is discarded when the call returns."""
import asyncio
import base64
import re
from urllib.parse import urlsplit

from .ssrf import UnsafeUrl, acheck_url

_slots = asyncio.Semaphore(2)               # at most two concurrent browsers
TIMEOUT_MS = 15_000
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 CampusArcSafePreview"
MULTI_TLD = {"co.in", "co.uk", "com.au", "co.nz", "com.br", "co.jp", "com.sg", "org.in", "net.in", "gov.in", "ac.in"}
BRANDS = {
    "paypal": {"paypal.com"}, "google": {"google.com", "google.co.in", "gmail.com", "youtube.com"}, "microsoft": {"microsoft.com", "live.com", "office.com", "outlook.com"},
    "amazon": {"amazon.com", "amazon.in", "amazon.co.uk"}, "facebook": {"facebook.com", "fb.com"}, "instagram": {"instagram.com"}, "apple": {"apple.com", "icloud.com"},
    "netflix": {"netflix.com"}, "linkedin": {"linkedin.com"}, "whatsapp": {"whatsapp.com"}, "paytm": {"paytm.com"}, "naukri": {"naukri.com"},
    "hdfc": {"hdfcbank.com"}, "icici": {"icicibank.com"}, "sbi": {"sbi.co.in", "onlinesbi.sbi", "onlinesbi.com"}, "flipkart": {"flipkart.com"}, "indeed": {"indeed.com"},
}

PAGE_SCRIPT = """() => {
  const text = document.body ? document.body.innerText : '';
  const forms = [...document.forms].map(f => ({ action: f.action || '', method: (f.method || 'get').toLowerCase(),
      hasPassword: !!f.querySelector('input[type=password]'), fields: f.querySelectorAll('input,select,textarea').length }));
  const metaRefresh = (document.querySelector('meta[http-equiv=refresh]') || {}).content || '';
  return { title: document.title || '', text: text.slice(0, 2500), forms, metaRefresh,
           iframes: document.querySelectorAll('iframe').length, scripts: document.querySelectorAll('script').length,
           links: document.querySelectorAll('a[href]').length, passwordFields: document.querySelectorAll('input[type=password]').length };
}"""


def registered_domain(host: str) -> str:
    parts = (host or "").lower().strip(".").split(".")
    if len(parts) >= 3 and ".".join(parts[-2:]) in MULTI_TLD:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:]) if len(parts) >= 2 else host


def signals_from_page(final_url: str, page: dict, redirects: list[str]) -> list[dict]:
    """Behavioural red flags observed in the rendered page: (reason, weight)."""
    host = urlsplit(final_url).hostname or ""
    domain = registered_domain(host)
    out = []
    pw_forms = [f for f in page["forms"] if f["hasPassword"]]
    for f in pw_forms:
        target = urlsplit(f["action"]).hostname if f["action"] else None
        if target and registered_domain(target) != domain:
            out.append({"reason": f"A password form sends your data to a different site ({registered_domain(target)})", "weight": 0.5})
            break
    if pw_forms and not final_url.lower().startswith("https://"):
        out.append({"reason": "Asks for a password over an unencrypted (HTTP) connection", "weight": 0.35})
    blob = f"{page['title']} {page['text'][:600]}".lower()
    for brand, domains in BRANDS.items():
        if re.search(rf"\b{brand}\b", blob) and page["passwordFields"] and domain not in domains:
            out.append({"reason": f"Pretends to be {brand.title()} but is not hosted by {brand.title()}", "weight": 0.45})
            break
    if len(redirects) >= 3:
        out.append({"reason": f"Redirected {len(redirects)} times before landing here", "weight": 0.2})
    if page["metaRefresh"]:
        out.append({"reason": "Redirects itself with a hidden meta-refresh", "weight": 0.15})
    if page["iframes"] >= 3:
        out.append({"reason": "Embeds several hidden frames", "weight": 0.15})
    return out


async def open_in_sandbox(url: str, javascript: bool = False) -> dict:
    url = await acheck_url(url)
    from playwright.async_api import Error as PwError, async_playwright

    blocked: list[str] = []
    domains: set[str] = set()
    verdicts: dict[str, bool] = {}

    async with _slots:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True, args=["--disable-gpu", "--no-first-run", "--disable-extensions", "--disable-background-networking", "--mute-audio"])
            try:
                ctx = await browser.new_context(viewport={"width": 1100, "height": 700}, java_script_enabled=javascript, accept_downloads=False,
                                                service_workers="block", user_agent=UA, locale="en-US", permissions=[], ignore_https_errors=False)

                async def guard(route):
                    req = route.request
                    host = urlsplit(req.url).hostname or ""
                    if req.url.startswith(("data:", "about:", "blob:")):
                        return await route.continue_()
                    ok = verdicts.get(host)
                    if ok is None:
                        try:
                            await acheck_url(req.url)
                            ok = True
                        except UnsafeUrl:
                            ok = False
                        verdicts[host] = ok
                    if not ok:
                        blocked.append(host)
                        return await route.abort("blockedbyclient")
                    domains.add(registered_domain(host))
                    await route.continue_()

                await ctx.route("**/*", guard)
                page = await ctx.new_page()
                page.on("download", lambda d: asyncio.ensure_future(d.cancel()))
                error, status, redirects = None, None, []
                try:
                    resp = await page.goto(url, wait_until="domcontentloaded", timeout=TIMEOUT_MS)
                    if resp:
                        status = resp.status
                        req = resp.request
                        while req.redirected_from:
                            req = req.redirected_from
                            redirects.append(req.url)
                    try:
                        await page.wait_for_load_state("networkidle", timeout=3000)
                    except PwError:
                        pass
                except PwError as e:
                    error = "This link starts a file download, which was refused." if "Download is starting" in str(e) else (
                        "The page took too long to respond." if "Timeout" in str(e) else "The page could not be loaded.")
                if error and not page.url.startswith("http"):
                    return {"opened": False, "error": error, "url": url, "blockedRequests": sorted(set(blocked)), "cleared": True}
                data = await page.evaluate(PAGE_SCRIPT)
                shot = await page.screenshot(type="png", full_page=False)
                final_url = page.url
            finally:
                await browser.close()                           # context, cookies, cache and storage vanish here

    domain = registered_domain(urlsplit(final_url).hostname or "")
    return {"opened": True, "error": error, "url": url, "finalUrl": final_url, "status": status, "redirects": redirects[::-1], "title": data["title"],
            "textPreview": data["text"], "screenshot": "data:image/png;base64," + base64.b64encode(shot).decode(),
            "externalDomains": sorted(d for d in domains if d and d != domain)[:25], "blockedRequests": sorted(set(blocked)),
            "forms": data["forms"], "passwordFields": data["passwordFields"], "iframes": data["iframes"], "scripts": data["scripts"],
            "javascript": javascript, "signals": signals_from_page(final_url, data, redirects), "cleared": True}
