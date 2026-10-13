"""Adapter regression tests; fake engine, not a GPU speed/accuracy test."""
import importlib.util
import sys
import time
import unittest
from pathlib import Path
from types import SimpleNamespace

import numpy as np
from fastapi.testclient import TestClient

spec = importlib.util.spec_from_file_location('aina_vllm', Path(__file__).with_name('asr_vllm_server.py'))
server = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = server
spec.loader.exec_module(server)


class FakeEngine:
    def __init__(self):
        self.finals = 0
        self.partial_started = False

    def init_streaming_state(self, **options):
        return SimpleNamespace(buffer=np.zeros(0, np.float32), text='', **options)

    def streaming_transcribe(self, audio, state):
        self.partial_started = True
        time.sleep(.03)
        state.buffer = np.zeros(0, np.float32)
        state.text = 'Hai'
        return state

    def finish_streaming_transcribe(self, state):
        self.finals += 1
        state.text = 'Hai, saya Aina.'
        return state


class ProtocolTests(unittest.TestCase):
    def setUp(self):
        server.model = FakeEngine()
        server.ready = True
        server.session_active = False
        self.client = TestClient(server.app)

    def test_partial_then_final_uses_one_id(self):
        with self.client.websocket_connect('/ws/asr') as ws:
            self.assertEqual(ws.receive_json()['type'], 'ready')
            for _ in range(6):
                ws.send_bytes(np.full(1600, 12000, '<i2').tobytes())
            start = ws.receive_json()
            partial = ws.receive_json()
            self.assertEqual(partial['type'], 'partial')
            self.assertEqual(partial['id'], start['id'])
            for _ in range(5):
                ws.send_bytes(bytes(3200))
            self.assertEqual(ws.receive_json()['type'], 'speech-end')
            final = ws.receive_json()
            self.assertEqual(final['type'], 'final')
            self.assertEqual(final['id'], start['id'])
            self.assertEqual(final['text'], 'Hai, saya Aina.')
            self.assertEqual(server.model.finals, 1)
        self.assertFalse(server.session_active)

    def test_end_during_partial_still_flushes_final(self):
        with self.client.websocket_connect('/ws/asr') as ws:
            ws.receive_json()
            for _ in range(6):
                ws.send_bytes(np.full(1600, 12000, '<i2').tobytes())
            self.assertEqual(ws.receive_json()['type'], 'speech-start')
            for _ in range(100):
                if server.model.partial_started:
                    break
                time.sleep(.002)
            for _ in range(5):
                ws.send_bytes(bytes(3200))
            events = []
            while not events or events[-1]['type'] != 'final':
                events.append(ws.receive_json())
            self.assertIn('speech-end', [e['type'] for e in events])
            self.assertEqual(server.model.finals, 1)

    def test_busy_session_does_not_steal_gpu(self):
        server.session_active = True
        with self.client.websocket_connect('/ws/asr') as ws:
            self.assertEqual(ws.receive_json()['type'], 'error')
        self.assertTrue(server.session_active)


if __name__ == '__main__':
    unittest.main()
