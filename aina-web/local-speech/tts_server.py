"""Local Malay Chatterbox TTS with a youthful pitch and persistent model cache."""
import asyncio,io,time,threading,hashlib,os,urllib.request,re,copy,json
from pathlib import Path
import numpy as np
import torch,librosa,soundfile as sf
from fastapi import FastAPI,Request,Response
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
from speech_policy import token_budget,acquire_speech_lock

ROOT=Path(__file__).resolve().parent;GENERATED=ROOT/'generated';GENERATED.mkdir(exist_ok=True)
torch.set_num_threads(4)
device='cuda' if torch.cuda.is_available() else 'cpu'
print('Loading Malay Chatterbox into CPU standby; synthesis device:',device,flush=True)
model=ChatterboxMultilingualTTS.from_local(ROOT/'models/chatterbox-malay',device='cpu')
legacy_voice=os.getenv('AINA_VOICE_PROFILE')=='legacy'
profile_path=ROOT/'active_voice.json'
voice_profile=json.loads(profile_path.read_text(encoding='utf-8')) if profile_path.exists() and not legacy_voice else {
    'name':'legacy','reference':'voice-reference.wav','pitch':4.5,'exaggeration':.5,'cfg_weight':.25,'temperature':.65}
voice_pitch=float(os.getenv('AINA_VOICE_PITCH',str(voice_profile['pitch'])))
prompt=ROOT/voice_profile['reference']
malay_prompt=ROOT/voice_profile['malay_conditioning'] if voice_profile.get('malay_conditioning') else None
if voice_profile['name']!='legacy':
    for required in (prompt,malay_prompt):
        if required is None or not required.is_file():raise RuntimeError(f'Missing approved voice reference: {required}')
elif prompt.exists():model.prepare_conditionals(str(prompt),exaggeration=voice_profile['exaggeration'])
lock=threading.Lock();app=FastAPI()
resident=os.getenv('AINA_RESIDENT_TTS','1')=='1' and device=='cuda'
cfm_steps=int(os.getenv('AINA_CFM_STEPS','6'))
sparse_attention=os.getenv('AINA_SPARSE_TTS','1')=='1'
cancel_current=None
inference_deadline=0
inference_budget=1000
class SpeechCancelled(Exception):pass
class SpeechTimeout(Exception):pass
def check_cancel(_module,_args):
    if cancel_current and cancel_current.is_set():raise SpeechCancelled()
    if inference_deadline and time.perf_counter()>inference_deadline:
        raise SpeechTimeout('Voice generation exceeded 25 seconds. Please try a shorter reply.')
model.t3.tfmr.register_forward_pre_hook(check_cancel)
if resident:
    # T3 dominates weight memory. Keep the waveform decoder at FP32 for
    # stability; autocast is scoped to T3 only, not audio FFT/vocoder code.
    model.t3.half().to(device);model.s3gen.to(device)
    if model.conds:model.conds.to(device)
    model.device=device
    if sparse_attention:
        from chatterbox.models.t3.inference.alignment_stream_analyzer import LLAMA_ALIGNED_HEADS,AlignmentStreamAnalyzer
        def compact_attention_spy(analyzer,tfmr,buffer_idx,layer_idx,head_idx):
            # Upstream copies BOTH CFG batches and ALL attention heads to CPU
            # three times per token, then keeps only one head from each copy.
            # Keep those three selected heads on GPU; the existing step()
            # averages them and transfers its small text-alignment slice once.
            def capture(_module,_args,output):
                if isinstance(output,tuple) and len(output)>1 and output[1] is not None:
                    analyzer.last_aligned_attns[buffer_idx]=output[1][0,head_idx].detach()
            tfmr.layers[layer_idx].self_attn.register_forward_hook(capture)
        AlignmentStreamAnalyzer._add_attention_spy=compact_attention_spy
        aligned={index for index,_head in LLAMA_ALIGNED_HEADS}
        # The installed analyzer switches a shared config to eager attention
        # for every layer, despite needing maps from only three layers.
        for index,layer in enumerate(model.t3.tfmr.layers):
            layer.self_attn.config=copy.copy(model.t3.tfmr.config)
            layer.self_attn.config._attn_implementation='eager' if index in aligned else 'sdpa'
        def configure_attention(_module,_args):
            model.t3.tfmr.config._attn_implementation='sdpa'
        model.t3.tfmr.register_forward_pre_hook(configure_attention)
    t3_inference=model.t3.inference
    def mixed_t3(*args,**kwargs):
        began=time.perf_counter()
        kwargs['max_new_tokens']=min(kwargs.get('max_new_tokens',1000),inference_budget)
        modules=[layer.self_attn for layer in model.t3.tfmr.layers]
        hooks={module:set(module._forward_hooks) for module in modules}
        try:
            with torch.autocast('cuda',dtype=torch.float16):result=t3_inference(*args,**kwargs)
        finally:
            # inference constructs fresh alignment spies each call. Retaining
            # those hooks leaks analyzers and multiplies GPU-to-CPU transfers.
            for module in modules:
                for key in set(module._forward_hooks)-hooks[module]:module._forward_hooks.pop(key,None)
        print('TTS text tokens:',round(time.perf_counter()-began,2),'s',flush=True)
        if result.shape[-1]>=kwargs['max_new_tokens'] and result[0,-1].item()!=model.t3.hp.stop_speech_token:
            raise SpeechTimeout('Speech did not finish within its token budget; no truncated audio was played.')
        return result
    model.t3.inference=mixed_t3
    decoder_inference=model.s3gen.inference
    def fast_decoder(*args,**kwargs):
        began=time.perf_counter();kwargs.setdefault('n_cfm_timesteps',cfm_steps)
        result=decoder_inference(*args,**kwargs)
        print('TTS waveform:',round(time.perf_counter()-began,2),'s; steps:',cfm_steps,flush=True)
        return result
    model.s3gen.inference=fast_decoder
    print('Resident TTS: FP16 text model, FP32 waveform decoder; ASR stays on GPU',flush=True)

if voice_profile['name']!='legacy':
    # Match the user-approved preview: target timbre and decoder reference,
    # with Malay speech-token conditioning to reduce Japanese accent transfer.
    model.prepare_conditionals(str(prompt),exaggeration=voice_profile['exaggeration'])
    target_conditionals=model.conds
    model.prepare_conditionals(str(malay_prompt),exaggeration=voice_profile['exaggeration'])
    model.conds.t3.speaker_emb=target_conditionals.t3.speaker_emb
    model.conds.gen=target_conditionals.gen
if resident:torch.cuda.empty_cache() # Release reference-encoder scratch allocations.
voice_signature=json.dumps({**voice_profile,'pitch':voice_pitch,'cfm_steps':cfm_steps},sort_keys=True)
for reference in (prompt,malay_prompt):
    if reference and reference.exists():voice_signature+=hashlib.sha256(reference.read_bytes()).hexdigest()
STYLES={
    'neutral':{},
    'launch':{'exaggeration':.55,'cfg_weight':.65,'temperature':.6},
    'excited':{'exaggeration':.75,'cfg_weight':.65,'temperature':.6},
    'annoyed':{'exaggeration':.65,'cfg_weight':.5,'temperature':.55},
}
def cache_path(text,style='neutral'):
    signature='v4:'+voice_signature+':'+text if style=='neutral' else 'ms-MY-v4-vituti-word:'+voice_signature+':'+json.dumps(STYLES[style],sort_keys=True)+':'+style+':'+text
    return GENERATED/(hashlib.sha256(signature.encode()).hexdigest()+'.wav')
# Preserve the exact audio the user listened to and approved, not a fresh draw.
approved_greeting=ROOT/voice_profile['approved_greeting'] if voice_profile.get('approved_greeting') else None
if approved_greeting and approved_greeting.is_file() and voice_pitch==0:
    cache_path('Hi, Saya Aina! Apa yang saya boleh bantu?').write_bytes(approved_greeting.read_bytes())
def asr_gpu(action):
    try:
        req=urllib.request.Request('http://127.0.0.1:8765/'+action,data=b'',method='POST')
        with urllib.request.urlopen(req,timeout=60):pass
    except Exception as e:print('ASR GPU coordination:',e,flush=True)
def move_tts(target):
    model.t3.to(target);model.s3gen.to(target);model.ve.to(target)
    if model.conds:model.conds.to(target)
    model.device=target
def generate(text,cancel=None,style='neutral'):
    global cancel_current,inference_deadline,inference_budget
    path=cache_path(text,style)
    if path.exists():return path.read_bytes(),0
    queued=time.perf_counter()
    if not acquire_speech_lock(lock,cancel):raise SpeechCancelled()
    try:
      with torch.inference_mode():
        if cancel and cancel.is_set():raise SpeechCancelled()
        # Another identical request may have filled the cache while we waited.
        if path.exists():return path.read_bytes(),0
        start=time.perf_counter()
        print('TTS queue:',round(start-queued,2),'s; chars:',len(text),flush=True)
        cancel_current=cancel
        inference_budget=token_budget(text)
        inference_deadline=start+25
        if not resident:asr_gpu('release')
        try:
            if not resident:move_tts(device)
            torch.manual_seed(42)
            # Reuse reference conditioning instead of re-encoding it every turn.
            # Explicit syllable separation prevents the proper name drifting to
            # "ini". The displayed text remains the user's exact spelling.
            spoken=re.sub(r'\baina\b','Ai-na',text,flags=re.IGNORECASE)
            # Display keeps the brand spelling; speech uses its Malay reading.
            spoken=re.sub(r'\bvituti\b','Vituti',spoken,flags=re.IGNORECASE)
            delivery={key:voice_profile[key] for key in ('exaggeration','cfg_weight','temperature')}
            delivery.update(STYLES[style])
            wav=model.generate(spoken,language_id='ms',**delivery).squeeze().float().cpu().numpy()
            if cancel and cancel.is_set():raise SpeechCancelled()
            if voice_pitch:wav=librosa.effects.pitch_shift(wav,sr=model.sr,n_steps=voice_pitch)
            if not len(wav) or not np.isfinite(wav).all():raise RuntimeError('Invalid generated speech')
            wav=np.clip(wav,-.95,.95)
            temporary=path.with_suffix('.pending.wav')
            sf.write(temporary,wav,model.sr,subtype='PCM_16');temporary.replace(path)
        finally:
            cancel_current=None
            inference_deadline=0
            # All three models share a 6 GB WDDM GPU. Release scratch space;
            # retaining it here made subsequent uncached speech stall.
            if resident:torch.cuda.empty_cache()
            if not resident:
                move_tts('cpu')
                if device=='cuda':torch.cuda.empty_cache()
                asr_gpu('activate')
    finally:lock.release()
    return path.read_bytes(),time.perf_counter()-start
@app.get('/health')
def health():return {'ready':True,'model':'Chatterbox Multilingual','language':'ms','device':device,'resident':resident,'sparse_attention':sparse_attention,'alignment_hooks':sum(len(layer.self_attn._forward_hooks) for layer in model.t3.tfmr.layers),'reference':prompt.exists(),'voice_profile':voice_profile['name'],'pitch_semitones':voice_pitch,'gpu_allocated_mb':round(torch.cuda.memory_allocated()/1048576) if resident else 0,'gpu_reserved_mb':round(torch.cuda.memory_reserved()/1048576) if resident else 0}
@app.post('/tts')
async def tts(req:Request):
    data=await req.json();text=data.get('text','');style=data.get('style','neutral')
    if not isinstance(style,str) or style not in STYLES:return Response('Unsupported voice style',status_code=400)
    if not isinstance(text,str) or not 1<=len(text)<=1000:return Response('Expected text of 1–1000 characters',status_code=400)
    cancel=threading.Event();task=asyncio.create_task(asyncio.to_thread(generate,text,cancel,style))
    try:
        while not task.done():
            if await req.is_disconnected():cancel.set()
            await asyncio.sleep(.1)
        audio,seconds=await task
        return Response(audio,media_type='audio/wav',headers={'X-Generation-Seconds':str(seconds)})
    except SpeechCancelled:
        print('Speech generation cancelled',flush=True)
        return Response(status_code=499)
    except SpeechTimeout as error:
        print('TTS bounded generation:',str(error),flush=True)
        return Response(str(error),status_code=504)
    finally:
        if not task.done():cancel.set()
if __name__=='__main__':
    import uvicorn
    print('LOCAL_TTS_READY',flush=True);uvicorn.run(app,host='127.0.0.1',port=8766)
