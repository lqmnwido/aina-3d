"""Real local recognizer benchmark with prerecorded speech sent at mic speed."""
import argparse
import asyncio
import json
import time
from pathlib import Path

import numpy as np
import soundfile as sf
import websockets
from scipy.signal import resample_poly


async def measure(url, pcm):
    began = time.perf_counter()
    first = end = None
    events = []
    async with websockets.connect(url) as ws:
        ready = json.loads(await ws.recv())
        assert ready['type'] == 'ready', ready
        async def feed():
            for offset in range(0, len(pcm), 3200):
                await ws.send(pcm[offset:offset + 3200])
                await asyncio.sleep(.1)
            for _ in range(12):
                await ws.send(bytes(3200))
                await asyncio.sleep(.1)
        task = asyncio.create_task(feed())
        try:
            while True:
                event = json.loads(await asyncio.wait_for(ws.recv(), max(.1, 30 - (time.perf_counter() - began))))
                elapsed = time.perf_counter() - began
                events.append(event)
                if event['type'] == 'partial':
                    first = elapsed if first is None else first
                if event['type'] == 'speech-end':
                    end = elapsed
                if event['type'] in ('final', 'error', 'no-speech'):
                    assert event['type'] == 'final' and event['text'].strip(), event
                    assert end is not None
                    return {'first_partial_seconds': first, 'endpoint_to_final_seconds': elapsed - end,
                            'total_seconds': elapsed, 'text': event['text'],
                            'partial_count': sum(e['type'] == 'partial' for e in events)}
        finally:
            if not task.done():
                task.cancel()
            await asyncio.gather(task, return_exceptions=True)


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='ws://127.0.0.1:8767/ws/asr')
    parser.add_argument('--audio', default=str(Path(__file__).parent / 'generated/greeting-check.wav'))
    parser.add_argument('--runs', type=int, default=3)
    args = parser.parse_args()
    audio, rate = sf.read(args.audio, dtype='float32')
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    audio = resample_poly(audio, 16000, rate)
    pcm = (np.clip(audio, -1, 1) * 32767).astype('<i2').tobytes()
    for index in range(args.runs):
        result = await measure(args.url, pcm)
        print(json.dumps({'run': index + 1, **result}, ensure_ascii=False), flush=True)
        await asyncio.sleep(.2)


if __name__ == '__main__':
    asyncio.run(main())
