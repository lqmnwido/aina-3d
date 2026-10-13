import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const manifest=JSON.parse(await readFile('../output/audio/vituti/prepared-lines.json','utf8'));
for(const line of manifest.lines){
  const result=spawnSync('ffmpeg',['-v','error','-i','public'+line.url,'-f','s16le','-ar','16000','-ac','1','pipe:1'],{windowsHide:true,maxBuffer:3000000});
  if(result.status!==0)throw new Error(result.stderr.toString());
  const response=await fetch('http://127.0.0.1:8765/transcribe',{method:'POST',body:result.stdout,signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(await response.text());
  const data=await response.json();console.log(JSON.stringify({expected:line.text,recognized:data.text,url:line.url}));
}
