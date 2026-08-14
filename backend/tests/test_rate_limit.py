import unittest

from app.rate_limit import LoginRateLimiter


class LoginRateLimiterTests(unittest.IsolatedAsyncioTestCase):
    async def test_blocks_after_configured_number_of_failures(self):
        limiter = LoginRateLimiter(max_attempts=2, window_seconds=60)

        self.assertFalse(await limiter.is_blocked("client"))
        await limiter.record_failure("client")
        self.assertFalse(await limiter.is_blocked("client"))
        await limiter.record_failure("client")
        self.assertTrue(await limiter.is_blocked("client"))

    async def test_clear_removes_failures(self):
        limiter = LoginRateLimiter(max_attempts=1, window_seconds=60)
        await limiter.record_failure("client")

        await limiter.clear("client")

        self.assertFalse(await limiter.is_blocked("client"))
