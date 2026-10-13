import assert from 'node:assert/strict';
import {readReply} from '../src/stream-reply.js';

const start=performance.now();let first=null,count=0;
const response=await fetch('http://127.0.0.1:5173/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stream:true,messages:[{role:'user',content:'Apakah maksud tenaga solar?'}]})});
assert.match(response.headers.get('content-type'),/application\/x-ndjson/);
const reply=await readReply(response,()=>{count++;first??=performance.now()-start;});
assert.ok(count>1);assert.ok(reply.trim());
console.log(JSON.stringify({firstDeltaSeconds:first/1000,completeSeconds:(performance.now()-start)/1000,deltaCount:count,text:reply}));
