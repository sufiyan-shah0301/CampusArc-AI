"""SSRF protection for everything that fetches a user-supplied URL server-side.

A request is allowed only when: the scheme is http(s), there are no credentials in the URL, the port is 80/443, and the
hostname resolves ONLY to public (globally routable) addresses. This blocks localhost, private networks, link-local
and cloud-metadata addresses, including decimal/hex/IPv4-mapped tricks, because the check runs on the *resolved* IPs."""
import asyncio
import ipaddress
import socket
from urllib.parse import urlsplit

ALLOWED_PORTS = {80, 443, None}
BLOCKED_HOSTS = {"localhost", "metadata.google.internal", "metadata", "instance-data"}
BLOCKED_SUFFIXES = (".local", ".localhost", ".internal", ".lan", ".home", ".corp", ".intranet", ".private")
MAX_URL = 2048


class UnsafeUrl(ValueError):
    """Raised with a user-presentable reason."""


def _check_ip(raw: str) -> None:
    ip = ipaddress.ip_address(raw.split("%")[0])
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    if not ip.is_global or ip.is_multicast:
        raise UnsafeUrl("This address points to a private or internal network, so it will not be opened.")


def check_url(url: str, *, resolve: bool = True) -> str:
    """Validates and returns the normalised URL (blocking DNS call: use `acheck_url` from async code)."""
    url = (url or "").strip()
    if not url or len(url) > MAX_URL:
        raise UnsafeUrl("Enter a valid web address.")
    if "://" not in url:
        url = "http://" + url
    try:
        parts = urlsplit(url)
        port = parts.port
    except ValueError:
        raise UnsafeUrl("That does not look like a valid web address.")
    if parts.scheme not in ("http", "https"):
        raise UnsafeUrl("Only http and https links can be opened.")
    if parts.username or parts.password:
        raise UnsafeUrl("Links with embedded credentials are not allowed.")
    if port not in ALLOWED_PORTS:
        raise UnsafeUrl("Only the standard web ports (80 and 443) are allowed.")
    host = (parts.hostname or "").lower().rstrip(".")
    if not host or host in BLOCKED_HOSTS or host.endswith(BLOCKED_SUFFIXES):
        raise UnsafeUrl("This address points to a private or internal network, so it will not be opened.")
    try:                                              # literal IP (any notation Python understands)
        _check_ip(host)
        return url
    except ValueError as e:
        if isinstance(e, UnsafeUrl):
            raise
    if resolve:
        try:
            infos = socket.getaddrinfo(host, port or (443 if parts.scheme == "https" else 80), proto=socket.IPPROTO_TCP)
        except socket.gaierror:
            raise UnsafeUrl("This address could not be found (DNS lookup failed).")
        for info in infos:
            _check_ip(info[4][0])
    return url


async def acheck_url(url: str) -> str:
    return await asyncio.to_thread(check_url, url)
