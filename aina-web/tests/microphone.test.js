import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Microphone,motion,GREETING} from '../src/speech.js';
import {GREETING as serverGreeting} from '../server/qwen.js';

test('client and server use the corrected greeting',()=>assert.equal(GREETING,serverGreeting));
test('microphone forwards audio and completed turns, deduplicates, gates echo and interrupts',async()=>{
  const descriptors=new Map();
  const mock=(key,value)=>{descriptors.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});};
  let socket,node;const finals=[],statuses=[],sent=[];let interruptions=0,allow=true;
  const connector=()=>({connect(){},disconnect(){}});
  const track={enabled:true,stop(){}};let constraints;
  mock('navigator',{mediaDevices:{getUserMedia:async options=>{constraints=options;return {getTracks:()=>[track]};}}});
  mock('location',{protocol:'http:',host:'localhost:5173'});
  mock('AudioContext',class{audioWorklet={addModule:async()=>{}};resume=async()=>{};close=async()=>{};createMediaStreamSource=connector;createGain=()=>({...connector(),gain:{}});createBiquadFilter=()=>({...connector(),frequency:{},Q:{}});});
  mock('AudioWorkletNode',class{constructor(){node=this;this.port={};}connect(){}disconnect(){}});
  mock('WebSocket',class{static OPEN=1;readyState=1;bufferedAmount=0;constructor(){socket=this;}send(x){sent.push(x);}close(){}});
  const mic=new Microphone({onStatus:x=>statuses.push(x),onPartial(){},onFinal:x=>finals.push(x),onError:e=>{throw new Error(e);},shouldSend:()=>allow,onInterrupt:()=>interruptions++});
  try{
    await mic.start();socket.onmessage({data:JSON.stringify({type:'ready'})});
    const packet=new Int16Array(1600).fill(2000).buffer;
    node.port.onmessage({data:packet});assert.equal(sent.at(-1),packet);
    socket.onmessage({data:JSON.stringify({type:'speech-end'})});assert.equal(statuses.at(-1),'transcribing');
    for(let i=0;i<2;i++)socket.onmessage({data:JSON.stringify({type:'final',id:'first',text:'Apa khabar?'})});
    assert.deepEqual(finals,['Apa khabar?']);
    socket.onmessage({data:JSON.stringify({type:'speech-start',id:'late-user'})});assert.equal(statuses.at(-1),'hearing');
    allow=false;
    socket.onmessage({data:JSON.stringify({type:'final',id:'late-user',text:'Hi. Sihat ke?'})});
    assert.deepEqual(finals,['Apa khabar?','Hi. Sihat ke?'],'accepted user speech is delivered even if decoding ends during playback');
    socket.onmessage({data:JSON.stringify({type:'final',id:'echo',text:'Unaccepted playback echo'})});assert.equal(finals.length,2);
    // Thinking does not suppress the mic; playback does.
    allow=false;node.port.onmessage({data:packet});assert.equal(new Int16Array(sent.at(-1))[0],0);
    motion.speaking=true;
    for(let i=0;i<3;i++)node.port.onmessage({data:packet});
    assert.equal(interruptions,0);assert.equal(track.enabled,false);
    assert.equal(constraints.audio.noiseSuppression,true);assert.equal(constraints.audio.echoCancellation,true);
    socket.onmessage({data:JSON.stringify({type:'final',id:'blocked',text:'Interrupt Aina'})});assert.equal(finals.length,2);
    motion.speaking=false;motion.voiceActive=true;node.port.onmessage({data:packet});assert.equal(track.enabled,false);
    motion.voiceActive=false;allow=true;node.port.onmessage({data:packet});assert.equal(track.enabled,true);assert.equal(sent.at(-1),packet);
  }finally{
    mic.stop();motion.speaking=false;motion.voiceActive=false;
    for(const[key,descriptor]of descriptors)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
  }
});
