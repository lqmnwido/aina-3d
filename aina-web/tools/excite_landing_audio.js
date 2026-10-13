import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {LANDING_MESSAGE} from '../src/launch.js';
const input='public/audio/vituti-landing-da3726669199.wav';
// A gently varying, brighter pitch contour instead of a uniform speed lift.
// Preserve formants to retain AINA's timbre; keep the actual wording unchanged.
const contour=[[0,1.11],[.3,1.16],[.75,1.12],[1.15,1.07],[1.65,1.12],[2.1,1.16],[2.65,1.09],[3.05,1.17],[3.45,1.14],[4,1.09],[4.65,1.14],[5.6,1.08]];
const commands=[];
for(let time=0;time<=5.6;time+=.08){
  let index=0;while(index+1<contour.length&&contour[index+1][0]<time)index++;
  const [start,a]=contour[index],[end,b]=contour[Math.min(index+1,contour.length-1)];
  const progress=end===start?0:Math.min(1,(time-start)/(end-start));
  commands.push(`${time.toFixed(3)} rubberband pitch ${(a+(b-a)*progress).toFixed(4)}`);
}
const filter='[0:a]atrim=end=0.852,asetpts=PTS-STARTPTS[a];'+
  '[0:a]atrim=start=1.098,asetpts=PTS-STARTPTS[b];'+
  '[a][b]acrossfade=d=0.008:c1=tri:c2=tri,'+
  `asendcmd=c='${commands.join(';')}',`+
  'rubberband=tempo=1.10:pitch=1.11:formant=preserved:smoothing=on,'+
  'equalizer=f=3000:t=q:w=1:g=1.2,alimiter=limit=0.92:level=false,'+
  'afade=t=in:d=0.012[out]';
const result=spawnSync('ffmpeg',['-v','error','-i',input,'-filter_complex',filter,'-map','[out]','-ac','1','-c:a','pcm_s16le','-f','wav','pipe:1'],{windowsHide:true,maxBuffer:3000000});
if(result.status!==0)throw new Error(result.stderr.toString());
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
const name=`vituti-landing-celebration-${hash.slice(0,12)}.wav`;
await writeFile('public/audio/'+name,finalized);
await writeFile('../output/audio/vituti/'+name,finalized);
const metadata={text:LANDING_MESSAGE,url:'/audio/'+name,duration:data.length/fmt.readUInt32LE(8),source:input,tempo:1.10,pitchContour:contour,delivery:'celebration',sha256:hash};
await writeFile('../output/audio/vituti/celebration-landing.json',JSON.stringify(metadata,null,2));
console.log(JSON.stringify(metadata));
