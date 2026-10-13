import {readFile,writeFile} from 'node:fs/promises';
const folder='../output/audio/aina-dialogue4/';
const input=await readFile(folder+'aina-ybm-hype-excited-raw.wav'),clear=await readFile(folder+'aina-ybm-hype-clear-raw.wav'),sr=input.readUInt32LE(24);
// YBM finishes at 2.376 s; the next sentence starts at 2.442 s.
// Keep both parts at their native voice pitch/tempo and pause during playback.
const ranges=[['welcome',.126,2.396,input],['instruction',2.30,5.483,clear]],clips=[];
for(const [name,start,end,source] of ranges){
  const pcm=source.subarray(44);
  const data=Buffer.from(pcm.subarray(Math.round(start*sr)*2,Math.round(end*sr)*2)),fade=Math.round(sr*.005);
  for(let i=0;i<fade;i++){
    const gain=.5-.5*Math.cos(Math.PI*i/(fade-1)),last=data.length-2-i*2;
    data.writeInt16LE(Math.round(data.readInt16LE(i*2)*gain),i*2);data.writeInt16LE(Math.round(data.readInt16LE(last)*gain),last);
  }
  const header=Buffer.from(input.subarray(0,44));header.writeUInt32LE(data.length+36,4);header.writeUInt32LE(data.length,40);
  const wav=Buffer.concat([header,data]);clips.push(data);
  await writeFile('public/audio/aina-ybm-'+name+'-hype-v1.wav',wav);await writeFile(folder+'aina-ybm-'+name+'-hype-v1.wav',wav);
  console.log(name+': '+(data.length/(sr*2)).toFixed(3)+'s; new native excited voice');
}
const data=Buffer.concat([clips[0],Buffer.alloc(Math.round(sr*.4)*2),clips[1]]),header=Buffer.from(input.subarray(0,44));
header.writeUInt32LE(data.length+36,4);header.writeUInt32LE(data.length,40);
const preview=Buffer.concat([header,data]);
await writeFile(folder+'aina-ybm-hype-400ms-preview.wav',preview);await writeFile('public/audio/aina-ybm-hype-400ms-preview.wav',preview);
