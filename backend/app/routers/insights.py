"""Student career insights: placement probability, expected salary range, readiness score, skill gap, interview trend."""
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ml import service as ml
from ..ai.matching import norm
from ..db import col
from ..deps import require_roles, uid
from ..serialize import doc_out

router = APIRouter(prefix="/api/insights", tags=["insights"])

STREAM_CHOICES = ["Computer Science", "Information Technology", "Electronics And Communication", "Electrical", "Mechanical", "Civil"]


class Aptitude(BaseModel):
    English: float | None = Field(default=None, ge=0, le=900)
    Logical: float | None = Field(default=None, ge=0, le=900)
    Quant: float | None = Field(default=None, ge=0, le=900)
    ComputerProgramming: float | None = Field(default=None, ge=0, le=900)


class AcademicIn(BaseModel):
    stream: str
    cgpa: float = Field(ge=0, le=10)
    internships: int = Field(default=0, ge=0, le=10)
    backlogs: bool = False
    tenthPercent: float = Field(default=75, ge=0, le=100)
    twelfthPercent: float = Field(default=75, ge=0, le=100)
    collegeTier: int = Field(default=2, ge=1, le=3)
    degree: str = "B.Tech/B.E."
    aptitude: Aptitude = Field(default_factory=Aptitude)


async def predictions(a: AcademicIn) -> dict:
    stream = ml.normalise_stream(a.stream)
    if not stream:
        raise HTTPException(422, f"Choose a stream from: {', '.join(STREAM_CHOICES)}")
    placement = await ml.placement_report(stream, a.cgpa, a.internships, a.backlogs)
    salary = await ml.salary_range(stream, a.cgpa, a.tenthPercent, a.twelfthPercent, a.collegeTier, a.degree, a.aptitude.model_dump())
    return {"stream": stream, "placement": placement, "salary": salary}


@router.post("/what-if")
async def what_if(body: AcademicIn, _: dict = Depends(require_roles("student"))):
    """Predictions for arbitrary inputs (nothing is saved): powers the sliders on the insights page."""
    return await predictions(body)


def readiness_components(user: dict, courses_pct: float, interview_avg: float | None, resume_score: int | None, apps: int) -> dict:
    p = user.get("profile") or {}
    a = p.get("academic") or {}
    filled = [bool(p.get(k)) for k in ("headline", "bio", "location", "linkedinUrl", "portfolioUrl")]
    filled += [len(p.get("skills", [])) >= 5, bool(a.get("cgpa")) and bool(a.get("stream"))]
    return {"profile": round(100 * sum(filled) / len(filled)), "learning": round(courses_pct),
            "interview": round(interview_avg * 10) if interview_avg is not None else 0,
            "resume": resume_score or 0, "activity": round(100 * min(apps, 5) / 5)}


WEIGHTS = {"profile": 0.25, "learning": 0.20, "interview": 0.25, "resume": 0.20, "activity": 0.10}
ADVICE = {
    "profile": ("Complete your profile (headline, bio, 5+ skills, academic details)", "/profile"),
    "learning": ("Finish more course lessons", "/courses"),
    "interview": ("Practise with the AI mock interview", "/mock-interview"),
    "resume": ("Scan your resume and apply the fixes", "/resume-scanner"),
    "activity": ("Apply to a few matching jobs", "/jobs"),
}


@router.get("/me")
async def my_insights(user: dict = Depends(require_roles("student"))):
    me = uid(user)
    p = user.get("profile") or {}

    # ---- readiness (transparent weighted score, not ML)
    lessons = {d["_id"]: d["n"] async for d in await col("courses_lessons").aggregate([{"$group": {"_id": "$parentId", "n": {"$sum": 1}}}])}
    enrolls = [e async for e in col("enrollments").find({"studentId": me})]
    pcts = [100 * len(e.get("completedLessons", [])) / lessons[e["courseId"]] for e in enrolls if lessons.get(e["courseId"])]
    sessions = [s async for s in col("interview_sessions").find({"userId": me, "status": "completed"}).sort("createdAt", -1).limit(10)]
    avg_scores = [s["report"]["average_score"] for s in sessions if s.get("report", {}).get("average_score") is not None]
    last_resume = await col("resume_analyses").find_one({"userId": me}, sort=[("createdAt", -1)])
    apps = await col("applications").count_documents({"studentId": me})
    comp = readiness_components(user, sum(pcts) / len(pcts) if pcts else 0, sum(avg_scores[:5]) / len(avg_scores[:5]) if avg_scores else None,
                                last_resume["result"].get("overall_score") if last_resume else None, apps)
    score = round(sum(comp[k] * w for k, w in WEIGHTS.items()))
    weakest = sorted(comp, key=lambda k: comp[k])[:2]
    next_steps = [{"area": k, "score": comp[k], "text": ADVICE[k][0], "link": ADVICE[k][1]} for k in weakest if comp[k] < 80]

    # ---- ML predictions from academic details
    a = p.get("academic") or {}
    ml_out, missing = None, None
    if a.get("stream") and a.get("cgpa") is not None:
        try:
            ml_out = await predictions(AcademicIn(stream=a["stream"], cgpa=a["cgpa"], internships=a.get("internships", 0), backlogs=bool(a.get("backlogs")),
                                                  tenthPercent=a.get("tenthPercent", 75), twelfthPercent=a.get("twelfthPercent", 75),
                                                  collegeTier=a.get("collegeTier", 2), degree=a.get("degree", "B.Tech/B.E."),
                                                  aptitude=Aptitude(**(a.get("aptitude") or {}))))
        except HTTPException as e:
            missing = e.detail
    else:
        missing = "Add your stream and CGPA (Profile -> Academic details) to unlock placement and salary predictions."

    # ---- skill gap vs what open jobs ask for
    demand: Counter = Counter()
    labels: dict[str, str] = {}
    async for job in col("jobs").find({"isOpen": True, "$or": [{"riskLevel": {"$ne": "high"}}, {"reviewStatus": "approved"}]}, {"skills": 1}):
        for s in set(norm(x) for x in job.get("skills", []) if norm(x)):
            demand[s] += 1
        for x in job.get("skills", []):
            labels.setdefault(norm(x), x)
    mine = {norm(x) for x in p.get("skills", [])}
    if last_resume:
        mine |= {norm(x) for x in last_resume["result"].get("skills", {}).get("technical", [])}
    gap = [{"skill": labels[s], "jobs": n, "have": s in mine} for s, n in demand.most_common(12)]

    courses_suggested = []
    missing_skills = [g["skill"] for g in gap if not g["have"]][:3]
    if missing_skills:
        courses = [c async for c in col("courses").find({}, {"title": 1, "shortDescription": 1, "tags": 1})]
        if courses:
            texts = [f"{c['title']}. {c.get('shortDescription', '')} {' '.join(c.get('tags', []))}" for c in courses]
            for skill in missing_skills:
                sims = await ml.semantic_scores(skill, texts)
                best = max(range(len(courses)), key=lambda i: sims[i])
                if sims[best] >= 0.3:
                    courses_suggested.append({"skill": skill, "courseId": str(courses[best]["_id"]), "title": courses[best]["title"]})

    return {"academic": a, "predictions": ml_out, "predictionsHint": missing, "streams": STREAM_CHOICES,
            "readiness": {"score": score, "components": comp, "weights": WEIGHTS, "nextSteps": next_steps},
            "interviewTrend": [{"date": s["createdAt"], "score": s["report"]["average_score"], "role": s["role"]} for s in reversed(sessions)
                               if s.get("report", {}).get("average_score") is not None],
            "skillGap": gap, "courseSuggestions": courses_suggested}
