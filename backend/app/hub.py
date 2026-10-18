"""In-process WebSocket hub. Events carry no data: clients re-fetch through the authorised REST API,
so a subscriber can never receive something they could not read anyway."""
import asyncio
from collections import defaultdict

from fastapi import WebSocket


class Hub:
    def __init__(self) -> None:
        self.rooms: dict[str, set[WebSocket]] = defaultdict(set)

    def join(self, room: str, ws: WebSocket) -> None:
        self.rooms[room].add(ws)

    def leave_all(self, ws: WebSocket) -> None:
        for room in list(self.rooms):
            self.rooms[room].discard(ws)
            if not self.rooms[room]:
                del self.rooms[room]

    def leave(self, room: str, ws: WebSocket) -> None:
        self.rooms.get(room, set()).discard(ws)

    async def publish(self, *rooms: str) -> None:
        async def send(ws: WebSocket, room: str):
            try:
                await ws.send_json({"room": room, "event": "changed"})
            except Exception:
                self.leave_all(ws)

        tasks = [send(ws, r) for r in rooms for ws in list(self.rooms.get(r, ()))]
        if tasks:
            await asyncio.gather(*tasks)


hub = Hub()
