import asyncio
import logging
import time

from redis.asyncio import Redis


logger = logging.getLogger(__name__)


class LoginRateLimiter:
    def __init__(self, max_attempts: int, window_seconds: int) -> None:
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._redis: Redis | None = None
        self._local_attempts: dict[str, list[float]] = {}
        self._local_lock = asyncio.Lock()

    async def start(self, redis_url: str | None) -> None:
        if not redis_url:
            logger.warning("REDIS_URL is not set; login limits are local only")
            return
        self._redis = Redis.from_url(redis_url, decode_responses=True)
        await self._redis.ping()

    async def stop(self) -> None:
        if self._redis is not None:
            await self._redis.aclose()
            self._redis = None

    async def is_blocked(self, client_id: str) -> bool:
        if self._redis is not None:
            attempts = await self._redis.get(self._key(client_id))
            return attempts is not None and int(attempts) >= self.max_attempts
        return len(await self._recent_local(client_id)) >= self.max_attempts

    async def record_failure(self, client_id: str) -> None:
        if self._redis is not None:
            key = self._key(client_id)
            attempts = await self._redis.incr(key)
            if attempts == 1:
                await self._redis.expire(key, self.window_seconds)
            return
        async with self._local_lock:
            recent = self._recent_local_unlocked(client_id)
            self._local_attempts[client_id] = [*recent, time.monotonic()]

    async def clear(self, client_id: str) -> None:
        if self._redis is not None:
            await self._redis.delete(self._key(client_id))
            return
        async with self._local_lock:
            self._local_attempts.pop(client_id, None)

    async def _recent_local(self, client_id: str) -> list[float]:
        async with self._local_lock:
            recent = self._recent_local_unlocked(client_id)
            if recent:
                self._local_attempts[client_id] = recent
            else:
                self._local_attempts.pop(client_id, None)
            return recent

    def _recent_local_unlocked(self, client_id: str) -> list[float]:
        now = time.monotonic()
        return [
            attempt
            for attempt in self._local_attempts.get(client_id, [])
            if now - attempt < self.window_seconds
        ]

    @staticmethod
    def _key(client_id: str) -> str:
        return f"cloud-notes:login-attempts:{client_id}"


login_rate_limiter = LoginRateLimiter(max_attempts=5, window_seconds=60)
