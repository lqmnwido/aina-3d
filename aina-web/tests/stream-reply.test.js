import test from 'node:test';
import assert from 'node:assert/strict';
import {readReply} from '../src/stream-reply.js';

function streamed(events){
  const bytes=new TextEncoder().encode(events.map(e=>JSON.stringify(e)).join('\n'));
  return new Response(new ReadableStream({start(controller){for(let i=0;i<bytes.length;i+=3)controller.enqueue(bytes.slice(i,i+3));controller.close();}}),{headers:{'content-type':'application/x-ndjson'}});
}
test('reply streaming preserves fragmented UTF8 and publishes partials',async()=>{
  const partials=[];
  const text=await readReply(streamed([{type:'delta',text:'Hai 👋'},{type:'delta',text:'Hai 👋 awak!'},{type:'final',text:'Hai 👋 awak!'}]),s=>partials.push(s));
  assert.deepEqual(partials,['Hai 👋','Hai 👋 awak!']);assert.equal(text,'Hai 👋 awak!');
});
test('an incomplete streamed reply is not saved as a completed turn',async()=>{
  await assert.rejects(readReply(streamed([{type:'delta',text:'Hai'}])),/incomplete/);
});
test('streamed backend errors reach the caller',async()=>{
  await assert.rejects(readReply(streamed([{type:'error',message:'GPU busy'}])),/GPU busy/);
});
test('cached small-talk JSON replies remain compatible',async()=>{
  assert.equal(await readReply(Response.json({text:'Hai!'})),'Hai!');
  await assert.rejects(readReply(Response.json({error:'Offline'},{status:502})),/Offline/);
});
