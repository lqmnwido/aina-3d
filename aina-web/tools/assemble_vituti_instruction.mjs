// Reuse the approved landing pronunciation of the proper name.
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function read(file){
  const wav=readFileSync(file);let format,data;
  for(let at=12;at+8<=wav.length;){
    const size=wav.readUInt32LE(at+4),id=wav.toString('ascii',at,at+4);
    if(id==='fmt ')format=wav.subarray(at+8,at+8+size);
    if(id==='data')data=wav.subarray(at+8,at+8+size);
    at+=8+size+(size%2);
  }
  if(!format||!data||format.readUInt16LE(0)!==1||format.readUInt16LE(2)!==1||format.readUInt32LE(4)!==24000||format.readUInt16LE(14)!==16)throw Error('Expected mono PCM16/24k');
  return data;
}
const prefix=read(path.join(root,'../output/audio/yb-menteri/instruction-phonetic-v7-raw.wav')).subarray(0,Math.round(2.29*24000)*2);
const brand=Buffer.from(read(path.join(root,'public/audio/vituti-landing-selected-hype-34db74885b08.wav')).subarray(0,Math.round(.98*24000)*2));
const rms=data=>{
  let total=0;
  for(let i=0;i<data.length;i+=2)total+=data.readInt16LE(i)**2;
  return Math.sqrt(total/(data.length/2));
};
const gain=Math.max(.7,Math.min(1.2,rms(prefix)/rms(brand)));
for(let i=0;i<brand.length;i+=2)brand.writeInt16LE(Math.max(-32767,Math.min(32767,Math.round(brand.readInt16LE(i)*gain))),i);
const overlap=288; // 12 ms, inside the word-boundary pause.
const pcm=Buffer.alloc(prefix.length+brand.length-overlap*2);
prefix.copy(pcm);
for(let i=0;i<overlap;i++){
  const pos=prefix.length-overlap*2+i*2,t=i/(overlap-1);
  pcm.writeInt16LE(Math.round(prefix.readInt16LE(pos)*(1-t)+brand.readInt16LE(i*2)*t),pos);
}
brand.copy(pcm,prefix.length,overlap*2);
const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(pcm.length+36,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);
header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(24000,24);header.writeUInt32LE(48000,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
writeFileSync(path.join(root,'../output/audio/yb-menteri/instruction-approved-brand-v7-raw.wav'),Buffer.concat([header,pcm]));
console.log(`Approved brand joined at a quiet boundary with 12ms crossfade; level adjustment ${gain.toFixed(3)}.`);
