import asyncio
from app.db import col
from app.security import hash_password
from app.serialize import now


def make_admin(client, run):
    """Create an admin directly in the DB (self-registration as admin is impossible by design)."""
    email = f"pytest-{run}-admin@test.dev"

    async def mk():
        await col("users").insert_one({"email": email, "passwordHash": hash_password("Sup3r-secret!"), "displayName": "Admin",
                                       "role": "admin", "isActive": True, "createdAt": now(), "profile": {}})

    client.portal.call(mk)
    r = client.post("/api/auth/login", json={"email": email, "password": "Sup3r-secret!"})
    return {"Authorization": f"Bearer {r.json()['accessToken']}"}
