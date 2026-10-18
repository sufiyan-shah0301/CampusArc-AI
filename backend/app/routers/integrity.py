"""Admin integrity tools: resume-plagiarism flags and suspicious-account detection (Isolation Forest)."""
import time

import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ml import anomaly_users
from ..db import col
from ..deps import require_roles
from ..serialize import doc_out, now, oid

router = APIRouter(prefix="/api/admin/integrity", tags=["integrity"])
_cache: dict = {"at": 0.0, "value": None}


async def student_matrix() -> tuple[list[dict], np.ndarray]:
    students = [u async for u in col("users").find({"role": "student"})]
    ids = [str(u["_id"]) for u in students]
    t = now()

    async def counts(coll: str, field: str, extra: dict | None = None) -> dict:
        cur = await col(coll).aggregate([{"$match": {field: {"$in": ids}, **(extra or {})}}, {"$group": {"_id": f"${field}", "n": {"$sum": 1}}}])
        return {d["_id"]: d["n"] async for d in cur}

    apps = await counts("applications", "studentId")
    from datetime import timedelta
    recent = await counts("applications", "studentId", {"appliedAt": {"$gte": t - timedelta(hours=24)}})
    scans = await counts("resume_analyses", "userId")
    chats_cur = await col("chats").aggregate([{"$unwind": "$participants"}, {"$match": {"participants": {"$in": ids}}}, {"$group": {"_id": "$participants", "n": {"$sum": 1}}}])
    chats = {d["_id"]: d["n"] async for d in chats_cur}
    rec_cur = await col("applications").aggregate([{"$match": {"studentId": {"$in": ids}}}, {"$group": {"_id": {"s": "$studentId", "r": "$recruiterId"}}},
                                                   {"$group": {"_id": "$_id.s", "n": {"$sum": 1}}}])
    recruiters = {d["_id"]: d["n"] async for d in rec_cur}
    match_cur = await col("applications").aggregate([{"$match": {"studentId": {"$in": ids}}}, {"$group": {"_id": "$studentId", "m": {"$avg": "$matchScore"}}}])
    match = {d["_id"]: d["m"] or 0 for d in [x async for x in match_cur]}

    rows = []
    for u in students:
        i, p = str(u["_id"]), u.get("profile") or {}
        age = max((t - u["createdAt"]).total_seconds() / 86400, 0.05) if u.get("createdAt") else 1.0
        filled = sum(bool(p.get(k)) for k in ("headline", "bio", "location", "linkedinUrl", "portfolioUrl")) + bool(p.get("skills")) + bool(p.get("academic"))
        rate_age = max(age, 1.0)   # a minutes-old account with one application is not a "fast" applicant
        rows.append([apps.get(i, 0), apps.get(i, 0) / rate_age, recent.get(i, 0), recruiters.get(i, 0), match.get(i, 50 if not apps.get(i) else 0), age,
                     filled, len(p.get("skills", [])), scans.get(i, 0), chats.get(i, 0)])
    return students, np.asarray(rows, dtype=float).reshape(len(students), len(anomaly_users.FEATURES))


async def scored(force: bool = False) -> dict:
    if not force and _cache["value"] and time.time() - _cache["at"] < 300:
        return _cache["value"]
    students, X = await student_matrix()
    model = anomaly_users.build(X if len(X) else None)
    results = model.score(X) if len(X) else []
    value = {"source": model.source, "n": len(students),
             "accounts": sorted(({"id": str(u["_id"]), "name": u.get("displayName", ""), "email": u.get("email", ""), **r}
                                 for u, r in zip(students, results)), key=lambda a: -a["anomalyPercentile"])}
    _cache.update(at=time.time(), value=value)
    return value


@router.get("")
async def overview(_: dict = Depends(require_roles("admin"))):
    flags = []
    async for f in col("integrity_flags").find({"status": "open"}).sort("createdAt", -1).limit(100):
        names = {}
        for key in ("userId", "otherUserId"):
            u = await col("users").find_one({"_id": oid(f[key])}, {"displayName": 1, "email": 1}) if f.get(key) else None
            names[key] = {"name": u.get("displayName", "?"), "email": u.get("email", "")} if u else None
        flags.append({**doc_out(f), "user": names["userId"], "otherUser": names["otherUserId"]})
    s = await scored()
    return {"flags": flags, "accounts": s["accounts"][:25], "model": {"source": s["source"], "students": s["n"], "minToFit": anomaly_users.MIN_FIT,
                                                                       "flagged": sum(a["suspicious"] for a in s["accounts"])}}


class FlagUpdate(BaseModel):
    status: str


@router.patch("/flags/{flag_id}")
async def update_flag(flag_id: str, body: FlagUpdate, _: dict = Depends(require_roles("admin"))):
    if body.status not in {"dismissed", "confirmed"}:
        raise HTTPException(422, "status must be dismissed or confirmed")
    res = await col("integrity_flags").update_one({"_id": oid(flag_id)}, {"$set": {"status": body.status, "reviewedAt": now()}})
    if not res.matched_count:
        raise HTTPException(404, "Flag not found")
    return {"status": body.status}


@router.post("/refit")
async def refit(_: dict = Depends(require_roles("admin"))):
    s = await scored(force=True)
    return {"source": s["source"], "students": s["n"]}
