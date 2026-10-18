from pymongo import ASCENDING, DESCENDING, AsyncMongoClient

from .config import get_settings

_client: AsyncMongoClient | None = None
_db = None


async def init_db() -> None:
    global _client, _db
    s = get_settings()
    _client = AsyncMongoClient(s.mongodb_uri, tz_aware=True)
    _db = _client[s.mongodb_db]
    await _db.users.create_index("email", unique=True)
    await _db.applications.create_index([("jobId", ASCENDING), ("studentId", ASCENDING)], unique=True)
    await _db.applications.create_index("recruiterId")
    await _db.enrollments.create_index([("studentId", ASCENDING), ("courseId", ASCENDING)], unique=True)
    await _db.jobs.create_index("recruiterId")
    await _db.chats.create_index("participants")
    await _db.chats_messages.create_index([("parentId", ASCENDING), ("createdAt", ASCENDING)])
    await _db.courses_lessons.create_index([("parentId", ASCENDING), ("createdAt", ASCENDING)])
    await _db.qna_sessions_questions.create_index([("parentId", ASCENDING), ("askedAt", ASCENDING)])
    await _db.booths.create_index("jobFairId")
    await _db.appointments.create_index("studentId")
    await _db.appointments.create_index("companyId")
    await _db.interview_sessions.create_index([("userId", ASCENDING), ("createdAt", DESCENDING)])
    await _db.notifications.create_index("createdAt", expireAfterSeconds=90 * 86400)      # privacy: notifications live 90 days
    await _db.notifications.create_index("userId")
    await _db.media_reports.create_index("expireAt", expireAfterSeconds=0)               # saved verification reports auto-expire
    await _db.media_reports.create_index("userId")
    await _db.resume_analyses.create_index([("userId", ASCENDING), ("createdAt", DESCENDING)])


async def close_db() -> None:
    if _client:
        await _client.close()


def col(name: str):
    return _db[name]
