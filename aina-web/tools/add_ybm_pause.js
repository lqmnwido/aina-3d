import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const input=await readFile('public/audio/aina-ybm-greeting-happy-v3.wav');
const rate=input.readUInt32LE(24);
// Original YBM boundary, after the existing tempo adjustment and crossfades.
const boundary=Math.round((1.25+.75/1.3-.016)*rate);
const playbackRate=1.10;
const pauseFrames=Math.round(.200*playbackRate*rate);
const pcm=input.subarray(44),before=Buffer.from(pcm.subarray(0,boundary*2)),after=Buffer.from(pcm.subarray(boundary*2));
// Tiny edge fades keep the transition into digital silence free of clicks.
const fade=Math.round(rate*.003);
for(let i=0;i<fade;i++){
  const gain=.5-.5*Math.cos(Math.PI*i/(fade-1));
  const index=before.length-2-i*2;
  before.writeInt16LE(Math.round(before.readInt16LE(index)*gain),index);
  after.writeInt16LE(Math.round(after.readInt16LE(i*2)*gain),i*2);
}
const silence=Buffer.alloc(pauseFrames*2),data=Buffer.concat([before,silence,after]);
const header=Buffer.from(input.subarray(0,44));header.writeUInt32LE(data.length+36,4);header.writeUInt32LE(data.length,40);
const result=Buffer.concat([header,data]);
assert.ok(Math.abs(pauseFrames/rate/playbackRate-.2)<1e-9);
assert.ok(data.subarray(before.length,before.length+silence.length).every(sample=>sample===0));
await writeFile('public/audio/aina-ybm-greeting-happy-v4.wav',result);
await writeFile('../output/audio/aina-dialogue4/aina-ybm-greeting-happy-v4.wav',result);
console.log('Added exactly 200 ms silence at the joyful playback rate after YBM.');
