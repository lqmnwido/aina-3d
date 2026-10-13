"""Native Qwen streaming adapter for AINA's existing PCM16 WebSocket protocol.

Run inside AINA-Ubuntu. One microphone session owns the single-stream engine.
The receive loop never waits for inference; the worker coalesces audio backlog
and flushes an utterance only once, instead of queuing redundant final decodes.
"""
import asyncio
import os
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect

ROOT = Path(__file__).resolve().parent
RATE = 16000
WINDOW = float(os.getenv('AINA_ASR_WINDOW', '.6'))
SILENCE = float(os.getenv('AINA_VAD_SILENCE', '.4'))
THRESHOLD = float(os.getenv('AINA_VAD_THRESHOLD', '.009'))
app = FastAPI()
model = None
ready = False
engine_lock = threading.Lock()
session_active = False


@dataclass
class Utterance:
    identity: str = field(default_factory=lambda: uuid.uuid4().hex)
    pending: list = field(default_factory=list)
    changed: asyncio.Event = field(default_factory=asyncio.Event)
    finished: bool = False
    cancelled: bool = False
    samples: int = 0
    silence: float = 0


def run_engine(function, *args, **kwargs):
    with engine_lock:
        return function(*args, **kwargs)


@app.get('/health')
def health():
    return {'ready': ready, 'model': 'Qwen3-ASR-0.6B', 'device': 'cuda:0',
            'on_gpu': True, 'mode': 'vllm-native-streaming',
            'window_seconds': WINDOW, 'endpoint_seconds': SILENCE}


@app.post('/transcribe')
async def transcribe_file(req: Request):
    raw = await req.body()
    if not ready or session_active:
        raise HTTPException(503, 'Recognizer loading or microphone session active')
    if len(raw) % 2 or not 1600 <= len(raw) <= RATE * 30 * 2:
        raise HTTPException(400, 'Expected mono PCM16, 50 ms–30 seconds')
    audio = np.frombuffer(raw, dtype='<i2').astype(np.float32) / 32768
    start = time.perf_counter()
    results = await asyncio.to_thread(run_engine, model.transcribe, (audio, RATE), language='Malay')
    return {'text': results[0].text.strip(), 'seconds': time.perf_counter() - start}


@app.websocket('/ws/asr')
async def stream(ws: WebSocket):
    global session_active
    await ws.accept()
    if not ready or session_active:
        await ws.send_json({'type': 'error', 'message': 'Pengecam sedang sibuk. Cuba sambung semula.'})
        await ws.close(code=1013)
        return
    session_active = True
    disconnected = False
    jobs = asyncio.Queue(maxsize=4)
    items = []
    send_lock = asyncio.Lock()

    async def send(event):
        if not disconnected:
            async with send_lock:
                await ws.send_json(event)

    async def decode():
        while True:
            item = await jobs.get()
            if item is None:
                return
            state = model.init_streaming_state(language='Malay', chunk_size_sec=WINDOW,
                                               unfixed_chunk_num=2, unfixed_token_num=5)
            previous = ''
            while not item.cancelled:
                await item.changed.wait()
                item.changed.clear()
                if not item.finished and sum(a.size for a in item.pending) + state.buffer.size < RATE * WINDOW:
                    continue
                pending = item.pending
                item.pending = []
                audio = np.concatenate(pending) if pending else np.zeros(0, np.float32)
                began = time.perf_counter()
                finalizing = item.finished
                if finalizing:
                    # All queued tail audio goes into one final native decode.
                    state.buffer = np.concatenate((state.buffer, audio))
                    state = await asyncio.to_thread(run_engine, model.finish_streaming_transcribe, state)
                else:
                    state = await asyncio.to_thread(run_engine, model.streaming_transcribe, audio, state)
                if item.cancelled:
                    break
                text = state.text.strip()
                if not any(c.isalnum() for c in text):
                    text = ''
                elapsed = time.perf_counter() - began
                if finalizing:
                    await send({'type': 'final', 'text': text, 'id': item.identity, 'seconds': elapsed}
                               if text else {'type': 'no-speech', 'id': item.identity})
                    break
                if text and text != previous:
                    previous = text
                    await send({'type': 'partial', 'text': text, 'id': item.identity, 'seconds': elapsed})
                # Endpoint may have arrived while the GPU decoded a partial.
                if item.finished or item.pending:
                    item.changed.set()
            if item in items:
                items.remove(item)

    worker = asyncio.create_task(decode())
    current = None
    preroll = []
    await send({'type': 'ready'})
    try:
        while True:
            packet = await ws.receive()
            if packet['type'] == 'websocket.disconnect':
                break
            raw = packet.get('bytes', b'')
            if not raw or len(raw) % 2 or len(raw) > 64000:
                continue
            if worker.done():
                await worker  # Surface inference failures rather than silently stall.
            audio = np.frombuffer(raw, dtype='<i2').astype(np.float32) / 32768
            speech = float(np.sqrt(np.mean(audio * audio))) > THRESHOLD
            if current is None:
                if not speech:
                    preroll.append(audio)
                    preroll = preroll[-3:]
                    continue
                if jobs.full():
                    await send({'type': 'error', 'message': 'Audio terlalu cepat untuk GPU. Cuba ayat pendek.'})
                    break
                current = Utterance(pending=preroll)
                current.samples = sum(a.size for a in preroll)
                preroll = []
                items.append(current)
                jobs.put_nowait(current)
                await send({'type': 'speech-start', 'id': current.identity})
            current.pending.append(audio)
            current.samples += audio.size
            current.silence = 0 if speech else current.silence + audio.size / RATE
            if current.silence >= SILENCE or current.samples >= RATE * 18:
                current.finished = True
                await send({'type': 'speech-end', 'id': current.identity})
                current.changed.set()
                current = None
            else:
                current.changed.set()
    except (WebSocketDisconnect, RuntimeError):
        pass
    except Exception as error:
        await send({'type': 'error', 'message': str(error)})
    finally:
        disconnected = True
        for item in items:
            item.cancelled = True
            item.changed.set()
        # Do not allow another client to use the engine until the active decode
        # has actually relinquished it; cancelling to_thread cannot stop CUDA.
        if not worker.done():
            while not jobs.empty():
                jobs.get_nowait()
            jobs.put_nowait(None)
        try:
            await worker
        except Exception:
            pass
        session_active = False
        try:
            await ws.close()
        except (RuntimeError, WebSocketDisconnect):
            pass


if __name__ == '__main__':
    import torch
    import uvicorn
    from qwen_asr import Qwen3ASRModel

    torch.set_num_threads(4)
    model = Qwen3ASRModel.LLM(
        model=str(ROOT / 'models/qwen3-asr-0.6b'), dtype='float16',
        gpu_memory_utilization=float(os.getenv('AINA_ASR_GPU_FRACTION', '.30')),
        max_model_len=1024, max_num_seqs=1, max_num_batched_tokens=1024,
        max_inference_batch_size=1, max_new_tokens=96,
        kv_cache_memory_bytes=128 * 1024 * 1024, swap_space=0,
        skip_mm_profiling=True,
        attention_config={'backend': 'TRITON_ATTN'},
        enforce_eager=True, enable_prefix_caching=True,
        limit_mm_per_prompt={'audio': 1},
    )
    print('Warming native streaming inference...', flush=True)
    warm_audio = np.zeros(RATE, np.float32)
    warm_clip = ROOT / 'generated/greeting-check.wav'
    if warm_clip.exists():
        import soundfile as sf
        from scipy.signal import resample_poly
        warm_audio, warm_rate = sf.read(warm_clip, dtype='float32')
        if warm_audio.ndim > 1:
            warm_audio = warm_audio.mean(axis=1)
        warm_audio = resample_poly(warm_audio[:warm_rate * 5], RATE, warm_rate)
    warm_state = model.init_streaming_state(language='Malay', chunk_size_sec=WINDOW)
    model.streaming_transcribe(warm_audio, warm_state)
    model.finish_streaming_transcribe(warm_state)
    ready = True
    print('LOCAL_VLLM_ASR_READY', flush=True)
    uvicorn.run(app, host='127.0.0.1', port=int(os.getenv('AINA_ASR_PORT', '8767')), access_log=False)
