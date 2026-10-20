import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {SCRIPTED_AUDIO} from '../src/scripted-audio.js';

test('presentation bundles exactly the four active recordings with valid, unclipped WAV audio',()=>{
  assert.equal(SCRIPTED_AUDIO.size,4);
  assert.deepEqual(readdirSync(new URL('../public/audio/',import.meta.url)).sort(),[...SCRIPTED_AUDIO.values()].map(url=>url.split('/').at(-1)).sort());
  for(const url of SCRIPTED_AUDIO.values()){
    const wav=readFileSync(new URL('../public'+url,import.meta.url));
    assert.equal(wav.toString('ascii',0,4),'RIFF');assert.ok(wav.length>10000);
    let pcm;
    for(let offset=12;offset+8<=wav.length;){
      const size=wav.readUInt32LE(offset+4);
      if(wav.toString('ascii',offset,offset+4)==='data'){pcm=wav.subarray(offset+8,offset+8+size);break;}
      offset+=8+size+(size%2);
    }
    assert.ok(pcm);let peak=0;
    for(let i=0;i<pcm.length;i+=2)peak=Math.max(peak,Math.abs(pcm.readInt16LE(i)));
    assert.ok(peak>1000&&peak<32767,'audible without clipping');
  }
});
