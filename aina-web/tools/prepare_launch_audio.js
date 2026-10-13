// Generate fixed utterances once through the existing GPU worker; do not
// load a second model. Copy verified WAVs to the web's static audio directory.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {LAUNCH_ACK,LANDING_MESSAGE} from '../src/launch.js';
import {SCRIPTED_HELP} from '../src/scripted-replies.js';
import {cleanPcmWav} from './audio-cleanup.js';
let health;
for(let attempt=0;attempt<150;attempt++){
  try{health=await(await fetch('http://127.0.0.1:8766/health',{signal:AbortSignal.timeout(2000)})).json();}catch{}
  if(health?.ready)break;
  if(attempt%20===0)console.log('Waiting for the approved voice worker...');
  await new Promise(resolve=>setTimeout(resolve,1000));
}
if(!health?.ready)throw new Error('Voice worker did not become ready');
if(!health.ready||health.voice_profile!=='aina-dialogue4-malay')throw new Error('Expected AINA’s approved, ready local voice.');
await mkdir('public/audio',{recursive:true});
await mkdir('../output/audio/vituti',{recursive:true});
const results=[];
for(const [name,text] of [['vituti-launch',LAUNCH_ACK],['vituti-landing',LANDING_MESSAGE],['aina-unknown',SCRIPTED_HELP]]){
  const started=performance.now();
  const style=name==='vituti-landing'?'excited':name==='aina-unknown'?'annoyed':'launch';
  const parts=name==='vituti-landing'?['ViTuTi telah berjaya dilancarkan!','Terima kasih kepada semua pihak!']:[text];
  const clips=[];
  for(const part of parts){
  if(name==='aina-unknown'){
    // Retain the annoyance take that Malay ASR recognized correctly.
    clips.push(cleanPcmWav(await readFile('public/audio/aina-unknown-35362656a219.wav')));
    continue;
  }
  const response=await fetch('http://127.0.0.1:8766/tts',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({text:part,style}),signal:AbortSignal.timeout(90000)});
  if(!response.ok)throw new Error(`${name}: ${await response.text()}`);
  clips.push(cleanPcmWav(Buffer.from(await response.arrayBuffer())));
  }
  let wav=clips[0];
  if(clips.length>1){
    const chunk=(clip,id)=>{for(let offset=12;offset+8<=clip.length;){const size=clip.readUInt32LE(offset+4);if(clip.toString('ascii',offset,offset+4)===id)return clip.subarray(offset+8,offset+8+size);offset+=8+size+(size%2);}throw new Error('Missing WAV chunk');};
    const fmt=chunk(wav,'fmt '),rate=fmt.readUInt32LE(8);
    if(clips.some(clip=>!chunk(clip,'fmt ').equals(fmt)))throw new Error('Mismatched audio formats');
    const pause=Buffer.alloc(Math.round(rate*.18/2)*2);
    const pcm=Buffer.concat(clips.flatMap((clip,index)=>index?[pause,chunk(clip,'data')]:[chunk(clip,'data')]));
    const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+pcm.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);fmt.copy(header,20,0,16);header.write('data',36);header.writeUInt32LE(pcm.length,40);wav=Buffer.concat([header,pcm]);
  }
  if(wav.toString('ascii',0,4)!=='RIFF'||wav.toString('ascii',8,12)!=='WAVE')throw new Error('Invalid WAV');
  let byteRate=0,data=null;
  for(let offset=12;offset+8<=wav.length;){
    const id=wav.toString('ascii',offset,offset+4),size=wav.readUInt32LE(offset+4),start=offset+8;
    if(start+size>wav.length)throw new Error('Truncated WAV');
    if(id==='fmt '){
      if(wav.readUInt16LE(start)!==1||wav.readUInt16LE(start+14)!==16)throw new Error('Expected PCM16');
      byteRate=wav.readUInt32LE(start+8);
    }
    if(id==='data')data=wav.subarray(start,start+size);
    offset=start+size+(size%2);
  }
  if(!data?.length||!byteRate)throw new Error('Empty speech');
  if(data.length/byteRate<text.split(/\s+/).length*.18)throw new Error('Generated utterance is too short; keep the previous approved audio.');
  let peak=0;for(let offset=0;offset+2<=data.length;offset+=2)peak=Math.max(peak,Math.abs(data.readInt16LE(offset)));
  if(peak<32)throw new Error('Silent speech');
  const sha=createHash('sha256').update(wav).digest('hex');
  // Content-addressed names prevent Cloudflare/browser stale-audio caching.
  const filename=`${name}-${sha.slice(0,12)}.wav`;
  await writeFile(`public/audio/${filename}`,wav);
  await writeFile(`../output/audio/vituti/${filename}`,wav);
  const result={text,url:`/audio/${filename}`,sha256:sha,duration:data.length/byteRate,
    requestSeconds:(performance.now()-started)/1000};
  results.push(result);console.log(JSON.stringify(result));
}
await writeFile('../output/audio/vituti/prepared-lines.json',JSON.stringify({voice:health.voice_profile,lines:results},null,2));
