from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .db import col
from .security import decode_token
from .serialize import oid

bearer = HTTPBearer(auto_error=False)

SECRET_FIELDS = ("passwordHash", "resetTokenHash", "resetExpires", "passwordChangedAt", "mfa")


def uid(user: dict) -> str:
    return str(user["_id"])


async def user_from_payload(payload: dict | None) -> dict | None:
    if not payload:
        return None
    try:
        user = await col("users").find_one({"_id": oid(payload["sub"])})
    except HTTPException:
        return None
    if not user or not user.get("isActive", True):
        return None
    changed = user.get("passwordChangedAt")
    if changed and payload["iat"] < int(changed.timestamp()):
        return None  # token issued before the last password change
    return user


async def user_from_token(token: str | None, kind: str = "access") -> dict | None:
    return await user_from_payload(decode_token(token, kind)) if token else None


async def current_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    user = await user_from_token(creds.credentials if creds else None)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    return user


def require_roles(*roles: str):
    async def checker(user: dict = Depends(current_user)) -> dict:
        if user.get("role") not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return user

    return checker
