"""Analytics for the placement cell: JSON summaries for the dashboards and CSV exports."""
import csv
import io
from datetime import timedelta

from fastapi import APIRouter, Depends
from fastapi.responses import Response

from ..db import col
from ..deps import require_roles, uid
from ..serialize import now, to_json

router = APIRouter(prefix="/api/reports", tags=["reports"])

STATUSES = ["Applied", "Under Review", "Interviewing", "Hired", "Rejected"]


def csv_safe(v):
    """Stop spreadsheet formula injection: cells starting with = + - @ are prefixed with a quote."""
    s = "" if v is None else str(v)
    return "'" + s if s[:1] in ("=", "+", "-", "@") else s


def csv_response(filename: str, header: list[str], rows: list[list]) -> Response:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(header)
    w.writerows([[csv_safe(c) for c in r] for r in rows])
    return Response(buf.getvalue(), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


async def group_count(collection: str, field: str, match: dict | None = None) -> dict:
    cursor = await col(collection).aggregate([{"$match": match or {}}, {"$group": {"_id": f"${field}", "n": {"$sum": 1}}}])
    return {str(d["_id"]): d["n"] async for d in cursor}


@router.get("/summary")
async def summary(_: dict = Depends(require_roles("admin"))):
    since = now() - timedelta(days=30)
    per_day_cur = await col("applications").aggregate([
        {"$match": {"appliedAt": {"$gte": since}}},
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$appliedAt"}}, "n": {"$sum": 1}}}, {"$sort": {"_id": 1}}])
    skills_cur = await col("jobs").aggregate([{"$unwind": "$skills"}, {"$group": {"_id": {"$toLower": "$skills"}, "n": {"$sum": 1}}},
                                              {"$sort": {"n": -1}}, {"$limit": 10}])
    hires_cur = await col("applications").aggregate([{"$match": {"status": "Hired"}}, {"$group": {"_id": "$companyName", "n": {"$sum": 1}}},
                                                     {"$sort": {"n": -1}}, {"$limit": 8}])
    top_cur = await col("applications").aggregate([{"$group": {"_id": "$companyName", "n": {"$sum": 1}}}, {"$sort": {"n": -1}}, {"$limit": 8}])
    interviews = [d async for d in await col("interview_sessions").aggregate(
        [{"$match": {"status": "completed"}}, {"$group": {"_id": None, "n": {"$sum": 1}, "avg": {"$avg": "$report.average_score"}}}])]
    apps_total = await col("applications").count_documents({})
    hired = await col("applications").count_documents({"status": "Hired"})
    return to_json({
        "usersByRole": await group_count("users", "role"),
        "jobs": {"total": await col("jobs").count_documents({}), "open": await col("jobs").count_documents({"isOpen": True}),
                 "pendingReview": await col("jobs").count_documents({"reviewStatus": "pending"}),
                 "byRisk": await group_count("jobs", "riskLevel"), "byFamily": await group_count("jobs", "family")},
        "applicationsByStatus": {s: (await group_count("applications", "status")).get(s, 0) for s in STATUSES},
        "applicationsPerDay": [{"date": d["_id"], "count": d["n"]} async for d in per_day_cur],
        "topSkillsDemanded": [{"skill": d["_id"], "jobs": d["n"]} async for d in skills_cur],
        "hiresByCompany": [{"company": d["_id"], "hires": d["n"]} async for d in hires_cur],
        "topCompaniesByApplications": [{"company": d["_id"], "applications": d["n"]} async for d in top_cur],
        "placementRate": round(100 * hired / apps_total, 1) if apps_total else 0,
        "interviews": {"completed": interviews[0]["n"] if interviews else 0, "avgScore": round(interviews[0]["avg"], 1) if interviews and interviews[0]["avg"] else None},
        "resumeScans": await col("resume_analyses").count_documents({}), "enrollments": await col("enrollments").count_documents({}),
    })


@router.get("/funnel")
async def funnel(user: dict = Depends(require_roles("recruiter", "admin"))):
    """Hiring funnel for the current recruiter (all jobs for an admin)."""
    match = {} if user["role"] == "admin" else {"recruiterId": uid(user)}
    by_status = await group_count("applications", "status", match)
    per_job_cur = await col("applications").aggregate([
        {"$match": match}, {"$group": {"_id": {"id": "$jobId", "title": "$jobTitle"}, "applicants": {"$sum": 1},
                                       "avgMatch": {"$avg": "$matchScore"},
                                       "hired": {"$sum": {"$cond": [{"$eq": ["$status", "Hired"]}, 1, 0]}}}}, {"$sort": {"applicants": -1}}, {"$limit": 10}])
    return {"byStatus": {s: by_status.get(s, 0) for s in STATUSES},
            "perJob": [{"jobId": d["_id"]["id"], "title": d["_id"]["title"], "applicants": d["applicants"],
                        "avgMatch": round(d["avgMatch"] or 0), "hired": d["hired"]} async for d in per_job_cur]}


@router.get("/applications.csv")
async def applications_csv(user: dict = Depends(require_roles("recruiter", "admin"))):
    match = {} if user["role"] == "admin" else {"recruiterId": uid(user)}
    rows = [[a.get("studentName"), a.get("studentEmail"), a.get("jobTitle"), a.get("companyName"), a.get("status"), a.get("matchScore"),
             a["appliedAt"].date().isoformat() if a.get("appliedAt") else ""] async for a in col("applications").find(match).sort("appliedAt", -1)]
    return csv_response("applications.csv", ["Student", "Email", "Job", "Company", "Status", "Skill match %", "Applied on"], rows)


@router.get("/placements.csv")
async def placements_csv(_: dict = Depends(require_roles("admin"))):
    """Placement-cell report: every hired student with company and role."""
    rows = [[a.get("studentName"), a.get("studentEmail"), a.get("companyName"), a.get("jobTitle"), a["appliedAt"].date().isoformat() if a.get("appliedAt") else ""]
            async for a in col("applications").find({"status": "Hired"}).sort("appliedAt", -1)]
    return csv_response("placements.csv", ["Student", "Email", "Company", "Role", "Applied on"], rows)
