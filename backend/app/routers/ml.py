"""Endpoints backed by the locally trained ML models (no external API involved)."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ml import service as ml
from ml import skills as mlskills
from ..ai.matching import match_score
from ..db import col
from ..deps import current_user, require_roles, uid
from ..serialize import doc_out, oid

router = APIRouter(prefix="/api/ml", tags=["ml"])


class JobIn(BaseModel):
    jobTitle: str = Field(default="", max_length=200)
    description: str = Field(default="", max_length=8000)
    skills: list[str] = Field(default_factory=list, max_length=40)
    salary: str = Field(default="", max_length=100)
    location: str = Field(default="", max_length=200)


class TextIn(BaseModel):
    text: str = Field(min_length=20, max_length=20000)


def job_doc_text(job: dict) -> str:
    return f"{job['jobTitle']}. {job['description']} Skills: {', '.join(job.get('skills', []))}"[:2000]


def student_text(user: dict, analysis: dict | None) -> str:
    p = user.get("profile") or {}
    parts = [p.get("headline", ""), p.get("bio", ""), "Skills: " + ", ".join(p.get("skills", [])), p.get("location", "")]
    if analysis:
        r = analysis["result"]
        sk = r.get("skills", {})
        parts += [r.get("summary", ""), "Resume skills: " + ", ".join(sk.get("technical", []))]
    return " ".join(x for x in parts if x).strip()


def student_skills(user: dict, analysis: dict | None) -> list[str]:
    skills = list((user.get("profile") or {}).get("skills", []))
    if analysis:
        skills += analysis["result"].get("skills", {}).get("technical", [])
    return skills


def blend(semantic: float, skill: float) -> int:
    """Final fit score: 60% semantic embedding similarity, 40% explicit skill overlap."""
    return round(100 * (0.6 * semantic + 0.4 * skill / 100))


@router.post("/job-risk")
async def job_risk(body: JobIn, _: dict = Depends(require_roles("recruiter", "admin"))):
    """Fraud check for a job draft (Random Forest + Isolation Forest). Used for the live warning in the post-job form."""
    if len(body.description.strip()) < 20:
        raise HTTPException(422, "Description is too short to analyse")
    return await ml.job_risk(body.jobTitle, body.description, body.skills, body.salary, body.location)


@router.post("/resume-category")
async def resume_category(body: TextIn, _: dict = Depends(current_user)):
    try:
        return {"predictions": await ml.classify_resume(body.text, 5)}
    except ml.ModelsNotTrained as e:
        raise HTTPException(503, str(e))


@router.post("/skills")
async def extract_skills(body: TextIn, _: dict = Depends(current_user)):
    return {"skills": mlskills.extract(body.text)}


@router.get("/similar-jobs/{job_id}")
async def similar_jobs(job_id: str, user: dict = Depends(current_user)):
    """Nearest open jobs in embedding space (what a student might also like)."""
    job = await col("jobs").find_one({"_id": oid(job_id)})
    if not job:
        raise HTTPException(404, "Job not found")
    visible = {"isOpen": True, "_id": {"$ne": job["_id"]}, "$or": [{"riskLevel": {"$ne": "high"}}, {"reviewStatus": "approved"}]}
    others = [j async for j in col("jobs").find(visible).limit(300)]
    if not others:
        return []
    try:
        sims = await ml.semantic_scores(job_doc_text(job), [job_doc_text(j) for j in others])
    except Exception as e:
        print(f"[ML] similar jobs unavailable: {type(e).__name__}: {e}")
        return []
    ranked = sorted(zip(others, sims), key=lambda t: -t[1])[:4]
    clean = lambda j: doc_out({k: v for k, v in j.items() if k not in ("riskScore", "riskLevel", "riskReasons", "anomalyPercentile", "anomalous", "reviewStatus")})
    return [{**clean(j), "similarity": round(100 * s)} for j, s in ranked if s >= 0.25]


@router.get("/candidates/{job_id}")
async def rank_candidates(job_id: str, user: dict = Depends(require_roles("recruiter", "admin"))):
    """Rank every student for one job: embedding similarity (profile + resume scan) blended with skill overlap."""
    job = await col("jobs").find_one({"_id": oid(job_id)})
    if not job or (user["role"] != "admin" and job["recruiterId"] != uid(user)):
        raise HTTPException(404, "Job not found")
    students = [s async for s in col("users").find({"role": "student", "isActive": True}).limit(500)]
    if not students:
        return {"job": doc_out({"_id": job["_id"], "jobTitle": job["jobTitle"]}), "candidates": []}

    ids = [str(s["_id"]) for s in students]
    analyses = {}
    async for a in col("resume_analyses").find({"userId": {"$in": ids}}).sort("createdAt", 1):
        analyses[a["userId"]] = a                      # newest wins
    applied = {a["studentId"] async for a in col("applications").find({"jobId": job_id})}

    texts = [student_text(s, analyses.get(str(s["_id"]))) or s.get("displayName", "") for s in students]
    try:
        sims = await ml.semantic_scores(job_doc_text(job), texts)
    except Exception as e:  # model download/load problems should not break the page
        print(f"[ML] semantic ranking failed: {type(e).__name__}: {e}")
        raise HTTPException(503, "The semantic model is not available yet. Try again in a minute.")

    out = []
    for s, sim in zip(students, sims):
        i = str(s["_id"])
        m = match_score(student_skills(s, analyses.get(i)), job.get("skills", []))
        p = s.get("profile") or {}
        out.append({"id": i, "displayName": s.get("displayName", ""), "headline": p.get("headline", ""), "location": p.get("location", ""),
                    "skills": p.get("skills", [])[:6], "fit": blend(sim, m["score"]), "semantic": round(100 * sim),
                    "skillOverlap": m["score"], "matchedSkills": m["matched"], "missingSkills": m["missing"],
                    "hasResumeScan": i in analyses, "applied": i in applied})
    out.sort(key=lambda c: c["fit"], reverse=True)
    return {"job": {"id": job_id, "jobTitle": job["jobTitle"], "skills": job.get("skills", [])}, "candidates": out[:25]}


@router.get("/models")
async def model_cards(_: dict = Depends(require_roles("admin"))):
    return ml.metrics()
