import assert from 'node:assert/strict';
import {readReply} from '../src/stream-reply.js';
const origin='http://127.0.0.1:5173';
let config;
for(let attempt=0;attempt<60;attempt++){
  try{config=await(await fetch(origin+'/api/config')).json();}catch{config={};}
  if(config.chatConfigured)break;
  await new Promise(resolve=>setTimeout(resolve,2000));
}
assert.equal(config.chat,'vllm');assert.equal(config.chatConfigured,true);
assert.equal(config.asrMode,'vllm-native-streaming');assert.equal(config.ttsConfigured,true);
let last='';
for(const question of ['satu tambah satu berapa','Apa ibu negara Malaysia?','Kenapa langit berwarna biru?']){
  const start=performance.now();let first=null,count=0;
  const response=await fetch(origin+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:question}],stream:true})});
  last=await readReply(response,()=>{first??=performance.now()-start;count++;});
  assert.ok(last.length>0);assert.ok(count>0,'general replies stream partial text');
  if(question.startsWith('satu'))assert.match(last,/dua|\b2\b/i);
  if(question.startsWith('Apa ibu'))assert.match(last,/Kuala Lumpur/i);
  console.log(JSON.stringify({question,answer:last,firstDeltaMs:Math.round(first),totalMs:Math.round(performance.now()-start),partials:count}));
}
const start=performance.now();
const speech=await fetch(origin+'/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'Satu tambah satu ialah dua.'}),signal:AbortSignal.timeout(60000)});
assert.equal(speech.ok,true);const wav=Buffer.from(await speech.arrayBuffer());
assert.equal(wav.toString('ascii',0,4),'RIFF');assert.ok(wav.length>1000);
console.log(JSON.stringify({ttsMs:Math.round(performance.now()-start),wavBytes:wav.length}));
const after=await(await fetch(origin+'/api/config')).json();
assert.ok(after.configured&&after.ttsConfigured&&after.chatConfigured,'all engines remain ready after replies and speech');
console.log('PASS: real vLLM general questions stream correctly; Malay GPU TTS returns audio; ASR/chat/TTS remain ready.');
