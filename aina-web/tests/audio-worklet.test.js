import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const code=readFileSync(new URL('../public/pcm-worklet.js',import.meta.url),'utf8');
for(const rate of [16000,44100,48000]) test(`PCM worklet keeps phase across 128-sample device blocks at ${rate} Hz`,()=>{
  const packets=[];let Processor;
  const scope={sampleRate:rate,AudioWorkletProcessor:class{constructor(){this.port={postMessage:x=>packets.push(x)};}},registerProcessor:(_name,Type)=>{Processor=Type;},DataView,ArrayBuffer,Math};
  vm.runInNewContext(code,scope);
  const processor=new Processor();const input=Float32Array.from({length:rate},(_,i)=>Math.sin(i*.073)*.5);
  for(let i=0;i<input.length;i+=128)processor.process([[input.subarray(i,i+128)]]);
  assert.ok(packets.length>=9,'at least 900 ms of audio streamed');
  const received=packets.flatMap(p=>Array.from({length:p.byteLength/2},(_,i)=>new DataView(p).getInt16(i*2,true)));
  for(let j=0;j<received.length;j++){
    const position=j*rate/16000,i=Math.floor(position),fraction=position-i;
    const x=input[i]*(1-fraction)+input[i+1]*fraction;
    const expected=Math.round(Math.max(-1,Math.min(1,x))*(x<0?32768:32767));
    assert.ok(Math.abs(received[j]-expected)<=1,`sample ${j} maintains resampling phase`);
  }
});
