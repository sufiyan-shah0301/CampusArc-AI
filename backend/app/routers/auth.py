import hashlib
import secrets
from datetime import timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from pymongo.errors import DuplicateKeyError
from slowapi import Limiter
from slowapi.util import get_remote_address

from .. import mailer
from ..config import get_settings
from ..db import col
from ..deps import current_user, user_from_token, uid
from .. import mfa as mfa_lib
from ..security import (create_access_token, create_mfa_token, create_refresh_token, hash_password, verify_password)
from ..serialize import oid
from ..deps import user_from_token
from ..serialize import doc_out, now
from ..deps import SECRET_FIELDS

router = APIRouter(prefix="/api/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)


class RegisterIn(BaseModel):
    displayName: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    # admin accounts can never be self-registered
    role: str = Field(default="student", pattern="^(student|recruiter)$")


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)


class RefreshIn(BaseModel):
    refreshToken: str


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)


class ChangePasswordIn(BaseModel):
    currentPassword: str
    newPassword: str = Field(min_length=8, max_length=128)


class MfaVerifyIn(BaseModel):
    mfaToken: str
    code: str = Field(max_length=32)


def public_user(u: dict) -> dict:
    d = {k: v for k, v in u.items() if k not in SECRET_FIELDS}
    d["mfaEnabled"] = bool((u.get("mfa") or {}).get("enabled"))
    d["uid"] = str(u["_id"])
    return doc_out(d)


def _tokens(u: dict) -> dict:
    i = str(u["_id"])
    return {"accessToken": create_access_token(i), "refreshToken": create_refresh_token(i), "user": public_user(u)}


def _check_strength(password: str) -> None:
    if password.lower() in {"password", "12345678", "qwerty123", "password1"} or password.isdigit():
        raise HTTPException(422, "Password is too weak")


@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def register(request: Request, body: RegisterIn):
    _check_strength(body.password)
    doc = {
        "email": body.email.lower(), "passwordHash": hash_password(body.password),
        "displayName": body.displayName.strip(), "role": body.role, "isActive": True,
        "emailVerified": False, "createdAt": now(), "lastLoginAt": now(), "isProfileComplete": False,
        "profile": {"headline": "", "bio": "", "location": "", "linkedinUrl": "", "portfolioUrl": "",
                    "profileImageUrl": "https://placehold.co/400x400/EBF4FF/76A9FA?text=Avatar", "skills": []},
    }
    try:
        res = await col("users").insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status.HTTP_409_CONFLICT, "This email is already in use.")
    doc["_id"] = res.inserted_id
    return _tokens(doc)


@router.post("/login")
@limiter.limit("10/minute")
async def login(request: Request, body: LoginIn):
    user = await col("users").find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user["passwordHash"]) or not user.get("isActive", True):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if (user.get("mfa") or {}).get("enabled"):
        # password was right: hand out a 5-minute ticket that only works for the second step
        return {"mfaRequired": True, "mfaToken": create_mfa_token(str(user["_id"]))}
    await col("users").update_one({"_id": user["_id"]}, {"$set": {"lastLoginAt": now()}})
    return _tokens(user)


@router.post("/mfa/verify")
@limiter.limit("10/minute")
async def mfa_verify(request: Request, body: MfaVerifyIn):
    user = await user_from_token(body.mfaToken, "mfa")
    if not user or not (user.get("mfa") or {}).get("enabled"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "This sign-in attempt has expired. Please log in again.")
    m = user["mfa"]
    locked_until = m.get("lockedUntil")
    if locked_until and locked_until > now():
        raise HTTPException(429, "Too many wrong codes. Try again in a few minutes.")
    secret = mfa_lib.decrypt(m["secret"])
    step = mfa_lib.matching_step(secret, body.code, m.get("lastStep", 0)) if secret else None
    recovery = mfa_lib.hash_code(body.code)
    if step is not None:
        update = {"$set": {"mfa.lastStep": step, "mfa.fails": 0, "lastLoginAt": now()}}
    elif recovery in m.get("recoveryHashes", []):
        update = {"$pull": {"mfa.recoveryHashes": recovery}, "$set": {"mfa.fails": 0, "lastLoginAt": now()}}      # single use
    else:
        fails = m.get("fails", 0) + 1
        patch = {"mfa.fails": fails}
        if fails >= 5:
            from datetime import timedelta
            patch.update({"mfa.lockedUntil": now() + timedelta(minutes=10), "mfa.fails": 0})
        await col("users").update_one({"_id": user["_id"]}, {"$set": patch})
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid code")
    await col("users").update_one({"_id": user["_id"]}, update)
    return _tokens(await col("users").find_one({"_id": user["_id"]}))


@router.post("/refresh")
@limiter.limit("60/minute")
async def refresh(request: Request, body: RefreshIn):
    user = await user_from_token(body.refreshToken, "refresh")
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    return _tokens(user)


@router.get("/me")
async def me(user: dict = Depends(current_user)):
    return public_user(user)


def _send_mail(to: str, link: str) -> None:
    mailer.send_sync(to, "Reset your CampusArc password",
                     f"Use this link to reset your password (valid for 1 hour):\n\n{link}\n\nIf you did not ask for this, ignore this e-mail.")


@router.post("/forgot-password")
@limiter.limit("5/minute")
async def forgot_password(request: Request, body: ForgotIn, tasks: BackgroundTasks):
    user = await col("users").find_one({"email": body.email.lower()})
    if user:
        token = secrets.token_urlsafe(32)
        await col("users").update_one({"_id": user["_id"]}, {"$set": {
            "resetTokenHash": hashlib.sha256(token.encode()).hexdigest(), "resetExpires": now() + timedelta(hours=1)}})
        tasks.add_task(_send_mail, user["email"], f"{get_settings().frontend_url}/reset-password?token={token}")
    # same answer whether or not the account exists (no user enumeration)
    return {"message": "If that email is registered, a reset link has been sent."}


@router.post("/reset-password")
@limiter.limit("10/minute")
async def reset_password(request: Request, body: ResetIn):
    _check_strength(body.password)
    h = hashlib.sha256(body.token.encode()).hexdigest()
    user = await col("users").find_one({"resetTokenHash": h, "resetExpires": {"$gt": now()}})
    if not user:
        raise HTTPException(400, "This reset link is invalid or has expired.")
    await col("users").update_one({"_id": user["_id"]}, {
        "$set": {"passwordHash": hash_password(body.password), "passwordChangedAt": now()},
        "$unset": {"resetTokenHash": "", "resetExpires": ""}})
    return {"message": "Password updated. You can now log in."}


@router.post("/change-password")
@limiter.limit("5/minute")
async def change_password(request: Request, body: ChangePasswordIn, user: dict = Depends(current_user)):
    if not verify_password(body.currentPassword, user["passwordHash"]):
        raise HTTPException(400, "Current password is incorrect")
    _check_strength(body.newPassword)
    await col("users").update_one({"_id": user["_id"]}, {"$set": {
        "passwordHash": hash_password(body.newPassword), "passwordChangedAt": now()}})
    user = await col("users").find_one({"_id": user["_id"]})
    return _tokens(user)
