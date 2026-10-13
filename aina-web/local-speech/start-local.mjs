import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {existsSync} from 'node:fs';
import 'dotenv/config';
import {vllmArgs,vllmStopArgs} from './wsl-launch.js';
const folder=path.dirname(fileURLToPath(import.meta.url));const root=path.dirname(folder);
const children=[];
const tunnelConfig=path.join(root,'cloudflare','config.yml');
const publicMode=existsSync(tunnelConfig);
if(publicMode){
  const build=spawnSync(process.execPath,[path.join(root,'node_modules','vite','bin','vite.js'),'build'],{cwd:root,windowsHide:true,stdio:'inherit'});
  if(build.status!==0)throw new Error('Frontend build failed; public tunnel was not started.');
}
let nativeASR=false;
let nativeChat=false;
async function available(url){try{return (await fetch(url,{signal:AbortSignal.timeout(1500)})).ok;}catch{return false;}}
function run(executable,args,label){
  const child=spawn(executable,args,{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,PYTHONUNBUFFERED:'1',HF_HUB_OFFLINE:'1',TOKENIZERS_PARALLELISM:'false',ASR_PROVIDER:'local',TTS_PROVIDER:'local',CHAT_PROVIDER:'vllm'}});
  child.stdout.on('data',data=>process.stdout.write(`[${label}] ${data}`));child.stderr.on('data',data=>process.stderr.write(`[${label}] ${data}`));
  child.on('error',e=>console.error(`${label} failed:`,e.message));child.on('exit',code=>console.log(`${label} exited (${code})`));children.push(child);
  return child;
}
for(const name of ['asr','tts']){
  if(await available((name==='asr'?(process.env.LOCAL_ASR_URL||'http://127.0.0.1:8765'):(process.env.LOCAL_TTS_URL||'http://127.0.0.1:8766'))+'/health')){
    console.log(`Reusing running ${name.toUpperCase()} service`);continue;
  }
  if(name==='asr'&&process.env.AINA_ASR_BACKEND==='vllm'&&!process.argv.includes('--fallback-asr')){
    nativeASR=true;
    run('wsl.exe',vllmArgs(path.join(folder,'asr_vllm_server.py')),'ASR vLLM');continue;
  }
  const python=path.join(folder,`.venv-${name}`,'Scripts','python.exe');
  if(!existsSync(python))throw new Error(`Missing ${name} environment. See local-speech/README.md.`);
  run(python,[path.join(folder,`${name}_server.py`)],name.toUpperCase());
}
if(await available((process.env.LOCAL_CHAT_URL||'http://127.0.0.1:8768')+'/health'))console.log('Reusing running vLLM chat service');
else{nativeChat=true;run('wsl.exe',vllmArgs(path.join(folder,'chat_vllm_server.py')),'Chat vLLM');}
if(await available(`http://127.0.0.1:${process.env.PORT||5173}/api/config`))console.log('Reusing running AINA web server');
else run(process.execPath,[path.join(root,'server','index.js'),...(publicMode?['--production']:[])],'React');
if(publicMode){
  run('cloudflared',['tunnel','--config',tunnelConfig,'--no-autoupdate','run'],'Cloudflare');
  console.log('Public AINA: https://gimmick.kohich.site (requires this PC and local AI services to stay running).');
}
console.log('AINA local stack: http://localhost:5173. First model load may take a minute.');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{
  if(nativeASR){
    // Terminating wsl.exe alone need not stop its Linux GPU worker.
    const shutdown=spawn('wsl.exe',vllmStopArgs(path.join(folder,'asr_vllm_server.py')),{windowsHide:true,stdio:'ignore'});
    shutdown.on('error',error=>console.error('Native ASR shutdown failed:',error.message));
  }
  for(const child of children)child.kill();setTimeout(()=>process.exit(),1500).unref();
  if(nativeChat){const shutdown=spawn('wsl.exe',vllmStopArgs(path.join(folder,'chat_vllm_server.py')),{windowsHide:true,stdio:'ignore'});shutdown.on('error',error=>console.error('Chat shutdown failed:',error.message));}
});
