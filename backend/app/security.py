from datetime import datetime, timedelta, timezone
import bcrypt
import jwt
from .config import get_settings

ALGO = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode()[:72], bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode()[:72], hashed.encode())
    except ValueError:
        return False


def _token(sub: str, kind: str, delta: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": sub, "type": kind, "iat": int(now.timestamp()), "exp": now + delta}
    return jwt.encode(payload, get_settings().jwt_secret, algorithm=ALGO)


def create_access_token(user_id: str) -> str:
    return _token(user_id, "access", timedelta(minutes=get_settings().access_token_minutes))


def create_refresh_token(user_id: str) -> str:
    return _token(user_id, "refresh", timedelta(days=get_settings().refresh_token_days))


def create_mfa_token(user_id: str) -> str:
    """Short-lived proof that the password step succeeded; only good for the second factor."""
    return _token(user_id, "mfa", timedelta(minutes=5))


def decode_token(token: str, kind: str) -> dict | None:
    """Returns the payload (with 'sub' and 'iat') when the token is valid and of the expected kind."""
    try:
        data = jwt.decode(token, get_settings().jwt_secret, algorithms=[ALGO])
    except jwt.PyJWTError:
        return None
    return data if data.get("type") == kind else None
