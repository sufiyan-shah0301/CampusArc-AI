"""TOTP multi-factor authentication and privacy rights (export / erase)."""
import time

import pyotp
import pytest

from app.db import col
from tests.helpers import make_admin
from tests.test_api import client, register, RUN, PW  # noqa: F401

LOGIN = lambda c, email, pw=PW: c.post("/api/auth/login", json={"email": email, "password": pw})


def enable_mfa(c, h):
    setup = c.post("/api/security/mfa/setup", headers=h, json={"password": PW})
    assert setup.status_code == 200, setup.text
    totp = pyotp.TOTP(setup.json()["secret"])
    res = c.post("/api/security/mfa/enable", headers=h, json={"code": totp.now()})
    assert res.status_code == 200, res.text
    return totp, res.json()["recoveryCodes"]


def test_mfa_full_flow(client):
    h, user, _ = register(client, "student", 51)
    assert client.post("/api/security/mfa/setup", headers=h, json={"password": "wrong-password"}).status_code == 403
    setup = client.post("/api/security/mfa/setup", headers=h, json={"password": PW}).json()
    assert setup["qr"].startswith("data:image/png;base64,") and setup["otpauthUri"].startswith("otpauth://totp/")
    totp = pyotp.TOTP(setup["secret"])
    assert client.post("/api/security/mfa/enable", headers=h, json={"code": "000000"}).status_code == 400
    enabled = client.post("/api/security/mfa/enable", headers=h, json={"code": totp.now()}).json()
    assert enabled["enabled"] and len(enabled["recoveryCodes"]) == 8
    codes = enabled["recoveryCodes"]

    # the secret is stored encrypted and never exposed
    raw = client.portal.call(lambda: col("users").find_one({"email": user["email"]}))
    assert setup["secret"] not in str(raw["mfa"]) and raw["mfa"]["secret"].startswith("gAAAA")
    me = client.get("/api/auth/me", headers=h).json()
    assert me["mfaEnabled"] is True and "mfa" not in me and "secret" not in str(me)

    # login now needs the second factor
    step1 = LOGIN(client, user["email"]).json()
    assert step1["mfaRequired"] is True and "accessToken" not in step1
    ticket = step1["mfaToken"]
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {ticket}"}).status_code == 401       # ticket is not an access token
    assert client.post("/api/auth/mfa/verify", json={"mfaToken": ticket, "code": "123456"}).status_code == 401
    code = totp.at(time.time() + 30)                                                                         # next 30 s window (+-1 step accepted)
    ok = client.post("/api/auth/mfa/verify", json={"mfaToken": ticket, "code": code})
    assert ok.status_code == 200 and ok.json()["user"]["mfaEnabled"] is True
    assert client.post("/api/auth/mfa/verify", json={"mfaToken": ticket, "code": code}).status_code == 401   # replay of a used code

    # recovery codes work once
    t2 = LOGIN(client, user["email"]).json()["mfaToken"]
    assert client.post("/api/auth/mfa/verify", json={"mfaToken": t2, "code": codes[0]}).status_code == 200
    t3 = LOGIN(client, user["email"]).json()["mfaToken"]
    assert client.post("/api/auth/mfa/verify", json={"mfaToken": t3, "code": codes[0]}).status_code == 401
    assert client.get("/api/security/status", headers=h).json()["recoveryCodesLeft"] == 7

    # disabling needs password AND a valid code
    assert client.post("/api/security/mfa/disable", headers=h, json={"password": "nope", "code": codes[1]}).status_code == 403
    assert client.post("/api/security/mfa/disable", headers=h, json={"password": PW, "code": "000000"}).status_code == 400
    assert client.post("/api/security/mfa/disable", headers=h, json={"password": PW, "code": codes[1]}).status_code == 200
    assert "accessToken" in LOGIN(client, user["email"]).json()


def test_mfa_lockout_after_repeated_wrong_codes(client):
    h, user, _ = register(client, "student", 52)
    enable_mfa(client, h)
    ticket = LOGIN(client, user["email"]).json()["mfaToken"]
    for _ in range(5):
        assert client.post("/api/auth/mfa/verify", json={"mfaToken": ticket, "code": "111111"}).status_code == 401
    assert client.post("/api/auth/mfa/verify", json={"mfaToken": ticket, "code": "111111"}).status_code == 429


def test_privacy_export_and_erasure(client):
    rh, _, _ = register(client, "recruiter", 53)
    h, user, _ = register(client, "student", 53)
    ah = make_admin(client, RUN + "priv")
    from tests.test_ml import LEGIT
    job = client.post("/api/jobs", headers=rh, json=LEGIT).json()
    client.post("/api/applications", headers=h, json={"jobId": job["id"]})
    chat = client.post("/api/chats/start", headers=rh, json={"userId": user["id"]}).json()
    client.post(f"/api/chats/{chat['id']}/messages", headers=h, json={"text": "hello recruiter"})

    export = client.get("/api/security/privacy/export", headers=h)
    assert export.status_code == 200 and "attachment" in export.headers["content-disposition"]
    data = export.json()
    assert data["account"]["email"] == user["email"] and len(data["applications"]) == 1 and data["messagesSent"][0]["text"] == "hello recruiter"
    assert "passwordHash" not in export.text and "mfa" not in data["account"]
    assert client.get("/api/security/privacy/export").status_code == 401

    assert client.request("DELETE", "/api/security/privacy/account", headers=h, json={"password": "wrong"}).status_code == 403
    assert client.request("DELETE", "/api/security/privacy/account", headers=h, json={"password": PW}).json() == {"deleted": True}
    assert LOGIN(client, user["email"]).status_code == 401
    assert client.get("/api/auth/me", headers=h).status_code == 401
    assert client.get(f"/api/applications?jobId={job['id']}", headers=rh).json() == []                      # their applications are gone
    assert client.get("/api/chats", headers=rh).json() == []                                                  # and their chats


def test_only_admin_cannot_delete_themselves(client):
    # make sure exactly one active admin exists for this check by using the deletion guard directly
    ah = make_admin(client, RUN + "solo")
    others = client.portal.call(lambda: col("users").count_documents({"role": "admin", "isActive": True}))
    r = client.request("DELETE", "/api/security/privacy/account", headers=ah, json={"password": PW})
    assert r.status_code == (409 if others <= 1 else 200)
