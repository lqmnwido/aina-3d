import test from 'node:test';
import assert from 'node:assert/strict';
import {Speaker,motion} from '../src/speech.js';
import {LAUNCH_ACK} from '../src/launch.js';
import {SCRIPTED_AUDIO} from '../src/scripted-audio.js';

test('prepared playback waits for audio completion, reuses cached WAVs and never calls an AI endpoint',async()=>{
  const originals=new Map(),sources=[],requests=[],states=[];
  const mock=(name,value)=>{originals.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});};
  mock('requestAnimationFrame',()=>1);mock('cancelAnimationFrame',()=>{});
  mock('fetch',async url=>{requests.push(url);return {ok:true,headers:{get:()=> 'audio/wav'},arrayBuffer:async()=>new ArrayBuffer(8)};});
  mock('AudioContext',class{
    currentTime=0;resume=async()=>{};decodeAudioData=async()=>({duration:2});
    createBufferSource(){const source={playbackRate:{},connect(){},disconnect(){},start(){},stop(){this.onended?.();}};sources.push(source);return source;}
    createAnalyser(){return {fftSize:512,connect(){},disconnect(){},getFloatTimeDomainData(array){array.fill(0);}};}
  });
  const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
  const speaker=new Speaker(value=>states.push(value));
  try{
    let finished=false;
    const completion=speaker.speak(LAUNCH_ACK,'local',undefined,'cheerful').then(()=>{finished=true;});
    await flush();assert.equal(finished,false);assert.equal(sources.length,1);assert.equal(motion.speaking,true);
    assert.equal(sources[0].playbackRate.value,1.06);
    sources[0].onended();await completion;
    assert.equal(finished,true);assert.equal(motion.speaking,false);assert.equal(states.at(-1),false);
    const second=speaker.speak(LAUNCH_ACK,'local',undefined,'natural');await flush();
    assert.equal(sources[1].playbackRate.value,1);sources[1].onended();await second;
    assert.deepEqual(requests,[SCRIPTED_AUDIO.get(LAUNCH_ACK)],'second playback reuses the decoded local WAV');
    await assert.rejects(speaker.speak('Unrecorded phrase','local'),/Rakaman/);
    assert.equal(requests.length,1,'unknown speech cannot fall back to live TTS');
  }finally{
    speaker.stop();
    for(const[name,descriptor]of originals)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];
  }
});
