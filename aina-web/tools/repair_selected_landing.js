import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {cleanPcmWav} from './audio-cleanup.js';
import {LANDING_MESSAGE} from '../src/launch.js';
const hype=process.argv.includes('--hype');
const spoken=hype?'Terima kasih kepada semua pihak!!':'Terima kasih!';
const response=await fetch('http://127.0.0.1:8766/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:spoken,style:'excited'}),signal:AbortSignal.timeout(60000)});
if(!response.ok)throw new Error(await response.text());
const patch=cleanPcmWav(Buffer.from(await response.arrayBuffer()));
await writeFile(`../output/audio/vituti/${hype?'terima-kasih-hype-phrase':'terima-kasih-patch'}.wav`,patch);
function pcm(wav){
  for(let offset=12;offset+8<=wav.length;){const size=wav.readUInt32LE(offset+4);if(wav.toString('ascii',offset,offset+4)==='data')return wav.subarray(offset+8,offset+8+size);offset+=8+size+(size%2);}throw new Error('Missing PCM');
}
const original=pcm(await readFile('public/audio/vituti-landing-32679af23c27.wav'));
const phrase=pcm(patch);const sr=24000;
const slice=(start,end)=>Buffer.from(original.subarray(Math.round(start*sr)*2,Math.round(end*sr)*2));
function fade(bytes){
  const result=Buffer.from(bytes),samples=result.length/2,n=Math.min(Math.round(sr*.015),Math.floor(samples/2));
  for(let i=0;i<n;i++){
    const gain=.5-.5*Math.cos(Math.PI*i/(n-1));
    result.writeInt16LE(Math.round(result.readInt16LE(i*2)*gain),i*2);
    const end=(samples-1-i)*2;result.writeInt16LE(Math.round(result.readInt16LE(end)*gain),end);
  }
  return result;
}
const data=Buffer.concat(hype?[fade(slice(1.105,4.24)),Buffer.alloc(sr*2*.16),fade(phrase)]:[fade(slice(1.105,4.24)),Buffer.alloc(sr*2*.20),fade(phrase),Buffer.alloc(sr*2*.05),fade(slice(7.035,8.69))]);
const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+data.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(sr,24);header.writeUInt32LE(sr*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(data.length,40);
const wav=Buffer.concat([header,data]),hash=createHash('sha256').update(wav).digest('hex');
const filename=`vituti-landing-selected-${hype?'hype':'clean'}-${hash.slice(0,12)}.wav`;
await writeFile('public/audio/'+filename,wav);await writeFile('../output/audio/vituti/'+filename,wav);
const info={text:LANDING_MESSAGE,url:'/audio/'+filename,source:'vituti-landing-32679af23c27.wav',duration:data.length/(sr*2),replacement:spoken,preservedRanges:hype?[[1.105,4.24]]:[[1.105,4.24],[7.035,8.69]],sha256:hash};
await writeFile(`../output/audio/vituti/selected-${hype?'hype':'clean'}-landing.json`,JSON.stringify(info,null,2));
console.log(JSON.stringify(info));
