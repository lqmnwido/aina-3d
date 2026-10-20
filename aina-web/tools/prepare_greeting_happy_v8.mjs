import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {cleanPcmWav} from './audio-cleanup.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function wav(data){
  const h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(data.length+36,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);
  h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(24000,24);h.writeUInt32LE(48000,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(data.length,40);
  return Buffer.concat([h,data]);
}
const names=[process.argv[2]||'welcome',process.argv[3]||'instruction'];
const version=process.argv[4]||'v8';
if(!['v8','v9','v10'].includes(version))throw Error('Invalid version');
if(!/^welcome(-alt)?$/.test(names[0])||!/^instruction(-alt)?$/.test(names[1]))throw Error('Invalid take');
const clips=names.map((name,index)=>{
  const source=cleanPcmWav(readFileSync(path.join(root,`../output/audio/yb-menteri/${name}-${version}-raw.wav`)));
  if(source.readUInt32LE(24)!==24000)throw Error('Expected 24kHz');
  const data=Buffer.from(source.subarray(44));
  let peak=0;
  for(let i=0;i<data.length;i+=2)peak=Math.max(peak,Math.abs(data.readInt16LE(i)));
  const gain=Math.min(1,26028/peak),samples=data.length/2;
  for(let i=0;i<samples;i++){
    const fade=Math.min(1,i/192,(samples-1-i)/360);
    data.writeInt16LE(Math.round(data.readInt16LE(i*2)*gain*Math.max(0,fade)),i*2);
  }
  writeFileSync(path.join(root,`public/audio/aina-yb-menteri-${index?'instruction':'welcome'}-happy-${version}.wav`),wav(data));
  console.log(`${name}: ${(samples/24000).toFixed(3)}s; full phrase, no word splices or pitch/time effects`);
  return data;
});
writeFileSync(path.join(root,`public/audio/aina-yb-menteri-happy-400ms-preview-${version}.wav`),wav(Buffer.concat([clips[0],Buffer.alloc(19200),clips[1]])));
