import unittest

from app.utils import create_access_token, decode_access_token


class TokenTests(unittest.TestCase):
    def test_round_trip(self):
        self.assertEqual(decode_access_token(create_access_token(42)), 42)

    def test_rejects_invalid_token(self):
        self.assertIsNone(decode_access_token("not-a-token"))
