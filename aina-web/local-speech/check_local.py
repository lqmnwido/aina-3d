"""Exercise actual local speech -> recognition -> reply -> speech."""
import asyncio,json,time,urllib.request,io,sys,argparse
from pathlib import Path
import numpy as np,soundfile as sf
from scipy.signal import resample_poly
import websockets

ROOT=Path(__file__).resolve().parent
def post(url,data,raw=False):
    payload=data if raw else json.dumps(data).encode()
    req=urllib.request.Request(url,data=payload,headers={'Content-Type':'application/octet-stream' if raw else 'application/json'})
    with urllib.request.urlopen(req,timeout=240) as response:return response.read()
async def main():
    parser=argparse.ArgumentParser();parser.add_argument('--text',default='Hi, Saya Aina! Apa yang saya boleh bantu?');parser.add_argument('--greeting-only',action='store_true');args=parser.parse_args()
    start=time.perf_counter()
    wav=await asyncio.to_thread(post,'http://127.0.0.1:5173/api/tts',{'text':args.text})
    (ROOT/'generated'/('greeting-check.wav' if args.text=='Hi, Saya Aina! Apa yang saya boleh bantu?' else 'user-check.wav')).write_bytes(wav)
    print('GREETING_TTS',round(time.perf_counter()-start,2),flush=True)
    audio,sr=sf.read(io.BytesIO(wav));pcm=(np.clip(resample_poly(audio,16000,sr),-1,1)*32767).astype('<i2').tobytes()
    events=[];start=time.perf_counter()
    async with websockets.connect('ws://127.0.0.1:5173/ws/asr',origin='http://127.0.0.1:5173') as ws:
        print('READY',await ws.recv(),flush=True)
        async def feed():
            for i in range(0,len(pcm),3200):await ws.send(pcm[i:i+3200]);await asyncio.sleep(.1)
            for _ in range(12):await ws.send(bytes(3200));await asyncio.sleep(.1)
        task=asyncio.create_task(feed())
        while True:
            event=json.loads(await asyncio.wait_for(ws.recv(),90));events.append(event);print('ASR',round(time.perf_counter()-start,2),event,flush=True)
            if event['type']=='error':raise RuntimeError(event)
            if event['type']=='final':break
        await task
    transcript=events[-1]['text'];assert transcript.strip()
    if args.greeting_only:
        result=json.loads(await asyncio.to_thread(post,'http://127.0.0.1:8765/transcribe',pcm,True));print('WARM_ASR',result,flush=True)
        return
    start=time.perf_counter();reply=json.loads(await asyncio.to_thread(post,'http://127.0.0.1:5173/api/chat',{'messages':[{'role':'user','content':transcript}]}))
    print('CHAT',round(time.perf_counter()-start,2),reply,flush=True)
    start=time.perf_counter();output=await asyncio.to_thread(post,'http://127.0.0.1:5173/api/tts',{'text':reply['text']})
    samples,rate=sf.read(io.BytesIO(output));assert len(samples)>rate*.2 and np.isfinite(samples).all() and np.max(np.abs(samples))>.01
    (ROOT/'generated'/'conversation-check.wav').write_bytes(output)
    print('TTS',round(time.perf_counter()-start,2),'audio_seconds',round(len(samples)/rate,2),flush=True)
    print('PASS: real local websocket ASR -> '+('cached small-talk' if reply.get('cachedSmallTalk') else 'vLLM')+' -> Malay WAV',flush=True)
asyncio.run(main())
