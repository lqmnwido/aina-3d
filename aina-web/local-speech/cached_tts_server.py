"""Serve the approved scripted speech without loading Torch or Chatterbox."""
import hashlib,json,os
from pathlib import Path
from fastapi import FastAPI,Request,Response

ROOT=Path(__file__).resolve().parent
WEB=ROOT.parent
profile=json.loads((ROOT/'active_voice.json').read_text(encoding='utf-8'))
pitch=float(os.getenv('AINA_VOICE_PITCH',str(profile['pitch'])))
signature=json.dumps({**profile,'pitch':pitch,'cfm_steps':int(os.getenv('AINA_CFM_STEPS','6'))},sort_keys=True)
for key in ('reference','malay_conditioning'):
    if profile.get(key):
        reference=ROOT/profile[key]
        if reference.is_file():signature+=hashlib.sha256(reference.read_bytes()).hexdigest()

def cached(text):
    return ROOT/'generated'/(hashlib.sha256(('v4:'+signature+':'+text).encode()).hexdigest()+'.wav')

clips={
    'Hi, Saya Aina! Apa yang saya boleh bantu?':ROOT/profile['approved_greeting'],
    'Hai! Saya sihat. Awak pula?':cached('Hai! Saya sihat. Awak pula?'),
    'Sama-sama, saya seronok untuk membantu anda!':cached('Sama-sama, saya seronok untuk membantu anda!'),
    'Okay, saya akan lancarkan ViTuTi sekarang!':WEB/'public/audio/vituti-launch-dbd50ca0283a.wav',
    'ViTuTi telah berjaya dilancarkan! Terima Kasih kepada semua pihak!':WEB/'public/audio/vituti-landing-selected-hype-34db74885b08.wav',
    'Maaf! Saya tidak dapat membantu Anda!':WEB/'public/audio/aina-unknown-4400b7ae6ad3.wav',
}
app=FastAPI()

@app.get('/health')
def health():
    missing=[text for text,path in clips.items() if not path.is_file()]
    return {'ready':not missing,'model':'Chatterbox approved audio cache','language':'ms',
            'device':'cached-audio','resident':False,'mode':'scripted-cache',
            'voice_profile':profile['name'],'gpu_allocated_mb':0,'missing':missing}

@app.post('/tts')
async def tts(req:Request):
    data=await req.json();text=data.get('text')
    if not isinstance(text,str) or not 1<=len(text)<=1000:
        return Response('Expected text of 1–1000 characters',status_code=400)
    path=clips.get(text.strip(),cached(text.strip()))
    if not path.is_file():
        return Response('Audio is not prepared for this text. Run the full TTS service to generate it.',status_code=409)
    return Response(path.read_bytes(),media_type='audio/wav',headers={'X-Generation-Seconds':'0'})

if __name__=='__main__':
    import sys
    if '--prepare' in sys.argv:
        import urllib.request
        for text,path in clips.items():
            if path.is_file():continue
            request=urllib.request.Request('http://127.0.0.1:8766/tts',
                data=json.dumps({'text':text}).encode(),headers={'Content-Type':'application/json'})
            with urllib.request.urlopen(request,timeout=60) as response:audio=response.read()
            if not audio.startswith(b'RIFF'):raise RuntimeError('TTS did not return WAV audio')
            path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(audio)
            print('Prepared:',text,flush=True)
        if not health()['ready']:raise RuntimeError('Scripted audio cache is incomplete')
        sys.exit(0)
    import uvicorn
    print('LOCAL_TTS_READY: approved audio cache; no GPU model',flush=True)
    uvicorn.run(app,host='127.0.0.1',port=int(os.getenv('AINA_TTS_PORT','8766')),access_log=False)
