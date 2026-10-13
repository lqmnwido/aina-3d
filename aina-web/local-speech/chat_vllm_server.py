"""Persistent GPU vLLM chat, streamed through AINA's NDJSON bridge."""
import asyncio,json,os,uuid
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI,HTTPException,Request
from fastapi.responses import StreamingResponse
from transformers import AutoTokenizer
from vllm import SamplingParams
from vllm.engine.arg_utils import AsyncEngineArgs
from vllm.v1.engine.async_llm import AsyncLLM
ROOT=Path(__file__).resolve().parent
MODEL=str(ROOT/'models/qwen3-chat-1.7b')
engine=None;tokenizer=None;ready=False;slots=asyncio.Semaphore(1)
def prompt_for(messages):
    return tokenizer.apply_chat_template(messages,tokenize=False,add_generation_prompt=True,enable_thinking=False)
@asynccontextmanager
async def lifespan(_app):
    global ready
    async for _ in engine.generate(prompt_for([{'role':'user','content':'Hai'}]),SamplingParams(max_tokens=1),'warmup'):pass
    ready=True;print('LOCAL_VLLM_CHAT_READY',flush=True)
    yield
    ready=False;engine.shutdown()
app=FastAPI(lifespan=lifespan)
@app.get('/health')
def health():
    return {'ready':ready,'model':'Qwen3-1.7B (4-bit)','device':'cuda:0','mode':'vllm-native-streaming','thinking':False}
@app.post('/chat')
async def chat(req:Request):
    if not ready:raise HTTPException(503,'vLLM chat is loading')
    data=await req.json();messages=data.get('messages')
    if not isinstance(messages,list) or not 1<=len(messages)<=25:raise HTTPException(400,'Expected bounded conversation')
    if any(not isinstance(m,dict) or m.get('role') not in ('system','user','assistant') or not isinstance(m.get('content'),str) for m in messages):raise HTTPException(400,'Invalid conversation')
    messages=list(messages);prompt=prompt_for(messages)
    # Keep the system prompt and latest turn; bound the history instead of
    # rejecting normal conversations when this small GPU context fills up.
    while len(tokenizer.encode(prompt))>900 and len(messages)>2:
        messages.pop(1 if messages[0]['role']=='system' else 0)
        prompt=prompt_for(messages)
    if len(tokenizer.encode(prompt))>900:raise HTTPException(400,'Question too long for the local voice context')
    identity=uuid.uuid4().hex
    params=SamplingParams(temperature=.3,top_p=.8,top_k=20,max_tokens=96)
    async def chunks():
        async with slots:
            previous=''
            try:
                async for result in engine.generate(prompt,params,identity):
                    if await req.is_disconnected():break
                    text=result.outputs[0].text;delta=text[len(previous):];previous=text
                    if delta:yield json.dumps({'message':{'content':delta},'done':False})+'\n'
                else:yield json.dumps({'done':True})+'\n'
            except Exception as exc:yield json.dumps({'error':str(exc)})+'\n'
            finally:await engine.abort(identity)
    if data.get('stream'):return StreamingResponse(chunks(),media_type='application/x-ndjson')
    text=''
    async for line in chunks():
        item=json.loads(line)
        if item.get('error'):raise HTTPException(502,item['error'])
        text+=item.get('message',{}).get('content','')
    return {'message':{'content':text}}
if __name__=='__main__':
    import torch,uvicorn
    torch.set_num_threads(4)
    tokenizer=AutoTokenizer.from_pretrained(MODEL,local_files_only=True)
    engine=AsyncLLM.from_engine_args(AsyncEngineArgs(model=MODEL,dtype='float16',quantization='bitsandbytes',max_model_len=1024,
        gpu_memory_utilization=float(os.getenv('AINA_CHAT_GPU_FRACTION','.25')),
        kv_cache_memory_bytes=128*1024*1024,max_num_seqs=1,max_num_batched_tokens=256,
        enforce_eager=True,enable_prefix_caching=True,swap_space=0,attention_config={'backend':'TRITON_ATTN'}))
    uvicorn.run(app,host='127.0.0.1',port=int(os.getenv('AINA_CHAT_PORT','8768')))
