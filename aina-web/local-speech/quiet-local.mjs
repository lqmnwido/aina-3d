import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {existsSync,mkdirSync,appendFileSync,readFileSync} from 'node:fs';
import 'dotenv/config';
import {vllmArgs,vllmStopArgs} from './wsl-launch.js';
import {createProgress,probe} from './startup-ui.js';
import {publicRequest} from './public-check.js';
import {needsFrontendBuild} from './build-freshness.js';
import {acquireLauncherLock} from './launcher-lock.js';

const folder=path.dirname(fileURLToPath(import.meta.url)),root=path.dirname(folder);
const tunnelConfig=path.join(root,'cloudflare','config.yml');
const publicMode=existsSync(tunnelConfig);
const tunnelHost=publicMode?readFileSync(tunnelConfig,'utf8').match(/hostname:\s*['"]?([^\s'"]+)/)?.[1]:null;
const publicURL=process.env.AINA_PUBLIC_URL||(tunnelHost?`https://${tunnelHost}`:'');
const localURL=`http://127.0.0.1:${process.env.PORT||5173}`;
const endpoints={asr:process.env.LOCAL_ASR_URL||'http://127.0.0.1:8765',tts:process.env.LOCAL_TTS_URL||'http://127.0.0.1:8766',chat:process.env.LOCAL_CHAT_URL||'http://127.0.0.1:8768'};
const progress=createProgress(),children=[],nativeWorkers=[];
const restartCounts=new Map();
const logFolder=path.join(folder,'logs');mkdirSync(logFolder,{recursive:true});
try{
  const release=acquireLauncherLock(path.join(logFolder,'launcher.lock'));
  process.on('exit',release);
}catch(error){progress.finish(error.message);process.exitCode=1;process.exit();}
const logFile=path.join(logFolder,`startup-${new Date().toISOString().replace(/[:.]/g,'-')}.log`);
const aiNames=[]; // Keyboard launch plays prepared clips; no AI worker required.
const phases=publicMode?['build',...aiNames,'web','tunnel','public']:['build',...aiNames,'web'];
const state=Object.fromEntries(phases.map(name=>[name,false]));
let fatal=null,stopping=false,finished=false,connector=false;
function log(label,data){appendFileSync(logFile,`[${label}] ${data}`);}
function draw(label){progress.update(phases.filter(name=>state[name]).length,phases.length,label);}
function run(executable,args,label,{oneShot=false}={}){
  const child=spawn(executable,args,{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,PYTHONUNBUFFERED:'1',HF_HUB_OFFLINE:'1',TOKENIZERS_PARALLELISM:'false',AINA_INPUT_MODE:'keyboard',ASR_PROVIDER:'disabled',TTS_PROVIDER:'local',CHAT_PROVIDER:'scripted'}});
  children.push(child);let tail='';
  const capture=data=>{
    log(label,data);tail=(tail+data.toString()).slice(-3000);
    if(label==='Cloudflare'&&tail.includes('Registered tunnel connection'))connector=true;
  };
  child.stdout.on('data',capture);child.stderr.on('data',capture);
  child.on('error',error=>{log(label,error.message+'\n');fatal=new Error(`${label}: ${error.message}`);if(finished)fail(fatal);});
  child.on('exit',(code,signal)=>{
    if(!stopping&&(!oneShot||code!==0)){
      const attempts=restartCounts.get(label)||0;
      if(finished&&!oneShot&&attempts<3){
        restartCounts.set(label,attempts+1);
        log(label,`Restarting after exit ${signal||code}; attempt ${attempts+1}/3\n`);
        progress.finish(`${label} disconnected; reconnecting (${attempts+1}/3).`);
        setTimeout(()=>{if(!stopping)run(executable,args,label);},2000);
        return;
      }
      fatal=new Error(`${label} stopped (${signal||code}). ${tail.slice(-1200)}`);
      if(finished)fail(fatal);
    }
  });
  return child;
}
function shutdown(code=0){
  if(stopping)return;stopping=true;
  for(const script of nativeWorkers){
    const child=spawn('wsl.exe',vllmStopArgs(script),{windowsHide:true,stdio:'ignore'});
    child.on('error',error=>log('Shutdown',error.message+'\n'));
  }
  for(const child of children)child.kill();
  setTimeout(()=>process.exit(code),1500);
}
function fail(error){
  if(stopping)return;
  progress.finish(`ERROR: ${error.message}\nDetails: ${logFile}`);
  shutdown(1);
}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>shutdown());
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
  draw('Preparing');
  if(needsFrontendBuild(root)){
    const build=run(process.execPath,[path.join(root,'node_modules','vite','bin','vite.js'),'build'],'Build',{oneShot:true});
    const code=await new Promise((resolve,reject)=>{build.once('error',reject);build.once('exit',resolve);});
    if(code!==0)throw fatal||new Error('Frontend build failed');
    state.build=true;draw('Starting services');
  }
  state.build=true;
  for(const name of aiNames){
    state[name]=(await probe(endpoints[name]+'/health')).ok;
    if(state[name])continue;
    const script=path.join(folder,`${name}_vllm_server.py`);
    if(name==='chat'||name==='asr'&&process.env.AINA_ASR_BACKEND==='vllm'&&!process.argv.includes('--fallback-asr')){
      nativeWorkers.push(script);run('wsl.exe',vllmArgs(script),name.toUpperCase());
    }else{
      const python=path.join(folder,`.venv-${name}`,'Scripts','python.exe');
      if(!existsSync(python))throw new Error(`Missing ${name} environment`);
      const cachedTTS=name==='tts'&&process.env.CHAT_PROVIDER==='scripted'&&process.env.AINA_FULL_TTS!=='1';
      run(python,[path.join(folder,cachedTTS?'cached_tts_server.py':`${name}_server.py`)],name.toUpperCase());
    }
    draw('Loading AI');
  }
  try{state.web=(await fetch(localURL+'/api/config',{signal:AbortSignal.timeout(4000)})).ok;}catch{}
  if(!state.web)run(process.execPath,[path.join(root,'server','index.js'),'--production'],'Web');
  if(publicMode){
    // Reuse an existing connector only if it actually serves the AINA page.
    connector=(await probe(publicURL,'page',publicRequest)).ok;
    if(!connector)run('cloudflared',['tunnel','--config',tunnelConfig,'--no-autoupdate','run'],'Cloudflare');
  }
  const began=Date.now();let publicBegan=0,lastPublicError='';
  while(!stopping){
    if(fatal)throw fatal;
    const checks=await Promise.all(aiNames.map(async name=>[name,(await probe(endpoints[name]+'/health')).ok]));
    for(const [name,ok] of checks)state[name]=ok;
    state.web=(await probe(localURL+'/api/config','config')).ok;
    const aiReady=checks.every(([,ok])=>ok)&&state.web;
    if(publicMode){
      state.tunnel=connector;
      if(aiReady&&connector){
        publicBegan||=Date.now();
        const [page,api]=await Promise.all([probe(publicURL,'page',publicRequest),probe(publicURL+'/api/config','config',publicRequest)]);
        state.public=page.ok&&api.ok;lastPublicError=!page.ok?page.error:api.error;
        if(!state.public&&Date.now()-publicBegan>120000)throw new Error(`Local AI is ready but ${publicURL} is unreachable (${lastPublicError}). Check this hostname's DNS tunnel route.`);
      }
    }
    const pending=phases.filter(name=>!state[name]);
    draw(pending.length?`Loading: ${pending.join(', ')}`:'Ready');
    if(!pending.length)break;
    if(Date.now()-began>15*60*1000)throw new Error(`Startup timed out waiting for: ${pending.join(', ')}`);
    await pause(1500);
  }
  if(!stopping){
    finished=true;
    progress.finish(`Ready: ${publicMode?publicURL:'http://localhost:'+(process.env.PORT||5173)} | Keep this window open. Ctrl+C to stop.`);
    setInterval(()=>{},60000);
  }
}catch(error){fail(error);}
