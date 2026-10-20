// Preserve the approved performance. Gentle EQ/dynamics only; no synthetic
// pitch shifting. Bake the 6% tempo increase so browser playback stays at 1x.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const folder=path.join(root,'public/audio');
const trimIntro=process.argv.includes('--trim-intro');
const denoise=process.argv.includes('--denoise')||trimIntro;
const version=trimIntro?'smooth-v4':denoise?'clean-v3':'clear-v2';
const clips=[];
function pcm(wav){
  for(let offset=12;offset+8<=wav.length;){
    const size=wav.readUInt32LE(offset+4);
    if(wav.toString('ascii',offset,offset+4)==='data')return wav.subarray(offset+8,offset+8+size);
    offset+=8+size+(size%2);
  }
  throw Error('Missing WAV data');
}
const filter=[
  denoise?'highpass=f=80':'highpass=f=65',
  ...(denoise?['afftdn=nr=10:nf=-42:tn=1:gs=6','agate=threshold=0.003:ratio=2:attack=8:release=100:range=0.08']:[]),
  'equalizer=f=280:t=q:w=0.8:g=-1',
  'equalizer=f=2600:t=q:w=0.8:g=1.2',
  'lowpass=f=10500',
  'acompressor=threshold=0.18:ratio=1.4:attack=15:release=100:makeup=1.08',
  'atempo=1.06',
  'alimiter=limit=0.95:level=false:latency=true',
  'afade=t=in:d=0.008','areverse','afade=t=in:d=0.015','areverse',
].join(',');
for(const name of ['welcome','instruction']){
  const output=path.join(folder,`aina-yb-menteri-${name}-${version}.wav`);
  // Explicitly remove the isolated generated pre-roll, not just quiet samples.
  // Applied to the native-speed source before tempo processing and fades.
  const processing=trimIntro&&name==='welcome'?'atrim=start=1.03,asetpts=PTS-STARTPTS,'+filter:filter;
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',path.join(folder,`aina-yb-menteri-${name}-happy-v1.wav`),'-af',processing,'-ar','24000','-ac','1','-c:a','pcm_s16le',output]);
  const data=pcm(readFileSync(output));
  let peak=0;
  for(let i=0;i<data.length;i+=2)peak=Math.max(peak,Math.abs(data.readInt16LE(i)));
  if(!data.length||peak>=32767)throw Error('Empty or clipped processed audio');
  console.log(`${name}: ${(data.length/48000).toFixed(3)} s, peak ${(20*Math.log10(peak/32768)).toFixed(2)} dBFS`);
  clips.push(data);
}
const gap=Buffer.alloc(24000*.4*2);
const data=Buffer.concat([clips[0],gap,clips[1]]);
const header=Buffer.alloc(44);
header.write('RIFF');header.writeUInt32LE(data.length+36,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);
header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(24000,24);header.writeUInt32LE(48000,28);
header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(data.length,40);
writeFileSync(path.join(folder,`aina-yb-menteri-${trimIntro?'smooth-400ms-preview-v4':denoise?'clean-400ms-preview-v3':'clear-400ms-preview-v2'}.wav`),Buffer.concat([header,data]));
console.log('Preview: pitch-preserving tempo, exact 9600-sample / 400ms inter-clip gap.');
