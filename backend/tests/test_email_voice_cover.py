"""E-mail notifications (against a real local SMTP server), voice answers and the cover-letter generator."""
import time

import pytest
from aiosmtpd.controller import Controller

from app.ai import llm
from app.config import get_settings
from ml import speech
from tests.test_api import client, register, RUN  # noqa: F401
from tests.test_ml import LEGIT


class Inbox:
    def __init__(self):
        self.messages = []

    async def handle_DATA(self, server, session, envelope):
        self.messages.append({"to": envelope.rcpt_tos, "data": envelope.content.decode("utf-8", errors="replace")})
        return "250 OK"


@pytest.fixture
def smtp(monkeypatch):
    inbox = Inbox()
    ctl = Controller(inbox, hostname="127.0.0.1", port=8026)
    ctl.start()
    s = get_settings()
    monkeypatch.setattr(s, "smtp_host", "127.0.0.1")
    monkeypatch.setattr(s, "smtp_port", 8026)
    monkeypatch.setattr(s, "smtp_user", "")        # no TLS/auth for the throw-away local server
    monkeypatch.setattr(s, "smtp_from", "noreply@careerbridge.test")
    yield inbox
    ctl.stop()


def wait_for(inbox, n, timeout=6):
    end = time.time() + timeout
    while time.time() < end and len(inbox.messages) < n:
        time.sleep(0.1)
    return inbox.messages


def test_status_change_sends_email_and_respects_opt_out(client, smtp):
    rh, _, _ = register(client, "recruiter", 41)
    sh, stu, _ = register(client, "student", 41)
    sh2, stu2, _ = register(client, "student", 42)
    job = client.post("/api/jobs", headers=rh, json=LEGIT).json()
    client.post("/api/applications", headers=sh, json={"jobId": job["id"]})
    client.post("/api/applications", headers=sh2, json={"jobId": job["id"]})
    baseline = len(wait_for(smtp, 1))                                   # the recruiter's "new application" e-mails
    assert baseline >= 1

    assert client.patch(f"/api/users/{stu2['id']}", headers=sh2, json={"emailNotifications": False}).status_code == 200
    apps = {a["studentId"]: a["id"] for a in client.get(f"/api/applications?jobId={job['id']}", headers=rh).json()}
    client.patch(f"/api/applications/{apps[stu['id']]}", headers=rh, json={"status": "Interviewing"})
    client.patch(f"/api/applications/{apps[stu2['id']]}", headers=rh, json={"status": "Interviewing"})
    msgs = wait_for(smtp, baseline + 1)
    time.sleep(1)
    msgs = smtp.messages[baseline:]
    assert [m for m in msgs if stu["email"] in m["to"][0] and "Interviewing" in m["data"]]       # opted in -> mailed
    assert not [m for m in smtp.messages if stu2["email"] in m["to"][0]]                          # opted out -> silent
    assert client.patch(f"/api/users/{stu['id']}", headers=sh2, json={"emailNotifications": False}).status_code == 403   # not someone else's setting


def test_speech_analysis_is_sensible():
    segs = [{"start": 0.0, "end": 4.0, "avg_logprob": -0.1}, {"start": 7.0, "end": 12.0, "avg_logprob": -0.2}]
    text = "Um so basically I built a chat app with React and, you know, it handled real time messages using web sockets and a database"
    r = speech.analyse(text, segs, 12.0)
    assert r["fillerCount"] >= 3 and "um" in r["fillers"] and r["longPauses"] == 1 and r["longestPause"] == 3.0
    assert 100 < r["wordsPerMinute"] < 200 and r["clarity"] > 80
    fast = speech.analyse("word " * 100, [{"start": 0, "end": 20, "avg_logprob": -0.1}], 20)
    assert fast["pace"] == "fast"


def test_transcribe_endpoint_validation_and_result(client, monkeypatch):
    sh, _, _ = register(client, "student", 43)

    async def fake(filename, data, ctype):
        return {"text": "Um I think keys give items a stable identity", "segments": [{"start": 0, "end": 5, "avg_logprob": -0.2}]}

    monkeypatch.setattr(llm, "transcribe", fake)
    ok = client.post("/api/ai/transcribe", headers=sh, files={"file": ("a.webm", b"x" * 5000, "audio/webm;codecs=opus")}, data={"duration": "5"})
    assert ok.status_code == 200 and ok.json()["speech"]["fillerCount"] == 1
    assert client.post("/api/ai/transcribe", headers=sh, files={"file": ("a.exe", b"x" * 5000, "application/octet-stream")}, data={"duration": "5"}).status_code == 415
    assert client.post("/api/ai/transcribe", headers=sh, files={"file": ("a.webm", b"x" * 10, "audio/webm")}, data={"duration": "5"}).status_code == 422
    assert client.post("/api/ai/transcribe", headers=sh, files={"file": ("a.webm", b"x" * 5000, "audio/webm")}, data={"duration": "999"}).status_code == 422
    assert client.post("/api/ai/transcribe", files={"file": ("a.webm", b"x" * 5000, "audio/webm")}).status_code == 401


def test_cover_letter_uses_real_facts_and_reaches_recruiter(client, monkeypatch):
    rh, _, _ = register(client, "recruiter", 44)
    sh, stu, _ = register(client, "student", 44)
    client.patch(f"/api/users/{stu['id']}", headers=sh, json={"profile.headline": "Aspiring React developer", "profile.skills": ["React", "Git"],
                                                              "profile.academic": {"stream": "Computer Science", "cgpa": 8.1, "internships": 1}})
    job = client.post("/api/jobs", headers=rh, json=LEGIT).json()
    seen = {}

    async def fake_complete(messages, **kw):
        seen["system"], seen["user"] = messages[0]["content"], messages[1]["content"]
        return "Dear Hiring Manager,\nI am excited to apply...\nSam"

    monkeypatch.setattr(llm, "complete", fake_complete)
    r = client.post("/api/ai/cover-letter", headers=sh, json={"jobId": job["id"], "tone": "concise", "notes": "my chat app project"})
    assert r.status_code == 200 and r.json()["letter"].startswith("Dear Hiring Manager")
    assert "Aspiring React developer" in seen["user"] and "CGPA 8.1" in seen["user"] and "my chat app project" in seen["user"] and "React Intern" in seen["user"]
    assert "never invent" in seen["system"].lower() and "concise" in seen["system"]
    assert client.post("/api/ai/cover-letter", headers=rh, json={"jobId": job["id"]}).status_code == 403          # students only
    assert client.post("/api/ai/cover-letter", headers=sh, json={"jobId": job["id"], "tone": "rude"}).status_code == 422

    letter = "Dear Hiring Manager, I would love to join. Regards, Sam"
    assert client.post("/api/applications", headers=sh, json={"jobId": job["id"], "coverLetter": letter}).status_code == 201
    got = client.get(f"/api/applications?jobId={job['id']}", headers=rh).json()
    assert got[0]["coverLetter"] == letter
