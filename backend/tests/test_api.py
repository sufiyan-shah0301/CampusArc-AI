"""End-to-end API tests. They run against the database configured in .env using throw-away accounts
(e-mails starting with 'pytest-') and delete everything they created afterwards."""
import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.db import col
from app.main import app
from app.routers import auth as auth_router
from app.security import hash_password

RUN = uuid.uuid4().hex[:8]
PW = "Sup3r-secret!"


@pytest.fixture(scope="module")
def client():
    auth_router.limiter.enabled = False  # tests register many users from one IP
    with TestClient(app) as c:
        yield c
        loop = asyncio.new_event_loop()

        async def cleanup():
            ids = [str(u["_id"]) async for u in col("users").find({"email": {"$regex": f"^pytest-{RUN}"}})]
            await col("users").delete_many({"email": {"$regex": f"^pytest-{RUN}"}})
            for name, field in [("jobs", "recruiterId"), ("applications", "studentId"), ("enrollments", "studentId"),
                                ("appointments", "studentId"), ("booths", "companyId"), ("jobFairs", "organizerId"),
                                ("qna_sessions", "recruiterId"), ("chats", "participants"), ("resume_analyses", "userId"), ("interview_sessions", "userId"),
                                ("notifications", "userId"), ("integrity_flags", "userId"), ("integrity_flags", "otherUserId"), ("media_reports", "userId"),
                                ("chats_messages", "senderId")]:
                await col(name).delete_many({field: {"$in": ids}})
            await col("courses").delete_many({"title": f"pytest-{RUN}"})
            await col("courses_lessons").delete_many({"title": f"pytest-{RUN}"})
            await col("contact_messages").delete_many({"name": f"pytest-{RUN}"})

        # the pymongo async client is bound to the app's loop; run cleanup through the app's own portal
        c.portal.call(cleanup)
        loop.close()


def register(c, role, n):
    r = c.post("/api/auth/register", json={"displayName": f"T {role} {n}", "email": f"pytest-{RUN}-{role}{n}@test.dev", "password": PW, "role": role})
    assert r.status_code == 201, r.text
    j = r.json()
    return {"Authorization": f"Bearer {j['accessToken']}"}, j["user"], j


def test_auth_rules(client):
    assert client.post("/api/auth/register", json={"displayName": "X Y", "email": f"pytest-{RUN}-adm@test.dev", "password": PW, "role": "admin"}).status_code == 422
    h, u, tokens = register(client, "student", 1)
    assert u["role"] == "student" and "passwordHash" not in u
    assert client.post("/api/auth/register", json={"displayName": "X Y", "email": f"pytest-{RUN}-student1@test.dev", "password": PW}).status_code == 409
    assert client.post("/api/auth/login", json={"email": f"pytest-{RUN}-student1@test.dev", "password": "wrong-password"}).status_code == 401
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers=h).json()["uid"] == u["id"]
    assert client.post("/api/auth/refresh", json={"refreshToken": tokens["accessToken"]}).status_code == 401  # wrong token type
    assert client.post("/api/auth/refresh", json={"refreshToken": tokens["refreshToken"]}).status_code == 200


def test_cannot_escalate_privileges(client):
    h, u, _ = register(client, "student", 2)
    assert client.patch(f"/api/users/{u['id']}", headers=h, json={"role": "admin"}).status_code == 403
    assert client.patch(f"/api/users/{u['id']}", headers=h, json={"isActive": True}).status_code == 403
    assert client.get("/api/users", headers=h).status_code == 403
    assert client.post("/api/courses", headers=h, json={"title": "x"}).status_code == 403
    assert client.get("/api/contact_messages", headers=h).status_code == 403
    assert client.get("/api/users?passwordHash=x", headers=h).status_code in (403, 422)
    ok = client.patch(f"/api/users/{u['id']}", headers=h, json={"displayName": "New Name", "profile": {"skills": ["python"]}})
    assert ok.status_code == 200 and ok.json()["profile"]["skills"] == ["python"]
    assert "passwordHash" not in ok.json()


def test_jobs_and_applications_flow(client):
    rh, rec, _ = register(client, "recruiter", 1)
    sh, stu, _ = register(client, "student", 3)
    client.patch(f"/api/users/{stu['id']}", headers=sh, json={"profile": {"skills": ["React", "JS"]}})

    assert client.post("/api/jobs", headers=sh, json={"jobTitle": "x"}).status_code == 403
    r = client.post("/api/jobs", headers=rh, json={"jobTitle": "Dev", "companyName": "Acme", "location": "Pune",
                                                  "jobType": "Internship", "skills": ["react", "javascript", "sql"],
                                                  "description": "Build and maintain React components for our customer dashboard, write unit tests and take part in code reviews with the team. Hybrid role in Pune.", "recruiterId": "spoofed"})
    assert r.status_code == 201
    job = r.json()
    assert job["recruiterId"] == rec["id"] and job["isOpen"] is True  # server-controlled field

    assert len(client.get("/api/jobs?isOpen=true", headers=sh).json()) >= 1
    # student applies; match score is computed on the server, duplicates are rejected
    a = client.post("/api/applications", headers=sh, json={"jobId": job["id"], "studentId": "spoofed", "status": "Hired"})
    assert a.status_code == 201
    app_doc = a.json()
    assert app_doc["studentId"] == stu["id"] and app_doc["status"] == "Applied" and app_doc["matchScore"] == 67
    assert client.post("/api/applications", headers=sh, json={"jobId": job["id"]}).status_code == 409

    # visibility: the owning recruiter sees it, the student can't change status, another recruiter sees nothing
    assert len(client.get(f"/api/applications?jobId={job['id']}", headers=rh).json()) == 1
    assert client.patch(f"/api/applications/{app_doc['id']}", headers=sh, json={"status": "Hired"}).status_code == 403
    assert client.patch(f"/api/applications/{app_doc['id']}", headers=rh, json={"status": "Interviewing"}).status_code == 200
    assert client.patch(f"/api/applications/{app_doc['id']}", headers=rh, json={"status": "Bogus"}).status_code == 422
    rh2, _, _ = register(client, "recruiter", 2)
    assert client.get(f"/api/applications?jobId={job['id']}", headers=rh2).json() == []
    assert client.patch(f"/api/jobs/{job['id']}", headers=rh2, json={"jobTitle": "hacked"}).status_code == 403
    assert client.delete(f"/api/jobs/{job['id']}", headers=rh2).status_code == 403

    # status/isOpen stay in sync and closed jobs reject applications
    assert client.patch(f"/api/jobs/{job['id']}", headers=rh, json={"status": "closed"}).json()["isOpen"] is False
    sh2, _, _ = register(client, "student", 4)
    assert client.post("/api/applications", headers=sh2, json={"jobId": job["id"]}).status_code == 409
    jobs = client.get("/api/recruiter/jobs", headers=rh).json()
    assert jobs[0]["applicantCount"] == 1


def test_courses_and_enrollment(client):
    from tests.helpers import make_admin
    ah = make_admin(client, RUN)
    c = client.post("/api/courses", headers=ah, json={"title": f"pytest-{RUN}", "shortDescription": "s", "longDescription": "l", "tags": ["a"]})
    assert c.status_code == 201
    cid = c.json()["id"]
    lesson = client.post(f"/api/courses/{cid}/lessons", headers=ah, json={"title": f"pytest-{RUN}", "contentURL": "https://youtu.be/dQw4w9WgXcQ"}).json()

    sh, _, _ = register(client, "student", 5)
    assert client.post(f"/api/courses/{cid}/lessons", headers=sh, json={"title": "x", "contentURL": "y"}).status_code == 403
    assert len(client.get(f"/api/courses/{cid}/lessons", headers=sh).json()) == 1
    e = client.post("/api/enrollments", headers=sh, json={"courseId": cid})
    assert e.status_code == 201 and e.json()["courseTitle"] == f"pytest-{RUN}"
    assert client.post("/api/enrollments", headers=sh, json={"courseId": cid}).status_code == 409
    eid = e.json()["id"]
    bad = client.patch(f"/api/enrollments/{eid}", headers=sh, json={"$ops": {"addToSet": {"completedLessons": "64b0b0b0b0b0b0b0b0b0b0b0"}}})
    assert bad.status_code == 422
    ok = client.patch(f"/api/enrollments/{eid}", headers=sh, json={"$ops": {"addToSet": {"completedLessons": lesson["id"]}}})
    assert ok.status_code == 200 and ok.json()["completedLessons"] == [lesson["id"]]
    assert client.patch(f"/api/enrollments/{eid}", headers=sh, json={"studentId": "x"}).status_code == 403
    assert client.get("/api/admin/stats", headers=sh).status_code == 403
    assert client.get("/api/admin/stats", headers=ah).json()["courses"] >= 1


def test_chat_privacy(client):
    h1, u1, _ = register(client, "student", 6)
    h2, u2, _ = register(client, "recruiter", 3)
    h3, _, _ = register(client, "student", 7)
    chat = client.post("/api/chats/start", headers=h2, json={"userId": u1["id"]}).json()
    assert client.post("/api/chats/start", headers=h1, json={"userId": u2["id"]}).json()["id"] == chat["id"]  # same chat
    m = client.post(f"/api/chats/{chat['id']}/messages", headers=h1, json={"text": "hello"})
    assert m.status_code == 201 and m.json()["senderId"] == u1["id"]
    assert len(client.get(f"/api/chats/{chat['id']}/messages", headers=h2).json()) == 1
    assert client.get(f"/api/chats/{chat['id']}/messages", headers=h3).status_code == 403
    assert client.post(f"/api/chats/{chat['id']}/messages", headers=h3, json={"text": "intruder"}).status_code == 403
    assert client.get(f"/api/chats/{chat['id']}", headers=h3).status_code == 403
    assert client.get("/api/chats", headers=h3).json() == []
    assert client.get("/api/chats", headers=h1).json()[0]["lastMessage"]["text"] == "hello"


def test_booking_is_atomic(client):
    rh, rec, _ = register(client, "recruiter", 4)
    s1, _, _ = register(client, "student", 8)
    s2, _, _ = register(client, "student", 9)
    start = datetime.now(timezone.utc) + timedelta(days=1)
    fair = client.post("/api/jobFairs", headers=rh, json={"title": "Fair", "description": "d", "startDate": start.isoformat(), "endDate": (start + timedelta(hours=3)).isoformat()}).json()
    booth = client.post(f"/api/jobFairs/{fair['id']}/join", headers=rh).json()
    assert client.post(f"/api/jobFairs/{fair['id']}/join", headers=rh).status_code == 409
    slot = (start + timedelta(hours=1)).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    assert client.patch(f"/api/booths/{booth['id']}", headers=rh, json={"$ops": {"addToSet": {"availableSlots": slot}}}).status_code == 200
    assert client.patch(f"/api/booths/{booth['id']}", headers=s1, json={"$ops": {"addToSet": {"availableSlots": slot}}}).status_code == 403
    first = client.post("/api/appointments/book", headers=s1, json={"boothId": booth["id"], "slot": slot})
    second = client.post("/api/appointments/book", headers=s2, json={"boothId": booth["id"], "slot": slot})
    assert first.status_code == 201 and second.status_code == 409
    assert len(client.get("/api/appointments", headers=rh).json()) == 1
    assert client.get("/api/appointments", headers=s2).json() == []


def test_qna_visibility(client):
    rh, _, _ = register(client, "recruiter", 5)
    sh, _, _ = register(client, "student", 10)
    when = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    s = client.post("/api/qna_sessions", headers=rh, json={"topic": "Hiring", "scheduledTime": when}).json()
    assert client.post(f"/api/qna_sessions/{s['id']}/questions", headers=sh, json={"text": "early?"}).status_code == 409  # not live
    client.patch(f"/api/qna_sessions/{s['id']}", headers=rh, json={"status": "live"})
    q = client.post(f"/api/qna_sessions/{s['id']}/questions", headers=sh, json={"text": "Do you hire freshers?"}).json()
    assert client.patch(f"/api/qna_sessions/{s['id']}/questions/{q['id']}", headers=sh, json={"isAnswered": True}).status_code == 403
    client.patch(f"/api/qna_sessions/{s['id']}/questions/{q['id']}", headers=rh, json={"answerText": "Yes", "isAnswered": True})
    assert client.get(f"/api/qna_sessions/{s['id']}/questions", headers=sh).json()[0]["answerText"] == "Yes"
    assert client.patch(f"/api/qna_sessions/{s['id']}", headers=sh, json={"status": "ended"}).status_code == 403


def test_contact_and_password_reset(client):
    r = client.post("/api/contact", json={"name": f"pytest-{RUN}", "email": "a@b.co", "message": "hi"})
    assert r.status_code == 201
    assert client.post("/api/auth/forgot-password", json={"email": "nobody-here@test.dev"}).status_code == 200  # no enumeration
