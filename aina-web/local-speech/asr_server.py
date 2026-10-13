"""Windows-compatible rolling Qwen ASR, PCM16 websocket + server VAD.
Official vLLM native streaming is Linux-only; Transformers re-decodes the
growing utterance for partials here. No cloud recognition calls.
"""
import asyncio,json,time,threading,uuid,os
from pathlib import Path
import numpy as np
import torch
from fastapi import FastAPI,WebSocket,WebSocketDisconnect,Request,HTTPException
from qwen_asr import Qwen3ASRModel

ROOT=Path(__file__).resolve().parent
torch.set_num_threads(4)
device='cuda:0' if torch.cuda.is_available() else 'cpu'
print('Loading Qwen3-ASR-0.6B on',device,flush=True)
model=Qwen3ASRModel.from_pretrained(str(ROOT/'models/qwen3-asr-0.6b'),dtype=torch.float16 if device.startswith('cuda') else torch.float32,device_map=device,attn_implementation='sdpa',max_inference_batch_size=1,max_new_tokens=128)
lock=threading.Lock();app=FastAPI();on_gpu=device.startswith('cuda')
current_cancel=None;current_deadline=0
class RecognitionCancelled(Exception):pass
def guard_forward(_module,_args):
    if current_cancel is not None and current_cancel.is_set():raise RecognitionCancelled()
    if current_deadline and time.monotonic()>current_deadline:raise TimeoutError('Recognition exceeded its time budget')
# generate() delegates directly to thinker.generate(); the outer model never
# receives a forward call. Guard the actual decoder so partials can relinquish
# the GPU promptly when the utterance ends.
model.model.thinker.register_forward_pre_hook(guard_forward)
def transcribe(audio,cancel=None,timeout=8):
    global current_cancel,current_deadline
    deadline=time.monotonic()+timeout
    while not lock.acquire(timeout=.05):
        if cancel is not None and cancel.is_set():raise RecognitionCancelled()
        if time.monotonic()>deadline:raise TimeoutError('Recognition queue is busy')
    try:
        if cancel is not None and cancel.is_set():raise RecognitionCancelled()
        current_cancel=cancel;current_deadline=deadline
        model.max_new_tokens=64 if len(audio)<16000*5 else 128
        with torch.inference_mode():results=model.transcribe(audio=(audio,16000),language='Malay')
        return results[0].text.strip()
    finally:
        current_cancel=None;current_deadline=0
        if device.startswith('cuda'):torch.cuda.empty_cache()
        lock.release()
def set_gpu(enabled):
    global on_gpu
    if device.startswith('cuda'):
        with lock:
            model.model.to(device if enabled else 'cpu');on_gpu=enabled
            if not enabled:torch.cuda.empty_cache()
    return {'on_gpu':on_gpu}
@app.get('/health')
def health():return {'ready':True,'model':'Qwen3-ASR-0.6B','device':device,'on_gpu':on_gpu,'mode':'rolling-partials'}
@app.post('/release')
async def release():return await asyncio.to_thread(set_gpu,False)
@app.post('/activate')
async def activate():return await asyncio.to_thread(set_gpu,True)
@app.post('/transcribe')
async def transcribe_file(req:Request):
    audio=np.frombuffer(await req.body(),dtype='<i2').astype(np.float32)/32768
    if not 800<=audio.size<=16000*30:return {'error':'Expected PCM16, 50ms–30s.'}
    t=time.perf_counter()
    try:text=await asyncio.to_thread(transcribe,audio)
    except TimeoutError as error:raise HTTPException(status_code=503,detail=str(error))
    return {'text':text,'seconds':time.perf_counter()-t}
@app.websocket('/ws/asr')
async def stream(ws:WebSocket):
    await ws.accept();await ws.send_json({'type':'ready'})
    chunks=[];silence=0;active=False;last_partial=0;partial_task=None;partial_cancel=None;tasks=set();item_id='';finalized=set();preroll=[];cancellations=set()
    send_lock=asyncio.Lock()
    async def send(m):
        async with send_lock:await ws.send_json(m)
    async def decode(audio,kind,identity,cancel=None):
        cancel=cancel or threading.Event();cancellations.add(cancel)
        try:
            began=time.perf_counter()
            text=await asyncio.to_thread(transcribe,audio,cancel)
            if not any(character.isalnum() for character in text):text=''
            if text and not(kind=='partial' and identity in finalized):await send({'type':kind,'text':text,'id':identity,'seconds':time.perf_counter()-began})
            elif kind=='final' and not text:await send({'type':'no-speech','id':identity})
        except RecognitionCancelled:pass
        except TimeoutError:
            if kind=='final':await send({'type':'no-speech','id':identity,'message':'Pengecaman mengambil terlalu lama. Cuba ayat pendek sekali lagi.'})
        except Exception as e:
            try:await send({'type':'error','message':str(e)})
            except Exception:pass
        finally:cancellations.discard(cancel)
    try:
        while True:
            msg=await ws.receive()
            if msg['type']=='websocket.disconnect':break
            if msg.get('text'):
                if json.loads(msg['text']).get('type')=='finish':
                    if chunks:await decode(np.concatenate(chunks),'final',item_id)
                    await send({'type':'finished'});break
                continue
            raw=msg.get('bytes',b'')
            if not raw or len(raw)%2 or len(raw)>64000:continue
            audio=np.frombuffer(raw,dtype='<i2').astype(np.float32)/32768
            rms=float(np.sqrt(np.mean(audio*audio)));speech=rms>.009
            if not active:
                if not speech:
                    preroll.append(audio)
                    if len(preroll)>3:preroll.pop(0)
                    continue
                active=True;item_id=uuid.uuid4().hex;last_partial=time.monotonic();silence=0
                chunks=preroll;preroll=[]
                await send({'type':'speech-start','id':item_id})
            chunks.append(audio);silence=0 if speech else silence+len(audio)/16000
            length=sum(c.size for c in chunks)
            if silence>=.5 or length>=16000*18:
                await send({'type':'speech-end','id':item_id})
                if partial_cancel:partial_cancel.set()
                finalized.add(item_id)
                if len(finalized)>500:finalized.clear();finalized.add(item_id)
                snapshot=np.concatenate(chunks)
                trim=max(0,int((silence-.1)*16000))
                if trim:snapshot=snapshot[:-trim]
                chunks=[];active=False;silence=0
                task=asyncio.create_task(decode(snapshot,'final',item_id));tasks.add(task);task.add_done_callback(tasks.discard)
            elif length>=16000*.8 and silence<.1 and time.monotonic()-last_partial>=.8 and (partial_task is None or partial_task.done()):
                last_partial=time.monotonic();partial_cancel=threading.Event();partial_task=asyncio.create_task(decode(np.concatenate(chunks),'partial',item_id,partial_cancel));tasks.add(partial_task);partial_task.add_done_callback(tasks.discard)
    except (WebSocketDisconnect,RuntimeError):pass
    finally:
        for cancel in cancellations:cancel.set()
        for task in tasks:task.cancel()
        try:await ws.close()
        except Exception:pass
if __name__=='__main__':
    import uvicorn
    # Pay lazy CUDA/kernel initialization during startup, not after the user's
    # first sentence. Silence is only a warm-up and is never sent to a client.
    print('Warming ASR inference...',flush=True)
    transcribe(np.zeros(16000,dtype=np.float32),timeout=45)
    print('LOCAL_ASR_READY',flush=True);uvicorn.run(app,host='127.0.0.1',port=8765)
