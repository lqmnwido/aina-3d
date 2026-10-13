import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {writeFile,mkdir} from 'node:fs/promises';
import {LANDING_MESSAGE} from '../src/launch.js';
// Edit the existing take: tighten only the syllable gaps in the name.
// Cuts remain within measured silence, leaving breathing room on both sides.
const input='public/audio/vituti-landing-2b80305bf2dd.wav';
const filter='[0:a]atrim=start=0:end=0.596,asetpts=PTS-STARTPTS[a];'+
  '[0:a]atrim=start=0.663:end=1.126,asetpts=PTS-STARTPTS[b];'+
  '[0:a]atrim=start=1.355:end=1.85,asetpts=PTS-STARTPTS[c];'+
  '[a][b][c]concat=n=3:v=0:a=1,atempo=1.15[name];'+
  '[0:a]atrim=start=1.85,asetpts=PTS-STARTPTS[rest];'+
  '[name][rest]concat=n=2:v=0:a=1,asetrate=24600,aresample=24000,atempo=1.025,afade=t=in:d=0.012[out]';
const result=spawnSync('ffmpeg',['-v','error','-i',input,'-filter_complex',filter,'-map','[out]','-ac','1','-c:a','pcm_s16le','-f','wav','pipe:1'],{windowsHide:true,maxBuffer:3000000});
if(result.status!==0)throw new Error(result.stderr.toString());
// Streaming WAV headers have unknown sizes; finalize a standard PCM header.
const wav=result.stdout;let data,fmt;
for(let offset=12;offset+8<=wav.length;){
  const id=wav.toString('ascii',offset,offset+4),size=wav.readUInt32LE(offset+4);
  if(id==='fmt ')fmt=wav.subarray(offset+8,offset+8+size);
  if(id==='data'){data=wav.subarray(offset+8);break;}
  offset+=8+size+(size%2);
}
if(!data?.length||!fmt)throw new Error('Missing PCM audio');
const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(data.length+36,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);fmt.copy(header,20,0,16);header.write('data',36);header.writeUInt32LE(data.length,40);
const finalized=Buffer.concat([header,data]);
const hash=createHash('sha256').update(finalized).digest('hex');
const name=`vituti-landing-happy-${hash.slice(0,12)}.wav`;
await mkdir('../output/audio/vituti',{recursive:true});
await writeFile('public/audio/'+name,finalized);
await writeFile('../output/audio/vituti/'+name,finalized);
const metadata={text:LANDING_MESSAGE,url:'/audio/'+name,duration:data.length/fmt.readUInt32LE(8),source:input,nameTempo:1.15,delivery:'bright-happy',sha256:hash};
await writeFile('../output/audio/vituti/happy-landing.json',JSON.stringify(metadata,null,2));
console.log(JSON.stringify(metadata));
