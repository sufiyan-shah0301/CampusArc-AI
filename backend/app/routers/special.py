"""Endpoints that need more than plain CRUD (atomic operations, aggregates)."""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from pymongo import ReturnDocument

from ..db import col
from ..deps import current_user, require_roles, uid
from ..hub import hub
from ..notify import notify
from ..serialize import doc_out, now, oid, parse_dates
from .auth import limiter

router = APIRouter(prefix="/api", tags=["actions"])


class StartChatIn(BaseModel):
    userId: str


class BookIn(BaseModel):
    boothId: str
    slot: str


class ContactIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    message: str = Field(min_length=1, max_length=3000)


@router.post("/chats/start")
async def start_chat(body: StartChatIn, user: dict = Depends(current_user)):
    me, other_id = uid(user), body.userId
    if other_id == me:
        raise HTTPException(422, "Cannot chat with yourself")
    other = await col("users").find_one({"_id": oid(other_id)})
    if not other or not other.get("isActive", True):
        raise HTTPException(404, "User not found")
    existing = await col("chats").find_one({"participants": {"$all": [me, other_id], "$size": 2}})
    if existing:
        return doc_out(existing)
    chat = {"participants": [me, other_id], "participantInfo": [
        {"uid": me, "name": user.get("displayName", "")}, {"uid": other_id, "name": other.get("displayName", "")}],
        "updatedAt": now(), "createdAt": now(), "lastMessage": None}
    res = await col("chats").insert_one(chat)
    chat["_id"] = res.inserted_id
    await hub.publish("chats")
    return doc_out(chat)


@router.post("/jobFairs/{fair_id}/join")
async def join_fair(fair_id: str, user: dict = Depends(require_roles("recruiter"))):
    fair = await col("jobFairs").find_one({"_id": oid(fair_id)})
    if not fair:
        raise HTTPException(404, "Job fair not found")
    if uid(user) in fair.get("participatingCompanies", []):
        raise HTTPException(409, "You already joined this fair")
    booth = {"jobFairId": fair_id, "companyId": uid(user), "companyName": (user.get("profile") or {}).get("companyName") or user.get("displayName") or "A Company",
             "availableSlots": [], "createdAt": now()}
    res = await col("booths").insert_one(booth)
    await col("jobFairs").update_one({"_id": fair["_id"]}, {"$addToSet": {"participatingCompanies": uid(user)}})
    booth["_id"] = res.inserted_id
    await hub.publish("booths", "jobFairs", f"jobFairs/{fair_id}")
    return doc_out(booth)


@router.post("/appointments/book", status_code=201)
async def book_slot(body: BookIn, user: dict = Depends(require_roles("student"))):
    slot = parse_dates(body.slot)
    if not hasattr(slot, "year"):
        raise HTTPException(422, "Invalid slot")
    # atomic: the slot is removed only if it is still available, so two students can never book the same one
    booth = await col("booths").find_one_and_update(
        {"_id": oid(body.boothId), "availableSlots": slot}, {"$pull": {"availableSlots": slot}},
        return_document=ReturnDocument.BEFORE)
    if not booth:
        raise HTTPException(409, "This slot is no longer available")
    appt = {"studentId": uid(user), "studentName": user.get("displayName", ""), "companyId": booth["companyId"],
            "companyName": booth["companyName"], "jobFairId": booth["jobFairId"], "boothId": body.boothId,
            "scheduledTime": slot, "status": "Scheduled", "createdAt": now()}
    try:
        res = await col("appointments").insert_one(appt)
    except Exception:
        await col("booths").update_one({"_id": booth["_id"]}, {"$addToSet": {"availableSlots": slot}})
        raise HTTPException(500, "Could not book the slot")
    appt["_id"] = res.inserted_id
    await notify(booth["companyId"], "appointment", "New interview booked", f"{appt['studentName']} at {slot:%d %b %Y, %H:%M} UTC", "/my-appointments")
    await hub.publish("booths", "appointments")
    return doc_out(appt)


@router.post("/notifications/read-all")
async def read_all(user: dict = Depends(current_user)):
    res = await col("notifications").update_many({"userId": uid(user), "read": False}, {"$set": {"read": True}})
    await hub.publish("notifications")
    return {"updated": res.modified_count}


@router.get("/recruiter/jobs")
async def recruiter_jobs(user: dict = Depends(require_roles("recruiter", "admin"))):
    """The recruiter's jobs with applicant counts, in one round trip."""
    match = {} if user["role"] == "admin" else {"recruiterId": uid(user)}
    cursor = await col("applications").aggregate(
        [{"$match": match}, {"$group": {"_id": "$jobId", "n": {"$sum": 1}}}])
    counts = {d["_id"]: d["n"] async for d in cursor}
    jobs = [doc_out(j) async for j in col("jobs").find(match).sort("postedAt", -1)]
    for j in jobs:
        j["applicantCount"] = counts.get(j["id"], 0)
    return jobs


@router.get("/admin/stats")
async def admin_stats(_: dict = Depends(require_roles("admin"))):
    return {"users": await col("users").count_documents({}), "jobs": await col("jobs").count_documents({}),
            "courses": await col("courses").count_documents({}),
            "applications": await col("applications").count_documents({}),
            "enrollments": await col("enrollments").count_documents({})}


@router.post("/contact", status_code=201)
@limiter.limit("5/minute")
async def contact(request: Request, body: ContactIn):
    await col("contact_messages").insert_one({**body.model_dump(), "submittedAt": now()})
    return {"message": "Message received"}
