import unittest

from app.realtime import RealtimeHub


class FakeWebSocket:
    def __init__(self, fail_send=False):
        self.accepted = False
        self.closed_with = None
        self.events = []
        self.fail_send = fail_send

    async def accept(self):
        self.accepted = True

    async def send_json(self, event):
        if self.fail_send:
            raise ConnectionError("closed")
        self.events.append(event)

    async def close(self, code):
        self.closed_with = code


class RealtimeHubTests(unittest.IsolatedAsyncioTestCase):
    async def test_publishes_to_connected_user_only(self):
        hub = RealtimeHub()
        first = FakeWebSocket()
        second = FakeWebSocket()
        await hub.connect(1, first)
        await hub.connect(2, second)

        await hub.publish(1, {"type": "note_updated"})

        self.assertTrue(first.accepted)
        self.assertEqual(first.events, [{"type": "note_updated"}])
        self.assertEqual(second.events, [])

    async def test_removes_stale_connection(self):
        hub = RealtimeHub()
        stale = FakeWebSocket(fail_send=True)
        await hub.connect(1, stale)

        await hub.publish(1, {"type": "note_updated"})

        self.assertNotIn(1, hub._connections)

    async def test_disconnect_user_closes_all_connections(self):
        hub = RealtimeHub()
        websocket = FakeWebSocket()
        await hub.connect(1, websocket)

        await hub.disconnect_user(1)

        self.assertEqual(websocket.closed_with, 1000)
