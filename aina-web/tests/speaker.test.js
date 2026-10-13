import test from 'node:test';
import assert from 'node:assert/strict';
import {Speaker,motion} from '../src/speech.js';
import {speechSegments} from '../src/speech-segments.js';

test('local speech prefetches one segment and resolves only after final playback',async()=>{
  const originals=new Map(),sources=[],requests=[],states=[];
  const mock=(name,value)=>{originals.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});};
  mock('window',{speechSynthesis:{cancel(){}}});
  mock('requestAnimationFrame',()=>1);mock('cancelAnimationFrame',()=>{});
  mock('fetch',async(_url,options)=>{
    requests.push({text:JSON.parse(options.body).text,signal:options.signal});
    return {ok:true,headers:{get:()=> 'audio/wav'},arrayBuffer:async()=>new ArrayBuffer(8)};
  });
  mock('AudioContext',class{
    currentTime=0;resume=async()=>{};decodeAudioData=async()=>({duration:2});
    createBufferSource(){const source={playbackRate:{},connect(){},disconnect(){},start(){},stop(){this.onended?.();}};sources.push(source);return source;}
    createAnalyser(){return {fftSize:512,connect(){},disconnect(){},getFloatTimeDomainData(array){array.fill(0);}};}
  });
  const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
  const text='Saya boleh membantu anda. '+'Ini penerangan mesra untuk anda. '.repeat(6).trim();
  const segments=speechSegments(text);
  const speaker=new Speaker(value=>states.push(value));let finished=false;
  try{
    const completion=speaker.speak(text,'local',undefined,'annoyed').then(()=>{finished=true;});
    await flush();
    assert.equal(sources.length,1);
    assert.equal(motion.expression,'annoyed','facial expression starts with voice playback');
    assert.equal(requests.length,2,'only one segment is prefetched');
    assert.equal(finished,false);
    for(let i=0;i<segments.length;i++){
      assert.equal(sources.length,i+1);
      assert.equal(finished,false,'flight cannot start before playback completes');
      sources[i].onended();await flush();
    }
    await completion;
    assert.deepEqual(requests.map(request=>request.text),segments);
    assert.equal(new Set(requests.map(request=>request.signal)).size,1);
    assert.equal(states.at(-1),false);assert.equal(motion.speaking,false);
    assert.equal(motion.expression,'neutral','facial expression resets after the final playback');
  }finally{
    speaker.stop();
    for(const[name,descriptor]of originals)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];
  }
});
