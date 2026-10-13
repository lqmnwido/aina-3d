import {readFile,writeFile} from 'node:fs/promises';
const folder='../output/audio/aina-dialogue4/';
const take=process.argv[2]||'cheery',cut=Number(process.argv[3]||2.45);
const input=await readFile(folder+'aina-ybm-lively-'+take+'-raw.wav'),sr=input.readUInt32LE(24),pcm=input.subarray(44);
const ranges=[['welcome',.12,cut],['instruction',cut,5.57]],clips=[];
for(const [name,start,end] of ranges){
  const data=Buffer.from(pcm.subarray(Math.round(start*sr)*2,Math.round(end*sr)*2)),fade=Math.round(sr*.005);
  for(let i=0;i<fade;i++){
    const gain=.5-.5*Math.cos(Math.PI*i/(fade-1)),last=data.length-2-i*2;
    data.writeInt16LE(Math.round(data.readInt16LE(i*2)*gain),i*2);data.writeInt16LE(Math.round(data.readInt16LE(last)*gain),last);
  }
  const header=Buffer.from(input.subarray(0,44));header.writeUInt32LE(data.length+36,4);header.writeUInt32LE(data.length,40);
  const wav=Buffer.concat([header,data]);clips.push(data);
  await writeFile('public/audio/aina-ybm-'+name+'-lively-v1.wav',wav);await writeFile(folder+'aina-ybm-'+name+'-lively-v1.wav',wav);
  console.log(name+': '+(data.length/(sr*2)).toFixed(3)+'s; original expressive voice');
}
const data=Buffer.concat([clips[0],Buffer.alloc(Math.round(sr*.4)*2),clips[1]]),header=Buffer.from(input.subarray(0,44));
header.writeUInt32LE(data.length+36,4);header.writeUInt32LE(data.length,40);
const preview=Buffer.concat([header,data]);
await writeFile(folder+'aina-ybm-lively-400ms-preview.wav',preview);
await writeFile('public/audio/aina-ybm-lively-400ms-preview.wav',preview);
