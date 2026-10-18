"""Notifications: stored in MongoDB, pushed to the browser as a 'changed' event over the WebSocket hub, and (for the
important kinds) also e-mailed when the user has not opted out and SMTP is configured."""
import asyncio

from bson import ObjectId

from . import mailer
from .config import get_settings
from .db import col
from .hub import hub
from .serialize import now

EMAIL_KINDS = {"status", "application", "appointment", "job_review", "message"}


async def _email(user_ids: list[str], kind: str, title: str, body: str, link: str) -> None:
    for user_id in user_ids:
        user = await col("users").find_one({"_id": ObjectId(user_id)}, {"email": 1, "emailNotifications": 1, "isActive": 1})
        if not user or not user.get("isActive", True) or user.get("emailNotifications") is False:
            continue
        url = f"{get_settings().frontend_url}{link}" if link else get_settings().frontend_url
        await mailer.send(user["email"], f"CampusArc: {title}",
                          f"{title}\n\n{body}\n\nOpen it: {url}\n\nYou can turn these e-mails off in Profile -> Security & privacy.")


async def notify(user_ids: list[str] | str, kind: str, title: str, body: str = "", link: str = "", *, collapse: bool = False) -> None:
    """Create a notification for each user. With collapse=True an existing unread one with the same kind+link is
    refreshed instead of adding another (used for chat messages so a busy chat is one notification)."""
    ids = [user_ids] if isinstance(user_ids, str) else list(user_ids)
    emailed = []
    for user_id in ids:
        if collapse:
            res = await col("notifications").update_one(
                {"userId": user_id, "type": kind, "link": link, "read": False},
                {"$set": {"title": title, "body": body, "createdAt": now()}})
            if res.matched_count:
                continue
        await col("notifications").insert_one({"userId": user_id, "type": kind, "title": title, "body": body, "link": link,
                                               "read": False, "createdAt": now()})
        emailed.append(user_id)
    if ids:
        await hub.publish("notifications")
    if emailed and kind in EMAIL_KINDS:
        asyncio.create_task(_email(emailed, kind, title, body, link))


async def admin_ids() -> list[str]:
    return [str(u["_id"]) async for u in col("users").find({"role": "admin", "isActive": True}, {"_id": 1})]
