"""Tests for notifications, insights, reports, integrity checks and the newer ML features.
The LLM is replaced with canned answers so these tests are fast and deterministic."""
import pytest

from app.ai import llm
from tests.helpers import make_admin
from tests.test_api import client, register, RUN  # noqa: F401
from tests.test_ml import LEGIT

RESUME = ("Priya Nair. Experienced backend engineer with five years building scalable payment platforms in Python and Django. "
          "Led a team of four engineers, designed REST APIs, optimised PostgreSQL queries and automated deployments with Docker and Kubernetes. "
          "Education: B.Tech Computer Science 2018. Skills: Python, Django, PostgreSQL, Docker, Kubernetes, REST API, AWS, Git.").encode()

CANNED_RESUME = {"overall_score": 72, "ats_score": 70, "summary": "Solid.", "candidate": {"name": "Priya"}, "skills": {"technical": ["Python"], "soft": []},
                 "education": [], "experience": [], "years_experience": 5, "projects": [], "section_scores": {"contact": 70}, "strengths": [], "weaknesses": [],
                 "missing_keywords": [], "suggestions": [], "job_match": None}


@pytest.fixture
def fake_llm(monkeypatch):
    async def complete_json(system, user, **kw):
        if "grading one answer" in system:
            return {"score": 8, "verdict": "good", "feedback": "Good.", "strengths": ["clear"], "improvements": [], "model_answer": "Keys give list items a stable identity."}
        if "NEXT interview question" in system:
            return {"question": "What is a React key?", "category": "technical", "expected_points": ["stable identity", "avoid index keys"]}
        if "career coach" in system:
            return {"overall_score": 80, "summary": "ok", "strengths": [], "weaknesses": [], "next_steps": [], "readiness": "getting there"}
        return CANNED_RESUME

    async def complete(messages, **kw):
        return "Led a 4-person team to ship a payments API that cut errors by [X%]."

    monkeypatch.setattr(llm, "complete_json", complete_json)
    monkeypatch.setattr(llm, "complete", complete)


def upload(c, h, data=RESUME, name="cv.txt"):
    return c.post("/api/ai/resume/analyze", headers=h, files={"file": (name, data, "text/plain")})


def test_notifications_flow(client):
    rh, rec, _ = register(client, "recruiter", 31)
    sh, stu, _ = register(client, "student", 31)
    other, _, _ = register(client, "student", 32)
    job = client.post("/api/jobs", headers=rh, json=LEGIT).json()
    client.post("/api/applications", headers=sh, json={"jobId": job["id"]})
    mine = client.get("/api/notifications", headers=rh).json()
    assert any(n["type"] == "application" and not n["read"] for n in mine)

    app_id = client.get(f"/api/applications?jobId={job['id']}", headers=rh).json()[0]["id"]
    client.patch(f"/api/applications/{app_id}", headers=rh, json={"status": "Interviewing"})
    s_notes = client.get("/api/notifications", headers=sh).json()
    assert any("Interviewing" in n["title"] for n in s_notes)

    # privacy: nobody else can see, edit or delete them; only 'read' can change
    nid = s_notes[0]["id"]
    assert client.get("/api/notifications", headers=other).json() == []
    assert client.get(f"/api/notifications/{nid}", headers=other).status_code == 403
    assert client.patch(f"/api/notifications/{nid}", headers=other, json={"read": True}).status_code == 403
    assert client.patch(f"/api/notifications/{nid}", headers=sh, json={"title": "hacked"}).status_code == 403
    assert client.patch(f"/api/notifications/{nid}", headers=sh, json={"read": True}).json()["read"] is True
    assert client.post("/api/notifications/read-all", headers=sh).status_code == 200
    assert all(n["read"] for n in client.get("/api/notifications", headers=sh).json())

    chat = client.post("/api/chats/start", headers=rh, json={"userId": stu["id"]}).json()
    for _ in range(3):
        client.post(f"/api/chats/{chat['id']}/messages", headers=rh, json={"text": "ping"})
    msgs = [n for n in client.get("/api/notifications", headers=sh).json() if n["type"] == "message" and not n["read"]]
    assert len(msgs) == 1                      # collapsed into one notification


def test_insights_and_what_if(client):
    sh, stu, _ = register(client, "student", 33)
    rh, _, _ = register(client, "recruiter", 33)
    assert client.get("/api/insights/me", headers=rh).status_code == 403
    first = client.get("/api/insights/me", headers=sh).json()
    assert first["predictions"] is None and "stream" in first["predictionsHint"].lower()
    assert first["readiness"]["score"] < 20

    academic = {"stream": "Computer Science", "cgpa": 7.0, "internships": 0, "backlogs": True, "tenthPercent": 80, "twelfthPercent": 78, "collegeTier": 2, "degree": "B.Tech/B.E."}
    client.patch(f"/api/users/{stu['id']}", headers=sh, json={"profile.academic": academic, "profile.skills": ["Python"]})
    insights = client.get("/api/insights/me", headers=sh).json()
    p = insights["predictions"]
    assert 0 < p["placement"]["probability"] < 1 and p["salary"]["low"] < p["salary"]["expected"] < p["salary"]["high"]
    assert any("backlog" in w["action"].lower() for w in p["placement"]["whatIf"])

    better = client.post("/api/insights/what-if", headers=sh, json={**academic, "cgpa": 9.0, "backlogs": False, "internships": 2}).json()
    assert better["placement"]["probability"] > p["placement"]["probability"]
    assert client.post("/api/insights/what-if", headers=sh, json={**academic, "stream": "Basket Weaving"}).status_code == 422
    assert client.post("/api/insights/what-if", headers=sh, json={**academic, "cgpa": 11}).status_code == 422


def test_reports_and_csv_injection(client):
    ah = make_admin(client, RUN + "rep")
    rh, _, _ = register(client, "recruiter", 34)
    sh, stu, _ = register(client, "student", 34)
    client.patch(f"/api/users/{stu['id']}", headers=sh, json={"displayName": "=HYPERLINK(\"http://evil\")"})
    job = client.post("/api/jobs", headers=rh, json=LEGIT).json()
    client.post("/api/applications", headers=sh, json={"jobId": job["id"]})

    s = client.get("/api/reports/summary", headers=ah).json()
    assert s["usersByRole"]["student"] >= 1 and set(s["applicationsByStatus"]) >= {"Applied", "Hired"}
    assert client.get("/api/reports/summary", headers=rh).status_code == 403
    f = client.get("/api/reports/funnel", headers=rh).json()
    assert f["byStatus"]["Applied"] == 1 and f["perJob"][0]["title"] == LEGIT["jobTitle"]
    csv_text = client.get("/api/reports/applications.csv", headers=rh).text
    assert "Student,Email,Job" in csv_text and "'=HYPERLINK" in csv_text       # formula neutralised
    assert client.get("/api/reports/placements.csv", headers=rh).status_code == 403
    assert client.get("/api/reports/placements.csv", headers=ah).status_code == 200


def test_family_similar_jobs_and_skill_extraction(client):
    rh, _, _ = register(client, "recruiter", 35)
    sh, _, _ = register(client, "student", 35)
    a = client.post("/api/jobs", headers=rh, json=LEGIT).json()
    b = client.post("/api/jobs", headers=rh, json={**LEGIT, "jobTitle": "Frontend Developer", "description": "Build responsive React web interfaces, work with REST APIs and write Jest tests in an agile team. Hybrid in Pune."}).json()
    chef = client.post("/api/jobs", headers=rh, json={"jobTitle": "Head Chef", "companyName": "Spice", "location": "Pune", "jobType": "Full-time", "skills": ["Cooking", "Menu planning"],
                                                      "description": "Lead our restaurant kitchen, plan seasonal menus, manage food costs and train the kitchen staff. Experience in a busy restaurant required."}).json()
    assert a["family"] and "familyId" in a
    ids = [j["id"] for j in client.get(f"/api/ml/similar-jobs/{a['id']}", headers=sh).json()]
    assert b["id"] in ids and a["id"] not in ids                       # the other React job is similar; the job itself is excluded
    assert chef["id"] not in ids or ids.index(chef["id"]) > ids.index(b["id"])   # a chef job ranks below it
    skills = client.post("/api/ml/skills", headers=sh, json={"text": "Skills: Python, Django, REST API, machine learning, Docker and project management experience."}).json()["skills"]
    assert {"python", "django", "docker", "machine learning"} <= set(skills)


def test_resume_plagiarism_flag_and_local_scores(client, fake_llm):
    s1, u1, _ = register(client, "student", 36)
    s2, u2, _ = register(client, "student", 37)
    s3, u3, _ = register(client, "student", 38)
    ah = make_admin(client, RUN + "int")

    r1 = upload(client, s1)
    assert r1.status_code == 200 and "sig" not in r1.json() and r1.json()["ml"]["skills"]
    copy = RESUME.replace(b"Priya Nair", b"Rahul Verma")                                       # same text, new name
    assert upload(client, s2, copy).status_code == 200
    unrelated = b"Registered nurse with eight years of experience in intensive care units, administering medication, monitoring vital signs and supporting families through difficult decisions in busy hospitals."
    assert upload(client, s3, unrelated).status_code == 200

    flags = client.get("/api/admin/integrity", headers=ah).json()
    mine = [f for f in flags["flags"] if f["userId"] == u2["id"]]
    assert mine and mine[0]["otherUserId"] == u1["id"] and mine[0]["minhash"] > 0.8
    assert not [f for f in flags["flags"] if f["userId"] == u3["id"]]
    assert flags["model"]["source"].startswith(("synthetic", "live"))
    assert client.get("/api/admin/integrity", headers=s1).status_code == 403
    assert client.patch(f"/api/admin/integrity/flags/{mine[0]['id']}", headers=ah, json={"status": "dismissed"}).status_code == 200
    assert not [f for f in client.get("/api/admin/integrity", headers=ah).json()["flags"] if f["id"] == mine[0]["id"]]

    # local interview scorer runs next to the LLM grade
    sess = client.post("/api/ai/interview/start", headers=s1, json={"role": "Frontend Developer", "numQuestions": 3}).json()
    ans = client.post(f"/api/ai/interview/{sess['id']}/answer", headers=s1,
                      json={"answer": "Keys give each list item a stable identity so React can reorder instead of re-creating; avoid using the index as key because it breaks state."}).json()
    assert ans["evaluation"]["score"] == 8 and ans["evaluation"]["localScore"] >= 6

    # resume text improver
    assert client.post("/api/ai/improve", headers=s1, json={"text": "Worked on the payments API", "kind": "bullet"}).json()["text"]
