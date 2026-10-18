import re

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..db import col
from ..deps import uid, user_from_token
from ..hub import hub
from ..serialize import oid

router = APIRouter()
ROOM_RE = re.compile(r"^[A-Za-z_]+(/[0-9a-f]{24}(/[A-Za-z_]+)?)?$")


async def room_allowed(user: dict, room: str) -> bool:
    if not ROOM_RE.match(room):
        return False
    parts = room.split("/")
    if parts[0] == "chats" and len(parts) > 1:
        chat = await col("chats").find_one({"_id": oid(parts[1])})
        return bool(chat) and uid(user) in chat["participants"]
    return True


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    # the token travels in the first message, never in the URL (URLs end up in logs)
    await ws.accept()
    try:
        first = await ws.receive_json()
        user = await user_from_token(first.get("token") if isinstance(first, dict) else None)
        if not user:
            await ws.close(code=4401)
            return
        await ws.send_json({"event": "ready"})
        while True:
            msg = await ws.receive_json()
            room = msg.get("room", "") if isinstance(msg, dict) else ""
            if msg.get("action") == "subscribe" and await room_allowed(user, room):
                if sum(ws in s for s in hub.rooms.values()) < 50:
                    hub.join(room, ws)
            elif msg.get("action") == "unsubscribe":
                hub.leave(room, ws)
    except (WebSocketDisconnect, ValueError):
        pass
    finally:
        hub.leave_all(ws)
