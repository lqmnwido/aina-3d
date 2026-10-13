"""Measure warm replies and recognition while uncached speech is generated."""
import asyncio,io,json,time,urllib.request
from pathlib import Path
import numpy as np,soundfile as sf
from scipy.signal import resample_poly
ROOT=Path(__file__).resolve().parent
def request(url,data=None,raw=False):
    body=None if data is None else data if raw else json.dumps(data).encode()
    req=urllib.request.Request(url,data=body,headers={'Content-Type':'application/octet-stream' if raw else 'application/json'})
    with urllib.request.urlopen(req,timeout=180) as r:return r.read()
async def main():
    for _ in range(90):
        try:
            config=json.loads(request('http://127.0.0.1:5173/api/config'))
            if config['configured'] and config['ttsConfigured']:break
        except Exception:pass
        await asyncio.sleep(2)
    health=json.loads(request('http://127.0.0.1:8766/health'));print('TTS_HEALTH',health,flush=True)
    assert health.get('resident'),health
    for i in range(2):
        start=time.perf_counter();reply=json.loads(await asyncio.to_thread(request,'http://127.0.0.1:5173/api/chat',{'messages':[{'role':'user','content':'Hi. Sihat ke?'}]}))
        print('CHAT',i,round(time.perf_counter()-start,2),reply,flush=True)
    samples,sr=sf.read(ROOT/'generated/greeting-check.wav');pcm=(np.clip(resample_poly(samples,16000,sr),-1,1)*32767).astype('<i2').tobytes()
    text='Hai! Saya sihat. Awak pula?'
    start=time.perf_counter();tts=asyncio.create_task(asyncio.to_thread(request,'http://127.0.0.1:5173/api/tts',{'text':text}))
    await asyncio.sleep(1)
    state=json.loads(request('http://127.0.0.1:8765/health'));print('ASR_DURING_TTS',state,flush=True);assert state['on_gpu']
    asr_start=time.perf_counter();recognized=json.loads(await asyncio.to_thread(request,'http://127.0.0.1:8765/transcribe',pcm,True))
    print('CONCURRENT_ASR',round(time.perf_counter()-asr_start,2),recognized,flush=True)
    audio=await tts;out,rate=sf.read(io.BytesIO(audio));assert np.isfinite(out).all() and np.max(np.abs(out))>.01
    (ROOT/'generated/resident-check.wav').write_bytes(audio)
    print('TTS',round(time.perf_counter()-start,2),'audio_seconds',len(out)/rate,flush=True)
    pcm=(np.clip(resample_poly(out,16000,rate),-1,1)*32767).astype('<i2').tobytes()
    print('TTS_RECOGNIZED',json.loads(await asyncio.to_thread(request,'http://127.0.0.1:8765/transcribe',pcm,True)),flush=True)
    print('PASS: resident TTS + GPU recognition concurrently, warm local replies, non-silent finite audio',flush=True)
asyncio.run(main())
