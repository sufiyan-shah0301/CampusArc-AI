"""TOTP multi-factor authentication helpers (RFC 6238, compatible with Google Authenticator, Authy, Microsoft Authenticator)."""
import base64
import hashlib
import hmac
import io
import secrets
import time

import pyotp
import qrcode
from cryptography.fernet import Fernet, InvalidToken

from .config import get_settings

ISSUER = "CampusArc"
STEP = 30


def _fernet() -> Fernet:
    key = hashlib.sha256(get_settings().jwt_secret.encode() + b"|mfa-secret-at-rest").digest()
    return Fernet(base64.urlsafe_b64encode(key))


def encrypt(secret: str) -> str:
    return _fernet().encrypt(secret.encode()).decode()


def decrypt(token: str) -> str | None:
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken:
        return None


def new_secret() -> str:
    return pyotp.random_base32()


def provisioning_uri(secret: str, email: str) -> str:
    return pyotp.TOTP(secret, interval=STEP).provisioning_uri(name=email, issuer_name=ISSUER)


def qr_data_uri(uri: str) -> str:
    buf = io.BytesIO()
    qrcode.make(uri, box_size=6, border=2).save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def matching_step(secret: str, code: str, last_step: int = 0) -> int | None:
    """Returns the time step the code belongs to (+-1 step tolerance), or None. Steps <= last_step are rejected so a
    code that was already used cannot be replayed."""
    code = "".join(ch for ch in str(code) if ch.isdigit())
    if len(code) != 6:
        return None
    totp = pyotp.TOTP(secret, interval=STEP)
    now_step = int(time.time() // STEP)
    for step in (now_step - 1, now_step, now_step + 1):
        if step > last_step and hmac.compare_digest(totp.generate_otp(step), code):
            return step
    return None


def new_recovery_codes(n: int = 8) -> list[str]:
    return [f"{secrets.token_hex(3)}-{secrets.token_hex(3)}" for _ in range(n)]


def hash_code(code: str) -> str:
    return hashlib.sha256(code.strip().lower().encode()).hexdigest()
