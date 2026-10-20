import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {cleanPcmWav} from './audio-cleanup.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'../output/audio/yb-menteri');
await mkdir(out,{recursive:true});
for(const name of ['welcome','instruction']){
  // Keep the already approved instruction take: its wording is unchanged and
  // the fresh experimental Malay take drifted on the proper name.
  const input=name==='instruction'
    ?path.join(root,'public/audio/aina-ybm-instruction-hi-tone-v1.wav')
    :path.join(out,`${name}-raw.wav`);
  const cleaned=cleanPcmWav(await readFile(input));
  const sr=cleaned.readUInt32LE(24),data=cleaned.subarray(44);
  // Remove quiet recording pre-roll but keep 35 ms ahead of the first voiced window.
  const window=Math.round(sr*.01);let first=0;
  for(let start=0;start<data.length/2;start+=window){
    const end=Math.min(data.length/2,start+window);let sum=0;
    for(let i=start;i<end;i++)sum+=(data.readInt16LE(i*2)/32768)**2;
    if(Math.sqrt(sum/(end-start))>.009){first=Math.max(0,start-Math.round(sr*.035));break;}
  }
  const pcm=Buffer.from(data.subarray(first*2)),fade=Math.min(pcm.length/2,Math.round(sr*.005));
  for(let i=0;i<fade;i++)pcm.writeInt16LE(Math.round(pcm.readInt16LE(i*2)*(.5-.5*Math.cos(Math.PI*i/(fade-1)))),i*2);
  const header=Buffer.from(cleaned.subarray(0,44));header.writeUInt32LE(pcm.length+36,4);header.writeUInt32LE(pcm.length,40);
  const result=Buffer.concat([header,pcm]);
  await writeFile(path.join(root,`public/audio/aina-yb-menteri-${name}-happy-v1.wav`),result);
  console.log(`${name}: ${(pcm.length/(sr*2)).toFixed(3)} seconds, clean edges; app plays 1.06x`);
}
