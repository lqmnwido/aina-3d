import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertNode,root,dependenciesReady,runQuiet,logFile} from './local-common.mjs';
import {setup} from './setup.mjs';
import {checkAssets} from './check-assets.mjs';
import {needsFrontendBuild} from '../local-speech/build-freshness.js';
import {createProgress} from '../local-speech/startup-ui.js';
export async function local(){
  assertNode();const progress=createProgress();
  if(!dependenciesReady())await setup();
  checkAssets();progress.update(1,3,'Assets ready');
  if(needsFrontendBuild(root))await runQuiet(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'build'],'Build',logFile('build'));
  progress.update(2,3,'Opening local server');
  const {startLocalServer}=await import('../server/local.js');
  const server=await startLocalServer();
  const url=`http://localhost:${server.address().port}`;
  progress.update(3,3,'Ready');progress.finish(`Ready: ${url} | Keep this window open. Ctrl+C to stop.`);
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{server.close();server.closeAllConnections();});
  if(process.argv.includes('--open')){
    const command=process.platform==='win32'?'rundll32.exe':process.platform==='darwin'?'open':'xdg-open';
    const args=process.platform==='win32'?['url.dll,FileProtocolHandler',url]:[url];
    const browser=spawn(command,args,{windowsHide:true,stdio:'ignore'});
    browser.on('error',()=>console.log(`Open ${url} in your browser.`));browser.unref();
  }
  return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))local().catch(error=>{
  console.error(`AINA ERROR: ${error.code==='EADDRINUSE'?'Port is already in use. Close the other AINA window, or set PORT to another number.':error.message}`);process.exitCode=1;
});
