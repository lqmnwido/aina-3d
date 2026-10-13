"""Measure whether the existing reply model can stay on GPU with speech."""
import asyncio
import io
import json
import time
import urllib.request
import argparse
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly
from check_streaming_latency import measure


def post(url, data):
    request = urllib.request.Request(url, data=json.dumps(data).encode(), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read()


async def chat(text):
    began = time.perf_counter()
    reply = json.loads(await asyncio.to_thread(post, 'http://127.0.0.1:11434/api/chat', {
        'model': 'qwen3:1.7b', 'think': False, 'stream': False, 'keep_alive': '5m',
        'options': {'num_gpu': 99, 'num_ctx': 1024, 'num_predict': 48},
        'messages': [{'role': 'system', 'content': 'Anda Aina, teman suara yang ceria. Jawab satu ayat pendek dalam Bahasa Melayu Malaysia sahaja.'}, {'role': 'user', 'content': text}]}))
    print('REPLY', time.perf_counter() - began, reply['message']['content'], flush=True)


async def speech():
    began = time.perf_counter()
    wav = await asyncio.to_thread(post, 'http://127.0.0.1:8766/tts', {'text': 'Hai! Saya di sini untuk mendengar cerita awak.'})
    audio, rate = sf.read(io.BytesIO(wav))
    assert np.isfinite(audio).all() and np.max(np.abs(audio)) > .01
    (Path(__file__).parent / 'generated/resident-voice.wav').write_bytes(wav)
    print('TTS', time.perf_counter() - began, 'audio_seconds', len(audio) / rate, flush=True)


async def main():
    parser=argparse.ArgumentParser();parser.add_argument('--url',default='ws://127.0.0.1:8765/ws/asr');args=parser.parse_args()
    await chat('Apakah maksud tenaga solar?')
    await chat('Siapa nama awak?')
    with urllib.request.urlopen('http://127.0.0.1:11434/api/ps') as response:
        ps = json.load(response)
    active = next(model for model in ps['models'] if model['name'] == 'qwen3:1.7b')
    print('MODEL_PLACEMENT', active['size'], active['size_vram'], flush=True)
    assert active['size'] == active['size_vram'], 'Reply model was not fully offloaded to GPU'
    audio, rate = sf.read(Path(__file__).parent / 'generated/greeting-check.wav')
    pcm = (np.clip(resample_poly(audio, 16000, rate), -1, 1) * 32767).astype('<i2').tobytes()
    recognition, _ = await asyncio.gather(measure(args.url, pcm), speech())
    print('CONCURRENT_ASR', json.dumps(recognition), flush=True)
    print('PASS: resident GPU reply weights, native streaming ASR and finite Malay synthesis', flush=True)


if __name__ == '__main__':
    asyncio.run(main())
