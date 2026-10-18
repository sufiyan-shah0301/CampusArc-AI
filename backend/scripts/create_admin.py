"""Create (or promote) an admin account.

    python -m scripts.create_admin --email admin@example.com --name "Admin" [--password ...]

If --password is omitted you are prompted for it (recommended: it then never lands in shell history).
"""
import argparse
import asyncio
import getpass

from app.db import close_db, col, init_db
from app.security import hash_password
from app.serialize import now


async def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--email", required=True)
    p.add_argument("--name", default="Admin")
    p.add_argument("--password")
    a = p.parse_args()
    password = a.password or getpass.getpass("Password (min 8 chars): ")
    if len(password) < 8:
        raise SystemExit("Password must be at least 8 characters.")
    await init_db()
    email = a.email.lower()
    existing = await col("users").find_one({"email": email})
    if existing:
        await col("users").update_one({"_id": existing["_id"]}, {"$set": {"role": "admin", "passwordHash": hash_password(password), "isActive": True}})
        print(f"Promoted existing user {email} to admin.")
    else:
        await col("users").insert_one({
            "email": email, "passwordHash": hash_password(password), "displayName": a.name, "role": "admin",
            "isActive": True, "emailVerified": True, "createdAt": now(), "lastLoginAt": now(), "isProfileComplete": True,
            "profile": {"headline": "Administrator", "bio": "", "location": "", "linkedinUrl": "", "portfolioUrl": "", "skills": []}})
        print(f"Created admin {email}.")
    await close_db()


if __name__ == "__main__":
    asyncio.run(main())
