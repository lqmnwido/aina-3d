import {readFile,writeFile} from 'node:fs/promises';
const input=await readFile('public/audio/aina-ybm-greeting-happy-v3.wav');
const rate=input.readUInt32LE(24),boundary=Math.round((1.25+.75/1.3-.016)*rate)*2;
const pcm=input.subarray(44);
for(const [name,part] of [['welcome',pcm.subarray(0,boundary)],['instruction',pcm.subarray(boundary)]]){
  const data=Buffer.from(part),fade=Math.round(rate*.003);
  for(let i=0;i<fade;i++){
    const gain=.5-.5*Math.cos(Math.PI*i/(fade-1));
    const index=name==='welcome'?data.length-2-i*2:i*2;
    data.writeInt16LE(Math.round(data.readInt16LE(index)*gain),index);
  }
  const header=Buffer.from(input.subarray(0,44));header.writeUInt32LE(data.length+36,4);header.writeUInt32LE(data.length,40);
  const wav=Buffer.concat([header,data]);
  await writeFile('public/audio/aina-ybm-'+name+'.wav',wav);
  await writeFile('../output/audio/aina-dialogue4/aina-ybm-'+name+'.wav',wav);
  console.log('Prepared separate '+name+' playback; no silence inserted.');
}
