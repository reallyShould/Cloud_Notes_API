import asyncio
import json
import logging
from collections import defaultdict

from fastapi import WebSocket
from redis.asyncio import Redis


logger = logging.getLogger(__name__)
CHANNEL = "cloud-notes:events"


class RealtimeHub:
    def __init__(self) -> None:
        self._connections: dict[int, set[WebSocket]] = defaultdict(set)
        self._redis: Redis | None = None
        self._listener: asyncio.Task | None = None

    async def start(self, redis_url: str | None) -> None:
        if not redis_url:
            logger.warning("REDIS_URL is not set; realtime events are local only")
            return
        self._redis = Redis.from_url(redis_url, decode_responses=True)
        await self._redis.ping()
        pubsub = self._redis.pubsub()
        await pubsub.subscribe(CHANNEL)
        self._listener = asyncio.create_task(self._listen(pubsub))

    async def stop(self) -> None:
        if self._listener is not None:
            self._listener.cancel()
            try:
                await self._listener
            except asyncio.CancelledError:
                pass
            self._listener = None
        if self._redis is not None:
            await self._redis.aclose()
            self._redis = None

    async def _listen(self, pubsub) -> None:
        try:
            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                try:
                    envelope = json.loads(message["data"])
                    await self._publish_local(
                        int(envelope["user_id"]),
                        envelope["event"],
                    )
                except (KeyError, TypeError, ValueError, json.JSONDecodeError):
                    logger.warning("Ignored an invalid realtime event")
        finally:
            await pubsub.aclose()

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
        if self._redis is not None:
            await self._redis.publish(
                CHANNEL,
                json.dumps({"user_id": user_id, "event": event}),
            )
            return
        await self._publish_local(user_id, event)

    async def _publish_local(self, user_id: int, event: dict) -> None:
        stale: list[WebSocket] = []
        for websocket in tuple(self._connections.get(user_id, ())):
            try:
                await websocket.send_json(event)
            except Exception:
                logger.debug("Removing a disconnected realtime client")
                stale.append(websocket)
        for websocket in stale:
            self.disconnect(user_id, websocket)

    async def disconnect_user(self, user_id: int) -> None:
        connections = tuple(self._connections.pop(user_id, ()))
        for websocket in connections:
            await websocket.close(code=1000)


realtime_hub = RealtimeHub()
