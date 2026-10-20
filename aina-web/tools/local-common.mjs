import {spawn} from 'node:child_process';
import {existsSync,mkdirSync,appendFileSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const localFolder=path.join(root,'.local');
export const installStamp=path.join(localFolder,'dependencies.sha256');
export function assertNode(){
  const [major,minor]=process.versions.node.split('.').map(Number);
  if(major<22||(major===22&&minor<12))throw Error('Node.js 22.12+ required. On Windows double-click SETUP.cmd to install Node.js and npm automatically.');
}
export function dependencySignature(){
  return createHash('sha256').update(readFileSync(path.join(root,'package.json'))).update(readFileSync(path.join(root,'package-lock.json'))).update(`${process.platform}:${process.arch}:${process.versions.node.split('.')[0]}`).digest('hex');
}
export function dependenciesReady(){
  return existsSync(path.join(root,'node_modules/vite/bin/vite.js'))&&existsSync(path.join(root,'node_modules/express/package.json'))&&existsSync(installStamp)&&readFileSync(installStamp,'utf8')===dependencySignature();
}
export function markDependencies(){mkdirSync(localFolder,{recursive:true});writeFileSync(installStamp,dependencySignature());}
export function logFile(label){mkdirSync(localFolder,{recursive:true});return path.join(localFolder,`${label}.log`);}
export async function runQuiet(executable,args,label,log){
  await new Promise((resolve,reject)=>{
    const child=spawn(executable,args,{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
    let tail='';const capture=data=>{appendFileSync(log,data);tail=(tail+data.toString()).slice(-4000);};
    child.stdout.on('data',capture);child.stderr.on('data',capture);
    const stop=()=>child.kill();process.once('SIGINT',stop);process.once('SIGTERM',stop);
    const cleanup=()=>{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);};
    child.once('error',error=>{cleanup();reject(error);});
    child.once('exit',(code,signal)=>{cleanup();code===0?resolve():reject(Error(`${label} failed (${signal||code}).\n${tail}\nLog: ${log}`));});
  });
}
