import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanPcmWav} from '../tools/audio-cleanup.js';
test('audio cleanup keeps voiced content, trims quiet tail and fades to zero',()=>{
  const sr=24000,pcm=Buffer.alloc(sr*2*2);
  for(let i=0;i<sr;i++)pcm.writeInt16LE(Math.round(Math.sin(i*.05)*12000),i*2);
  const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+pcm.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(sr,24);header.writeUInt32LE(sr*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
  const result=cleanPcmWav(Buffer.concat([header,pcm]));
  assert.ok(result.length>44+sr*2);assert.ok(result.length<44+sr*2*1.2);
  assert.equal(result.readInt16LE(result.length-2),0);
  assert.equal(result.readUInt32LE(4),result.length-8);
  assert.equal(result.readInt16LE(44+100),pcm.readInt16LE(100));
});
test('a spurious noise burst after a long end pause is excluded',()=>{
  const sr=16000,pcm=Buffer.alloc(sr*6*2);
  for(let i=0;i<sr*2;i++)pcm.writeInt16LE(Math.round(Math.sin(i*.05)*9000),i*2);
  for(let i=sr*5;i<sr*5.2;i++)pcm.writeInt16LE(7000,i*2);
  const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+pcm.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(sr,24);header.writeUInt32LE(sr*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
  const result=cleanPcmWav(Buffer.concat([header,pcm]));
  assert.ok(result.length<44+sr*2*2.2);
  assert.equal(result.readInt16LE(result.length-2),0);
});
