"""Tests for the ML-backed features (needs the trained models in ml/models and the embedding model)."""
import pytest

from tests.test_api import client, register, RUN  # noqa: F401  (fixture + helpers)
from tests.helpers import make_admin

SCAM = {"jobTitle": "WORK FROM HOME DATA ENTRY!!!", "companyName": "Easy Jobs", "location": "Anywhere", "jobType": "Part-time",
        "skills": [], "description": "URGENT hiring!!! Earn $500 per week from home, no experience needed. Guaranteed income! "
                                     "Pay a small registration fee of $50 to start. Contact us on WhatsApp or mail jobs4u@gmail.com now!!!"}
LEGIT = {"jobTitle": "React Intern", "companyName": "Acme", "location": "Pune", "jobType": "Internship", "salary": "15000",
         "skills": ["React", "JavaScript", "Git"],
         "description": "We are looking for a React intern to build UI components for our SaaS dashboard. You will work with a senior "
                        "engineer, write unit tests and join code reviews. Duration 6 months, hybrid in Pune."}


def test_fake_job_is_screened_and_hidden_until_approved(client):
    rh, _, _ = register(client, "recruiter", 21)
    sh, _, _ = register(client, "student", 21)
    ah = make_admin(client, RUN + "ml")

    legit = client.post("/api/jobs", headers=rh, json=LEGIT).json()
    scam = client.post("/api/jobs", headers=rh, json=SCAM).json()
    assert legit["riskLevel"] == "low" and scam["riskLevel"] == "high" and scam["reviewStatus"] == "pending"
    assert any("fee" in r.lower() for r in scam["riskReasons"])

    # students never see the high-risk posting and cannot apply to it; the risk fields are hidden from them
    listed = {j["id"]: j for j in client.get("/api/jobs?isOpen=true", headers=sh).json()}
    assert legit["id"] in listed and scam["id"] not in listed
    assert "riskScore" not in listed[legit["id"]]
    assert client.get(f"/api/jobs/{scam['id']}", headers=sh).status_code == 403
    assert client.post("/api/applications", headers=sh, json={"jobId": scam["id"]}).status_code == 409

    # only an admin can approve; afterwards it becomes visible
    assert client.patch(f"/api/jobs/{scam['id']}", headers=rh, json={"reviewStatus": "approved"}).status_code == 403
    assert client.patch(f"/api/jobs/{scam['id']}", headers=ah, json={"reviewStatus": "approved"}).status_code == 200
    assert client.get(f"/api/jobs/{scam['id']}", headers=sh).status_code == 200

    # editing a legit job into a scam re-screens it automatically
    edited = client.patch(f"/api/jobs/{legit['id']}", headers=rh, json={"description": SCAM["description"], "jobTitle": SCAM["jobTitle"]}).json()
    assert edited["riskLevel"] == "high"


def test_live_job_risk_and_resume_category(client):
    rh, _, _ = register(client, "recruiter", 22)
    sh, _, _ = register(client, "student", 22)
    r = client.post("/api/ml/job-risk", headers=rh, json={**SCAM, "salary": ""})
    assert r.status_code == 200 and r.json()["riskLevel"] == "high"
    assert client.post("/api/ml/job-risk", headers=sh, json=SCAM).status_code == 403
    cat = client.post("/api/ml/resume-category", headers=sh, json={"text": "Registered Nurse Summary patient care ICU hospital clinical medication administration healthcare staff"})
    assert cat.status_code == 200 and cat.json()["predictions"][0]["category"] == "Healthcare"


def test_semantic_recommendations_and_candidate_ranking(client):
    rh, _, _ = register(client, "recruiter", 23)
    s_react, u1, _ = register(client, "student", 23)
    s_chef, u2, _ = register(client, "student", 24)
    client.patch(f"/api/users/{u1['id']}", headers=s_react, json={"profile": {"headline": "Frontend developer", "skills": ["React", "JavaScript"], "bio": "I build web UIs with React"}})
    client.patch(f"/api/users/{u2['id']}", headers=s_chef, json={"profile": {"headline": "Professional chef", "skills": ["Cooking", "Menu planning"], "bio": "Restaurant kitchen"}})
    job = client.post("/api/jobs", headers=rh, json=LEGIT).json()

    recs = client.get("/api/ai/recommendations", headers=s_react).json()
    assert any(j["id"] == job["id"] and j["match"]["semantic"] is not None for j in recs["jobs"])

    ranked = client.get(f"/api/ml/candidates/{job['id']}", headers=rh).json()["candidates"]
    pos = {c["id"]: i for i, c in enumerate(ranked)}
    assert pos[u1["id"]] < pos[u2["id"]]                       # the React developer outranks the chef
    assert client.get(f"/api/ml/candidates/{job['id']}", headers=s_react).status_code == 403
    rh2, _, _ = register(client, "recruiter", 24)
    assert client.get(f"/api/ml/candidates/{job['id']}", headers=rh2).status_code == 404  # not their job


def test_model_cards_admin_only(client):
    sh, _, _ = register(client, "student", 25)
    assert client.get("/api/ml/models", headers=sh).status_code == 403
    ah = make_admin(client, RUN + "ml2")
    cards = client.get("/api/ml/models", headers=ah).json()
    assert cards["available"]["resume_classifier"] and cards["fakejob"]["random_forest"]["roc_auc"] > 0.9
