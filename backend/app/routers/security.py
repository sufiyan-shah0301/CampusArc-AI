"""Account security (TOTP MFA) and privacy rights (GDPR / CCPA: access, portability, erasure)."""
import json

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field

from .. import mfa
from ..db import col
from ..deps import SECRET_FIELDS, current_user, uid
from ..policy import REGISTRY
from ..security import verify_password
from ..serialize import doc_out, now, to_json
from .auth import limiter

router = APIRouter(prefix="/api/security", tags=["security"])


class PasswordIn(BaseModel):
    password: str = Field(max_length=128)


class CodeIn(BaseModel):
    code: str = Field(max_length=32)


class PasswordCodeIn(BaseModel):
    password: str = Field(max_length=128)
    code: str = Field(max_length=32)


def _need_password(user: dict, password: str) -> None:
    if not verify_password(password, user["passwordHash"]):
        raise HTTPException(403, "Password is incorrect")


@router.get("/status")
async def status(user: dict = Depends(current_user)):
    m = user.get("mfa") or {}
    return {"mfaEnabled": bool(m.get("enabled")), "recoveryCodesLeft": len(m.get("recoveryHashes", [])), "emailNotifications": user.get("emailNotifications", True)}


@router.post("/mfa/setup")
@limiter.limit("5/minute")
async def mfa_setup(request: Request, body: PasswordIn, user: dict = Depends(current_user)):
    _need_password(user, body.password)
    if (user.get("mfa") or {}).get("enabled"):
        raise HTTPException(409, "Two-factor authentication is already on")
    secret = mfa.new_secret()
    await col("users").update_one({"_id": user["_id"]}, {"$set": {"mfa": {"enabled": False, "pending": mfa.encrypt(secret)}}})
    uri = mfa.provisioning_uri(secret, user["email"])
    return {"secret": secret, "otpauthUri": uri, "qr": mfa.qr_data_uri(uri)}


@router.post("/mfa/enable")
@limiter.limit("10/minute")
async def mfa_enable(request: Request, body: CodeIn, user: dict = Depends(current_user)):
    m = user.get("mfa") or {}
    secret = mfa.decrypt(m["pending"]) if m.get("pending") else None
    if not secret:
        raise HTTPException(409, "Start the setup first")
    step = mfa.matching_step(secret, body.code)
    if step is None:
        raise HTTPException(400, "That code is not valid. Check the time on your phone and try again.")
    codes = mfa.new_recovery_codes()
    await col("users").update_one({"_id": user["_id"]}, {"$set": {"mfa": {"enabled": True, "secret": mfa.encrypt(secret), "lastStep": step,
                                                                          "recoveryHashes": [mfa.hash_code(c) for c in codes], "enabledAt": now()}}})
    return {"enabled": True, "recoveryCodes": codes}      # shown once


@router.post("/mfa/disable")
@limiter.limit("5/minute")
async def mfa_disable(request: Request, body: PasswordCodeIn, user: dict = Depends(current_user)):
    _need_password(user, body.password)
    m = user.get("mfa") or {}
    secret = mfa.decrypt(m["secret"]) if m.get("secret") else None
    if not m.get("enabled") or not secret:
        raise HTTPException(409, "Two-factor authentication is not on")
    ok = mfa.matching_step(secret, body.code, m.get("lastStep", 0)) is not None or mfa.hash_code(body.code) in m.get("recoveryHashes", [])
    if not ok:
        raise HTTPException(400, "Invalid code")
    await col("users").update_one({"_id": user["_id"]}, {"$unset": {"mfa": ""}})
    return {"enabled": False}


# ------------------------------------------------------------------ privacy rights
EXPORT_COLLECTIONS = [("applications", "studentId"), ("enrollments", "studentId"), ("appointments", "studentId"), ("resume_analyses", "userId"),
                      ("interview_sessions", "userId"), ("notifications", "userId"), ("media_reports", "userId")]


@router.get("/privacy/export")
async def export_my_data(user: dict = Depends(current_user)):
    """GDPR art. 15/20 and CCPA 'right to know': everything we hold about you, as machine-readable JSON."""
    me = uid(user)
    profile = {k: v for k, v in user.items() if k not in SECRET_FIELDS and k != "mfa"}
    profile["mfaEnabled"] = bool((user.get("mfa") or {}).get("enabled"))
    bundle = {"exportedAt": now(), "account": doc_out(profile)}
    for name, field in EXPORT_COLLECTIONS:
        bundle[name] = [doc_out({k: v for k, v in d.items() if k not in ("sig", "emb")}) async for d in col(name).find({field: me})]
    if user["role"] == "recruiter":
        bundle["jobs"] = [doc_out(d) async for d in col("jobs").find({"recruiterId": me})]
    bundle["messagesSent"] = [doc_out(d) async for d in col("chats_messages").find({"senderId": me})]
    body = json.dumps(to_json(bundle), indent=2, ensure_ascii=False)
    return Response(body, media_type="application/json", headers={"Content-Disposition": 'attachment; filename="my-campusarc-data.json"'})


@router.delete("/privacy/account")
@limiter.limit("3/minute")
async def delete_my_account(request: Request, body: PasswordIn, user: dict = Depends(current_user)):
    """GDPR art. 17 / CCPA 'right to delete'. Requires the password; removes the account and the data tied to it."""
    _need_password(user, body.password)
    if user["role"] == "admin" and await col("users").count_documents({"role": "admin", "isActive": True}) <= 1:
        raise HTTPException(409, "You are the only administrator. Promote another admin first.")
    me = uid(user)
    await col("users").delete_one({"_id": user["_id"]})
    await REGISTRY["users"].after_delete(user)
    for name, field in (("resume_analyses", "userId"), ("interview_sessions", "userId"), ("notifications", "userId"), ("media_reports", "userId"),
                        ("integrity_flags", "userId"), ("integrity_flags", "otherUserId"), ("chats_messages", "senderId")):
        await col(name).delete_many({field: me})
    chats = [c["_id"] async for c in col("chats").find({"participants": me}, {"_id": 1})]
    await col("chats_messages").delete_many({"parentId": {"$in": [str(c) for c in chats]}})
    await col("chats").delete_many({"_id": {"$in": chats}})
    await col("booths").delete_many({"companyId": me})
    return {"deleted": True}
