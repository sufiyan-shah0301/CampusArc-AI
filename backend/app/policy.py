"""Server-side access rules for every collection.

Each Resource declares who may list/read, create, update (which fields) and delete.
Nothing here trusts the client: ownership fields (studentId, recruiterId, ...) are always set by the server.
"""
from fastapi import HTTPException

from .db import col
from .deps import SECRET_FIELDS, uid
from .serialize import now, oid
from ml import service as ml
from .notify import admin_ids, notify

APP_STATUSES = {"Applied", "Under Review", "Interviewing", "Hired", "Rejected"}
JOB_TYPES = {"Full-time", "Part-time", "Internship", "Contract"}


def deny(msg: str = "Forbidden", code: int = 403):
    raise HTTPException(code, msg)


def pick(body: dict, keys: set[str]) -> dict:
    return {k: v for k, v in body.items() if k in keys}


class Resource:
    name = ""
    subs: dict[str, "SubResource"] = {}
    default_sort = "-createdAt"
    read_roles: tuple = ("student", "recruiter", "admin")
    create_roles: tuple = ()
    delete_roles: tuple = ("admin",)

    # ---- read ----
    def list_scope(self, user: dict) -> dict | None:
        return {} if user["role"] in self.read_roles else None

    def can_read(self, user: dict, doc: dict) -> bool:
        return user["role"] in self.read_roles

    def clean(self, user: dict, doc: dict) -> dict:
        return doc

    # ---- create ----
    async def prepare_create(self, user: dict, body: dict) -> dict:
        if user["role"] not in self.create_roles:
            deny()
        return {**body, "createdAt": now()}

    # ---- update ----
    def set_fields(self, user: dict, doc: dict) -> set[str]:
        return set()

    def op_fields(self, user: dict, doc: dict) -> set[str]:
        return set()

    async def before_update(self, user: dict, doc: dict, sets: dict, ops: dict) -> None:
        pass

    # ---- side effects ----
    async def after_create(self, user: dict, doc: dict) -> None:
        pass

    async def after_update(self, user: dict, old: dict, new: dict) -> None:
        pass

    # ---- delete ----
    def can_delete(self, user: dict, doc: dict) -> bool:
        return user["role"] in self.delete_roles

    async def after_delete(self, doc: dict) -> None:
        pass


class SubResource:
    name = ""
    parent = ""
    sort_field = "createdAt"

    def can_list(self, user: dict, parent: dict) -> dict | None:
        return {}

    async def prepare_create(self, user: dict, parent: dict, body: dict) -> dict:
        deny()

    def can_write(self, user: dict, parent: dict, doc: dict | None = None) -> bool:
        return user["role"] == "admin"

    def set_fields(self, user: dict, parent: dict, doc: dict) -> set[str]:
        return set()


# ---------------------------------------------------------------- users
class Users(Resource):
    name = "users"
    default_sort = "-createdAt"

    def list_scope(self, user):
        if user["role"] == "admin":
            return {}
        if user["role"] == "recruiter":
            return {"role": "student"}
        return None

    def clean(self, user, doc):
        raw_mfa = (doc.get("mfa") or {}).get("enabled")
        doc = {k: v for k, v in doc.items() if k not in SECRET_FIELDS}
        doc["uid"] = str(doc["_id"])
        doc["mfaEnabled"] = bool(raw_mfa)
        # students may not see the e-mail of recruiters/others
        if user["role"] == "student" and str(doc["_id"]) != uid(user):
            doc.pop("email", None)
        return doc

    async def prepare_create(self, user, body):
        deny("Use /api/auth/register")

    def set_fields(self, user, doc):
        if user["role"] == "admin":
            return {"role", "isActive", "displayName"} if str(doc["_id"]) != uid(user) else {"displayName", "profile", "isProfileComplete", "emailNotifications"}
        if str(doc["_id"]) == uid(user):
            return {"displayName", "profile", "isProfileComplete", "emailNotifications"}
        return set()

    async def before_update(self, user, doc, sets, ops):
        if "role" in sets and sets["role"] not in {"student", "recruiter", "admin"}:
            deny("Invalid role", 422)

    def can_delete(self, user, doc):
        return user["role"] == "admin" and str(doc["_id"]) != uid(user)

    async def after_delete(self, doc):
        i = str(doc["_id"])
        await col("applications").delete_many({"studentId": i})
        await col("enrollments").delete_many({"studentId": i})
        await col("appointments").delete_many({"studentId": i})
        await col("jobs").delete_many({"recruiterId": i})


# ---------------------------------------------------------------- jobs
RISK_FIELDS = ("riskScore", "riskLevel", "riskReasons", "anomalyPercentile", "anomalous")


class Jobs(Resource):
    name = "jobs"
    default_sort = "-postedAt"
    create_roles = ("recruiter", "admin")

    # Every posting is screened by the fraud models (Random Forest + Isolation Forest). High-risk postings stay
    # hidden from students until an admin approves them.
    def list_scope(self, user):
        if user["role"] == "student":
            return {"$or": [{"riskLevel": {"$ne": "high"}}, {"reviewStatus": "approved"}]}
        return {}

    def can_read(self, user, doc):
        if user["role"] != "student":
            return True
        return doc.get("riskLevel") != "high" or doc.get("reviewStatus") == "approved"

    def clean(self, user, doc):
        if user["role"] == "admin" or doc.get("recruiterId") == uid(user):
            return doc
        return {k: v for k, v in doc.items() if k not in RISK_FIELDS and k != "reviewStatus"}

    async def screen(self, data: dict) -> dict:
        risk = await ml.job_risk(data["jobTitle"], data["description"], data.get("skills", []), data.get("salary", ""), data.get("location", ""))
        out = {k: risk[k] for k in RISK_FIELDS}
        if risk["riskLevel"] == "high":
            out["reviewStatus"] = "pending"
        out.update(await ml.job_family(data["jobTitle"], data["description"], data.get("skills", [])))   # K-Means job family
        return out

    async def after_create(self, user, doc):
        if doc.get("riskLevel") == "high":
            await notify(await admin_ids(), "job_flagged", "Job flagged for review", f"{doc['jobTitle']} ({doc['riskScore']}% fraud risk)", "/admin/jobs")

    async def after_update(self, user, old, new):
        if new.get("reviewStatus") != old.get("reviewStatus") and new.get("reviewStatus") in ("approved", "rejected"):
            await notify(new["recruiterId"], "job_review", f"Your job was {new['reviewStatus']}", new["jobTitle"], "/manage-jobs")
        elif new.get("reviewStatus") == "pending" and old.get("reviewStatus") != "pending":
            await notify(await admin_ids(), "job_flagged", "Edited job flagged for review", new["jobTitle"], "/admin/jobs")

    async def prepare_create(self, user, body):
        if user["role"] not in self.create_roles:
            deny()
        data = pick(body, {"jobTitle", "companyName", "location", "jobType", "skills", "description", "salary"})
        for f in ("jobTitle", "companyName", "location", "description"):
            if not str(data.get(f, "")).strip():
                deny(f"{f} is required", 422)
        if data.get("jobType", "Full-time") not in JOB_TYPES:
            deny("Invalid jobType", 422)
        data["skills"] = [str(s).strip() for s in data.get("skills", []) if str(s).strip()][:30]
        return {**data, "recruiterId": uid(user), "recruiterName": user.get("displayName", ""),
                "postedAt": now(), "createdAt": now(), "isOpen": True, "status": "open", **await self.screen(data)}

    def _owner(self, user, doc):
        return user["role"] == "admin" or doc.get("recruiterId") == uid(user)

    def set_fields(self, user, doc):
        if not self._owner(user, doc):
            return set()
        fields = {"jobTitle", "companyName", "location", "jobType", "skills", "description", "salary", "status", "isOpen"}
        return fields | {"reviewStatus"} if user["role"] == "admin" else fields

    async def before_update(self, user, doc, sets, ops):
        # keep the two legacy flags consistent
        if "status" in sets:
            sets["isOpen"] = sets["status"] == "open"
        elif "isOpen" in sets:
            sets["status"] = "open" if sets["isOpen"] else "closed"
        if "jobType" in sets and sets["jobType"] not in JOB_TYPES:
            deny("Invalid jobType", 422)
        if "reviewStatus" in sets:
            if sets["reviewStatus"] not in {"approved", "rejected"}:
                deny("Invalid reviewStatus", 422)
            if sets["reviewStatus"] == "rejected":
                sets["isOpen"], sets["status"] = False, "closed"
        if {"jobTitle", "description", "skills", "salary", "location"} & sets.keys():
            merged = {**doc, **sets}
            risk = await self.screen(merged)
            # an admin decision on a flagged posting survives edits only if the model does not escalate it again
            if risk["riskLevel"] == "high" and doc.get("reviewStatus") != "approved":
                risk["reviewStatus"] = "pending"
            sets.update(risk)

    def can_delete(self, user, doc):
        return self._owner(user, doc)

    async def after_delete(self, doc):
        await col("applications").delete_many({"jobId": str(doc["_id"])})


# ---------------------------------------------------------------- applications
class Applications(Resource):
    name = "applications"
    default_sort = "-appliedAt"

    def list_scope(self, user):
        return {"admin": {}, "student": {"studentId": uid(user)}, "recruiter": {"recruiterId": uid(user)}}.get(user["role"])

    def can_read(self, user, doc):
        return user["role"] == "admin" or uid(user) in (doc.get("studentId"), doc.get("recruiterId"))

    async def prepare_create(self, user, body):
        if user["role"] != "student":
            deny("Only students can apply")
        job = await col("jobs").find_one({"_id": oid(str(body.get("jobId", "")))})
        if not job or not job.get("isOpen", True) or (job.get("riskLevel") == "high" and job.get("reviewStatus") != "approved"):
            deny("This job is not open for applications", 409)
        from .ai.matching import match_score  # local import to avoid cycles

        skills = (user.get("profile") or {}).get("skills", [])
        return {"jobId": str(job["_id"]), "jobTitle": job["jobTitle"], "companyName": job["companyName"],
                "recruiterId": job["recruiterId"], "studentId": uid(user),
                "studentName": user.get("displayName", ""), "studentEmail": user.get("email", ""),
                "status": "Applied", "appliedAt": now(), "createdAt": now(), "coverLetter": str(body.get("coverLetter", ""))[:3000],
                "matchScore": match_score(skills, job.get("skills", []))["score"]}

    def set_fields(self, user, doc):
        return {"status"} if user["role"] == "admin" or doc.get("recruiterId") == uid(user) else set()

    async def before_update(self, user, doc, sets, ops):
        if sets.get("status") not in APP_STATUSES:
            deny("Invalid status", 422)

    async def after_create(self, user, doc):
        await notify(doc["recruiterId"], "application", "New application", f"{doc['studentName']} applied for {doc['jobTitle']}",
                     f"/jobs/{doc['jobId']}/applicants")

    async def after_update(self, user, old, new):
        if new["status"] != old["status"]:
            await notify(new["studentId"], "status", f"Application update: {new['status']}", f"{new['jobTitle']} at {new['companyName']}", "/my-applications")


# ---------------------------------------------------------------- admin-managed content
class AdminContent(Resource):
    def __init__(self, name, sort, fields, subs=None):
        self.name, self.default_sort, self.fields = name, sort, fields
        self.subs = subs or {}
        self.create_roles = ("admin",)

    async def prepare_create(self, user, body):
        if user["role"] != "admin":
            deny()
        return {**pick(body, self.fields), "createdAt": now()}

    def set_fields(self, user, doc):
        return self.fields if user["role"] == "admin" else set()


class Lessons(SubResource):
    name, parent = "lessons", "courses"

    async def prepare_create(self, user, parent, body):
        if user["role"] != "admin":
            deny()
        title, url = str(body.get("title", "")).strip(), str(body.get("contentURL", "")).strip()
        if not title or not url:
            deny("title and contentURL are required", 422)
        return {"title": title, "contentURL": url}

    def set_fields(self, user, parent, doc):
        return {"title", "contentURL"} if user["role"] == "admin" else set()


# ---------------------------------------------------------------- enrollments
class Enrollments(Resource):
    name = "enrollments"
    default_sort = "-enrolledAt"

    def list_scope(self, user):
        return {"admin": {}, "student": {"studentId": uid(user)}}.get(user["role"])

    def can_read(self, user, doc):
        return user["role"] == "admin" or doc.get("studentId") == uid(user)

    async def prepare_create(self, user, body):
        if user["role"] != "student":
            deny("Only students can enroll")
        course = await col("courses").find_one({"_id": oid(str(body.get("courseId", "")))})
        if not course:
            deny("Course not found", 404)
        return {"courseId": str(course["_id"]), "courseTitle": course["title"], "studentId": uid(user),
                "enrolledAt": now(), "createdAt": now(), "completedLessons": []}

    def op_fields(self, user, doc):
        return {"completedLessons"} if doc.get("studentId") == uid(user) else set()

    async def before_update(self, user, doc, sets, ops):
        lid = ops.get("addToSet", {}).get("completedLessons")
        if lid is not None:
            lesson = await col("courses_lessons").find_one({"_id": oid(str(lid)), "parentId": doc["courseId"]})
            if not lesson:
                deny("Lesson does not belong to this course", 422)

    def can_delete(self, user, doc):
        return user["role"] == "admin" or doc.get("studentId") == uid(user)


# ---------------------------------------------------------------- chats
class Messages(SubResource):
    name, parent = "messages", "chats"

    def can_list(self, user, parent):
        return {} if uid(user) in parent["participants"] else None

    async def prepare_create(self, user, parent, body):
        if uid(user) not in parent["participants"]:
            deny()
        text = str(body.get("text", "")).strip()
        if not text or len(text) > 2000:
            deny("Message must be 1-2000 characters", 422)
        return {"text": text, "senderId": uid(user)}

    def can_write(self, user, parent, doc=None):
        return False


class Chats(Resource):
    name = "chats"
    default_sort = "-updatedAt"
    subs = {"messages": Messages()}

    def list_scope(self, user):
        return {"participants": uid(user)}

    def can_read(self, user, doc):
        return uid(user) in doc["participants"]

    async def prepare_create(self, user, body):
        deny("Use /api/chats/start")

    def can_delete(self, user, doc):
        return False


# ---------------------------------------------------------------- job fairs / booths / appointments
class JobFairs(Resource):
    name = "jobFairs"
    default_sort = "startDate"
    create_roles = ("recruiter", "admin")

    async def prepare_create(self, user, body):
        if user["role"] not in self.create_roles:
            deny()
        data = pick(body, {"title", "description", "startDate", "endDate"})
        if not str(data.get("title", "")).strip() or "startDate" not in data or "endDate" not in data:
            deny("title, startDate and endDate are required", 422)
        if data["endDate"] <= data["startDate"]:
            deny("endDate must be after startDate", 422)
        return {**data, "organizerId": uid(user), "participatingCompanies": [], "createdAt": now()}

    def set_fields(self, user, doc):
        ok = user["role"] == "admin" or doc["organizerId"] == uid(user)
        return {"title", "description", "startDate", "endDate"} if ok else set()

    def can_delete(self, user, doc):
        return user["role"] == "admin" or doc["organizerId"] == uid(user)

    async def after_delete(self, doc):
        fid = str(doc["_id"])
        await col("booths").delete_many({"jobFairId": fid})
        await col("appointments").delete_many({"jobFairId": fid})


class Booths(Resource):
    name = "booths"
    default_sort = "createdAt"

    async def prepare_create(self, user, body):
        deny("Use /api/jobFairs/{id}/join")

    def set_fields(self, user, doc):
        return set()

    def op_fields(self, user, doc):
        return {"availableSlots"} if doc["companyId"] == uid(user) else set()

    async def before_update(self, user, doc, sets, ops):
        slot = ops.get("addToSet", {}).get("availableSlots")
        if slot is not None and slot <= now():
            deny("Slot must be in the future", 422)

    def can_delete(self, user, doc):
        return user["role"] == "admin" or doc["companyId"] == uid(user)


class Appointments(Resource):
    name = "appointments"
    default_sort = "scheduledTime"

    def list_scope(self, user):
        return {"admin": {}, "student": {"studentId": uid(user)}, "recruiter": {"companyId": uid(user)}}.get(user["role"])

    def can_read(self, user, doc):
        return user["role"] == "admin" or uid(user) in (doc["studentId"], doc["companyId"])

    async def prepare_create(self, user, body):
        deny("Use /api/appointments/book")

    def can_delete(self, user, doc):
        return user["role"] == "admin"


# ---------------------------------------------------------------- Q&A
class Questions(SubResource):
    name, parent = "questions", "qna_sessions"
    sort_field = "askedAt"

    def can_list(self, user, parent):
        if user["role"] == "admin" or parent["recruiterId"] == uid(user):
            return {}
        # everybody else sees answered questions plus their own pending ones
        return {"$or": [{"isAnswered": True}, {"studentId": uid(user)}]}

    async def prepare_create(self, user, parent, body):
        if parent["recruiterId"] == uid(user):
            deny("Hosts cannot ask questions")
        if parent["status"] != "live":
            deny("The session is not live", 409)
        text = str(body.get("text", "")).strip()
        if not text or len(text) > 500:
            deny("Question must be 1-500 characters", 422)
        return {"text": text, "studentId": uid(user), "studentName": user.get("displayName", ""),
                "askedAt": now(), "isAnswered": False, "answerText": None}

    def can_write(self, user, parent, doc=None):
        return parent["recruiterId"] == uid(user) or user["role"] == "admin"

    def set_fields(self, user, parent, doc):
        return {"answerText", "isAnswered"} if self.can_write(user, parent) else set()


class QnaSessions(Resource):
    name = "qna_sessions"
    default_sort = "scheduledTime"
    create_roles = ("recruiter", "admin")
    subs = {"questions": Questions()}

    async def prepare_create(self, user, body):
        if user["role"] not in self.create_roles:
            deny()
        topic = str(body.get("topic", "")).strip()
        if not topic or "scheduledTime" not in body:
            deny("topic and scheduledTime are required", 422)
        return {"topic": topic, "scheduledTime": body["scheduledTime"], "recruiterId": uid(user),
                "recruiterName": user.get("displayName", ""), "status": "scheduled", "createdAt": now()}

    def set_fields(self, user, doc):
        return {"status", "topic", "scheduledTime"} if doc["recruiterId"] == uid(user) or user["role"] == "admin" else set()

    async def before_update(self, user, doc, sets, ops):
        if "status" in sets and sets["status"] not in {"scheduled", "live", "ended"}:
            deny("Invalid status", 422)

    def can_delete(self, user, doc):
        return user["role"] == "admin" or doc["recruiterId"] == uid(user)


class Notifications(Resource):
    name = "notifications"
    default_sort = "-createdAt"

    def list_scope(self, user):
        return {"userId": uid(user)}

    def can_read(self, user, doc):
        return doc["userId"] == uid(user)

    async def prepare_create(self, user, body):
        deny("Notifications are created by the server")

    def set_fields(self, user, doc):
        return {"read"} if doc["userId"] == uid(user) else set()

    async def before_update(self, user, doc, sets, ops):
        if sets.get("read") not in (True, False):
            deny("read must be a boolean", 422)

    def can_delete(self, user, doc):
        return doc["userId"] == uid(user)


class ContactMessages(Resource):
    name = "contact_messages"
    default_sort = "-submittedAt"
    read_roles = ("admin",)

    async def prepare_create(self, user, body):
        deny("Use /api/contact")


REGISTRY: dict[str, Resource] = {r.name: r for r in [
    Users(), Jobs(), Applications(), Enrollments(), Chats(), JobFairs(), Booths(), Appointments(),
    QnaSessions(), ContactMessages(), Notifications(),
    AdminContent("courses", "-createdAt", {"title", "shortDescription", "longDescription", "tags"}, {"lessons": Lessons()}),
    AdminContent("resources", "-createdAt", {"title", "category", "content"}),
    AdminContent("companies", "companyName", {"companyName", "companyWebsite", "industry", "logoUrl", "shortDescription", "aboutSection"}),
]}
