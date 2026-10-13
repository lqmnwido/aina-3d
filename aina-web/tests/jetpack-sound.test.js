import {test} from 'node:test';import assert from 'node:assert/strict';
import {JetpackSound} from '../src/jetpack-sound.js';
test('jetpack uses the unlocked context, fades out before video and cleans up',()=>{
  const nodes=[],gains=[];
  const parameter=()=>({value:0,events:[],setValueAtTime(...args){this.events.push(args);},linearRampToValueAtTime(...args){this.events.push(args);},exponentialRampToValueAtTime(...args){this.events.push(args);}});
  const node=()=>{const value={gain:parameter(),frequency:parameter(),Q:parameter(),connect(){},disconnect(){this.disconnected=true;},start(time){this.started=time;},stop(time){this.stopped=time;}};nodes.push(value);return value;};
  const context={currentTime:4,sampleRate:16000,destination:{},createBuffer:(_,length)=>({getChannelData:()=>new Float32Array(length)}),createBufferSource:node,createBiquadFilter:node,createOscillator:node,createGain(){const result=node();gains.push(result);return result;}};
  const sound=new JetpackSound();sound.prepare(context);const buffer=sound.buffer;
  sound.play(context);assert.equal(sound.buffer,buffer);assert.deepEqual(gains[0].gain.events.at(-1),[0,7.2]);
  assert.equal(nodes.filter(n=>n.started===4).length,3);
  sound.stop();assert.ok(nodes.every(n=>n.disconnected));sound.stop();
  sound.play(context,{landing:true});assert.equal(gains[3].gain.events[1][0],.065);sound.stop();
});
