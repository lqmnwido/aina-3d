import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {cleanPcmWav} from './audio-cleanup.js';
const folder='../output/audio/aina-dialogue4/';
for(const name of ['welcome','instruction']){
  let file=folder+'aina-ybm-400-'+name+'-raw.wav';
  if(name==='welcome'){
    file=folder+'aina-ybm-400-context-raw.wav';
    const faster=folder+'aina-ybm-400-welcome-fast.wav';
    const run=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',file,'-af','atrim=end=2.1,asetpts=PTS-STARTPTS,atempo=1.12','-c:a','pcm_s16le',faster]);
    if(run.status!==0)throw Error(run.stderr?.toString()||'Welcome tempo adjustment failed');
    file=faster;
  }
  const wav=cleanPcmWav(await readFile(file)),pcm=wav.subarray(44),sr=wav.readUInt32LE(24),window=Math.round(sr*.01);
  let first=null,last=0;
  for(let start=0;start<pcm.length/2;start+=window){
    const end=Math.min(start+window,pcm.length/2);let sum=0;
    for(let i=start;i<end;i++)sum+=(pcm.readInt16LE(i*2)/32768)**2;
    if(Math.sqrt(sum/(end-start))>.009){first??=start;last=end;}
  }
  if(first===null)throw Error('Silent recording');
  const data=Buffer.from(pcm.subarray(Math.max(0,first-Math.round(sr*.015))*2,Math.min(pcm.length/2,last+Math.round(sr*.015))*2));
  const fade=Math.round(sr*.005);
  for(let i=0;i<fade;i++){
    const gain=.5-.5*Math.cos(Math.PI*i/(fade-1)),end=data.length-2-i*2;
    data.writeInt16LE(Math.round(data.readInt16LE(i*2)*gain),i*2);
    data.writeInt16LE(Math.round(data.readInt16LE(end)*gain),end);
  }
  const header=Buffer.from(wav.subarray(0,44));header.writeUInt32LE(data.length+36,4);header.writeUInt32LE(data.length,40);
  const result=Buffer.concat([header,data]);
  await writeFile('public/audio/aina-ybm-'+name+'-400-r2.wav',result);
  await writeFile(folder+'aina-ybm-'+name+'-400-r2.wav',result);
  console.log(name+': '+(data.length/(sr*2)).toFixed(2)+'s, trimmed edges, prepared playback');
}
