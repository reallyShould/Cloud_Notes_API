import unittest

from fastapi import HTTPException

from app.api.system import health_check


class FailingSession:
    async def execute(self, _query):
        raise ConnectionError("database host and password must stay private")


class HealthCheckTests(unittest.IsolatedAsyncioTestCase):
    async def test_does_not_expose_database_exception(self):
        with self.assertRaises(HTTPException) as raised:
            await health_check(FailingSession())

        self.assertEqual(raised.exception.status_code, 503)
        self.assertEqual(raised.exception.detail, "Database is unavailable")
