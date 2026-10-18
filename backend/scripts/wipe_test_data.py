"""Developer helper for the configured database. Safe by default: it never touches real accounts.

    python -m scripts.wipe_test_data                              # just print counts
    python -m scripts.wipe_test_data --yes                        # delete only pytest-* test users and their test records
    python -m scripts.wipe_test_data --everything --confirm-db NAME   # empty EVERY collection (NAME must equal the DB name)
"""
import argparse
import asyncio

from app.config import get_settings
from app.db import close_db, col, init_db

# (collection, field holding the owner's user id) - mirrors the cascade the API runs when a user is deleted
USER_OWNED = [
    ("applications", "studentId"), ("applications", "recruiterId"), ("enrollments", "studentId"),
    ("appointments", "studentId"), ("appointments", "recruiterId"), ("jobs", "recruiterId"),
    ("notifications", "userId"), ("interview_sessions", "userId"), ("resume_analyses", "userId"),
]


async def delete_test_data() -> None:
    users = col("users")
    ids = [str(u["_id"]) async for u in users.find({"email": {"$regex": "^pytest-"}}, {"_id": 1})]
    if ids:
        # applications to test jobs by real students would otherwise point at a job that no longer exists
        job_ids = [str(j["_id"]) async for j in col("jobs").find({"recruiterId": {"$in": ids}}, {"_id": 1})]
        if job_ids:
            print(f"  applications to test jobs: removed {(await col('applications').delete_many({'jobId': {'$in': job_ids}})).deleted_count}")
        for name, field in USER_OWNED:
            r = await col(name).delete_many({field: {"$in": ids}})
            if r.deleted_count:
                print(f"  {name}.{field}: removed {r.deleted_count}")
    print(f"  users: removed {(await users.delete_many({'email': {'$regex': '^pytest-'}})).deleted_count}")
    print(f"  contact_messages: removed {(await col('contact_messages').delete_many({'name': {'$regex': '^pytest-'}})).deleted_count}")

async def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--yes", action="store_true", help="delete only pytest-* test data")
    p.add_argument("--everything", action="store_true", help="empty every collection (dangerous)")
    p.add_argument("--confirm-db", help="must equal the database name when using --everything")
    a = p.parse_args()

    await init_db()
    from app import db as dbmod

    db_name = get_settings().mongodb_db
    names = await dbmod._db.list_collection_names()
    print(f"database: {db_name}")
    for n in sorted(names):
        print(f"  {n}: {await col(n).count_documents({})}")

    if a.everything:
        if a.confirm_db != db_name:
            print(f"refusing: pass --confirm-db {db_name} to empty the whole database")
        else:
            for n in names:
                await col(n).delete_many({})
            print("all collections emptied")
    elif a.yes:
        print("removing test data only (real users are kept):")
        await delete_test_data()
    await close_db()


if __name__ == "__main__":
    asyncio.run(main())
