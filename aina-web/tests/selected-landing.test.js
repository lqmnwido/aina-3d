import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SCRIPTED_AUDIO} from '../src/scripted-audio.js';
import {LANDING_MESSAGE} from '../src/launch.js';
function pcm(bytes){for(let offset=12;offset+8<=bytes.length;){const size=bytes.readUInt32LE(offset+4);if(bytes.toString('ascii',offset,offset+4)==='data')return bytes.subarray(offset+8,offset+8+size);offset+=8+size+(size%2);}throw new Error('Missing PCM');}
test('selected landing keeps the original first sentence samples and clean edges',()=>{
  const source=pcm(readFileSync(new URL('../public/audio/vituti-landing-32679af23c27.wav',import.meta.url)));
  const edited=pcm(readFileSync(new URL('../public'+SCRIPTED_AUDIO.get(LANDING_MESSAGE),import.meta.url)));
  const sr=24000,start=Math.round(1.105*sr)*2,edge=Math.round(.02*sr)*2,end=Math.round(4.24*sr)*2;
  assert.deepEqual(edited.subarray(edge,end-start-edge),source.subarray(start+edge,end-edge));
  assert.equal(edited.readInt16LE(0),0);assert.equal(edited.readInt16LE(edited.length-2),0);
});
