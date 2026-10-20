// Finish a fresh welcome with minimal processing and optional gentle tempo lift.
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {cleanPcmWav} from './audio-cleanup.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'../output/audio/yb-menteri');
const publicAudio=path.join(root,'public/audio');
const take=process.argv[2]||'natural';
if(!['natural','bright','happy','hype'].includes(take))throw Error('Unexpected voice take');
const happy=['happy','hype'].includes(take);
const version=happy?'v6':'v5',label=happy?'happy':'fluent';
const filtered=path.join(out,`welcome-${take}-${version}-filtered.wav`);
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',path.join(out,`welcome-${take}-${version}-raw.wav`),'-af',happy?'highpass=f=55,atempo=1.04':'highpass=f=55','-c:a','pcm_s16le',filtered]);
const source=cleanPcmWav(readFileSync(filtered));
const sr=source.readUInt32LE(24);
if(sr!==24000)throw Error('Expected 24kHz speech');
let data=Buffer.from(source.subarray(44));
const window=240;let first=0;
for(let start=0;start<data.length/2;start+=window){
  const end=Math.min(data.length/2,start+window);let sum=0;
  for(let i=start;i<end;i++)sum+=(data.readInt16LE(i*2)/32768)**2;
  if(Math.sqrt(sum/(end-start))>.009){first=Math.max(0,start-840);break;}
}
data=Buffer.from(data.subarray(first*2));
let peak=0;
for(let i=0;i<data.length;i+=2)peak=Math.max(peak,Math.abs(data.readInt16LE(i)));
const gain=Math.min(1,26028/peak);
for(let i=0;i<data.length;i+=2)data.writeInt16LE(Math.round(data.readInt16LE(i)*gain),i);
for(const [atEnd,ms] of [[false,8],[true,15]]){
  const count=Math.min(data.length/2,Math.round(sr*ms/1000));
  for(let i=0;i<count;i++){
    const index=atEnd?data.length-2-i*2:i*2;
    const fade=.5-.5*Math.cos(Math.PI*i/(count-1));
    data.writeInt16LE(Math.round(data.readInt16LE(index)*fade),index);
  }
}
function wav(pcm){
  const header=Buffer.from(source.subarray(0,44));
  header.writeUInt32LE(pcm.length+36,4);header.writeUInt32LE(pcm.length,40);
  return Buffer.concat([header,pcm]);
}
function pcm(wav){
  for(let offset=12;offset+8<=wav.length;){
    const size=wav.readUInt32LE(offset+4);
    if(wav.toString('ascii',offset,offset+4)==='data')return wav.subarray(offset+8,offset+8+size);
    offset+=8+size+(size%2);
  }
  throw Error('Missing PCM');
}
writeFileSync(path.join(publicAudio,`aina-yb-menteri-welcome-${label}-${version}.wav`),wav(data));
const instruction=pcm(readFileSync(path.join(publicAudio,'aina-yb-menteri-instruction-smooth-v4.wav')));
writeFileSync(path.join(publicAudio,`aina-yb-menteri-${label}-400ms-preview-${version}.wav`),wav(Buffer.concat([data,Buffer.alloc(19200),instruction])));
console.log(`Welcome ${(data.length/48000).toFixed(3)}s; ${happy?'4% faster, pitch preserved':'native cadence'}; 400ms gap; approved instruction retained.`);
