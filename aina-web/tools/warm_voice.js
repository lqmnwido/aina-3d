// Run while idle: serialize fixed-line synthesis instead of loading another
// copy of the model. Normal requests reuse the same voice-specific disk cache.
import {LAUNCH_ACK,LANDING_MESSAGE} from '../src/launch.js';
import {THANKS_REPLY} from '../src/social-replies.js';
const lines=process.argv.length>2?process.argv.slice(2):['Hi, Saya Aina! Apa yang saya boleh bantu?',LAUNCH_ACK,LANDING_MESSAGE,THANKS_REPLY,'Satu tambah satu adalah dua.'];
let ready=false;
for(let attempt=0;attempt<120;attempt++){
  try{ready=(await(await fetch('http://127.0.0.1:8766/health',{signal:AbortSignal.timeout(1500)})).json()).ready;}catch{}
  if(ready)break;
  if(attempt%20===0)console.log('Waiting for local voice worker...');
  await new Promise(resolve=>setTimeout(resolve,1000));
}
if(!ready)throw new Error('TTS worker did not become ready');
for(const text of lines){
  const start=performance.now();
  const response=await fetch('http://127.0.0.1:8766/tts',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({text}),signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw new Error(`${text}: ${await response.text()}`);
  const audio=await response.arrayBuffer();
  console.log(JSON.stringify({text,seconds:(performance.now()-start)/1000,bytes:audio.byteLength,
    generationSeconds:response.headers.get('X-Generation-Seconds')}));
}
