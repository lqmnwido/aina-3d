import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {cleanPcmWav} from './audio-cleanup.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const inputs=[process.argv[2]||'welcome-phonetic',process.argv[3]||'instruction-word'];
if(!['welcome-approved','welcome-phonetic','welcome-letters','welcome-flow'].includes(inputs[0])||!['instruction-word','instruction-letters','instruction-phonetic','instruction-hyphen','instruction-approved-brand'].includes(inputs[1]))throw Error('Unexpected take');
let template;
const clips=inputs.map((name,index)=>{
  if(name==='welcome-approved'){
    const approved=readFileSync(path.join(root,'public/audio/aina-yb-menteri-welcome-fluent-v5.wav'));
    template=approved.subarray(0,44);
    writeFileSync(path.join(root,'public/audio/aina-yb-menteri-welcome-clear-v7.wav'),approved);
    console.log('welcome: exact previously approved fluent take');
    return approved.subarray(44);
  }
  const source=cleanPcmWav(readFileSync(path.join(root,`../output/audio/yb-menteri/${name}-v7-raw.wav`)));
  if(source.readUInt32LE(24)!==24000)throw Error('Expected 24kHz');
  template=source.subarray(0,44);
  let data=Buffer.from(source.subarray(44)),first=0;
  for(let start=0;start<data.length/2;start+=240){
    let energy=0;const end=Math.min(data.length/2,start+240);
    for(let i=start;i<end;i++)energy+=(data.readInt16LE(i*2)/32768)**2;
    if(Math.sqrt(energy/(end-start))>.009){first=Math.max(0,start-840);break;}
  }
  data=Buffer.from(data.subarray(first*2));
  let peak=0;
  for(let i=0;i<data.length;i+=2)peak=Math.max(peak,Math.abs(data.readInt16LE(i)));
  const gain=Math.min(1,26028/peak);
  for(let i=0;i<data.length;i+=2)data.writeInt16LE(Math.round(data.readInt16LE(i)*gain),i);
  for(const [atEnd,count] of [[false,192],[true,360]]){
    for(let i=0;i<count;i++){
      const pos=atEnd?data.length-2-i*2:i*2;
      data.writeInt16LE(Math.round(data.readInt16LE(pos)*(.5-.5*Math.cos(Math.PI*i/(count-1)))),pos);
    }
  }
  const role=index?'instruction':'welcome';
  writeFileSync(path.join(root,`public/audio/aina-yb-menteri-${role}-clear-v7.wav`),wav(data));
  console.log(`${role}: ${(data.length/48000).toFixed(3)}s, natural timing, clean edges`);
  return data;
});
function wav(data){
  const header=Buffer.from(template);header.writeUInt32LE(data.length+36,4);header.writeUInt32LE(data.length,40);
  return Buffer.concat([header,data]);
}
writeFileSync(path.join(root,'public/audio/aina-yb-menteri-clear-400ms-preview-v7.wav'),wav(Buffer.concat([clips[0],Buffer.alloc(19200),clips[1]])));
console.log('Exact 400ms gap between the two newly generated lines.');
