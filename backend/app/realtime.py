from collections import defaultdict

from fastapi import WebSocket


class RealtimeHub:
    def __init__(self) -> None:
        self._connections: dict[int, set[WebSocket]] = defaultdict(set)

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[user_id].add(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        connections = self._connections.get(user_id)
        if connections is None:
            return
        connections.discard(websocket)
        if not connections:
            self._connections.pop(user_id, None)

    async def publish(self, user_id: int, event: dict) -> None:
        stale: list[WebSocket] = []
        for websocket in tuple(self._connections.get(user_id, ())):
            try:
                await websocket.send_json(event)
            except Exception:
                stale.append(websocket)
        for websocket in stale:
            self.disconnect(user_id, websocket)

    async def disconnect_user(self, user_id: int) -> None:
        connections = tuple(self._connections.pop(user_id, ()))
        for websocket in connections:
            await websocket.close(code=1000)


realtime_hub = RealtimeHub()
