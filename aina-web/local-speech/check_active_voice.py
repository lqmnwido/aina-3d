"""Verify approved greeting bytes, generate/cache launch audio, check local ASR."""
import hashlib, json, sys, time, urllib.request, urllib.error
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

ROOT=Path(__file__).resolve().parents[2]
DEST=ROOT/'output/audio/aina-dialogue4'
def health():
    with urllib.request.urlopen('http://127.0.0.1:8766/health',timeout=2) as response:
        return json.load(response)
for attempt in range(90):
    try:
        status=health()
        assert status['voice_profile']=='aina-dialogue4-malay',status
        break
    except urllib.error.URLError:
        if attempt%5==0:print('Waiting for approved TTS worker...',flush=True)
        time.sleep(2)
else:raise RuntimeError('Approved TTS worker did not become ready')
print(json.dumps(status),flush=True)
samples=[('active-greeting','Hi, Saya Aina! Apa yang saya boleh bantu?'),
         ('active-launch','Okay, saya akan lancarkan ViTuTi sekarang!')]
if len(sys.argv)>1:samples=[('launch-clear',sys.argv[1])]
for name,text in samples:
    request=urllib.request.Request('http://127.0.0.1:5173/api/tts',
        data=json.dumps({'text':text}).encode(),headers={'Content-Type':'application/json'})
    started=time.perf_counter()
    with urllib.request.urlopen(request,timeout=120) as response:audio=response.read()
    path=DEST/f'aina-{name}-malay.wav'
    path.write_bytes(audio)
    if name=='active-greeting':
        approved=(DEST/'aina-greeting-malay-hybrid.wav').read_bytes()
        assert audio==approved,'Active greeting differs from the user-approved preview'
    wav,rate=sf.read(path,dtype='float32')
    assert np.isfinite(wav).all() and np.max(np.abs(wav))>0.001
    pcm=(np.clip(resample_poly(wav,16000,rate),-1,1)*32767).astype('<i2').tobytes()
    check={'file':str(path),'text':text,'request_seconds':time.perf_counter()-started,
           'audio_seconds':len(wav)/rate,'sha256':hashlib.sha256(audio).hexdigest()}
    try:
        req=urllib.request.Request('http://127.0.0.1:8765/transcribe',data=pcm,
            headers={'Content-Type':'application/octet-stream'})
        with urllib.request.urlopen(req,timeout=60) as response:check['asr']=json.load(response)
    except urllib.error.HTTPError as error:
        check['asr_error']={'status':error.code,'message':error.read().decode()}
    print(json.dumps(check,ensure_ascii=False),flush=True)
