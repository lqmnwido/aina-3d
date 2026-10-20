import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {existsSync} from 'node:fs';
import {assertNode,root,runQuiet,logFile,markDependencies} from './local-common.mjs';
import {restoreBundledAssets} from './bundled-assets.mjs';
import {checkAssets} from './check-assets.mjs';
import {createProgress} from '../local-speech/startup-ui.js';
export async function setup(){
  assertNode();const progress=createProgress(),log=logFile('setup');
  progress.update(0,4,'Preparing bundled assets');
  await restoreBundledAssets(root);checkAssets();progress.update(1,4,'Installing npm dependencies');
  const candidates=[process.env.npm_execpath,path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),path.resolve(path.dirname(process.execPath),'../lib/node_modules/npm/bin/npm-cli.js')].filter(Boolean);
  const npm=candidates.find(file=>existsSync(file));
  if(!npm)throw Error('npm was not found. Double-click SETUP.cmd to install Node.js with npm.');
  await runQuiet(process.execPath,[npm,'ci','--no-audit','--no-fund'],'npm install',log);
  markDependencies();progress.update(2,4,'Dependencies ready');
  checkAssets();progress.update(3,4,'Building AINA');
  await runQuiet(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'build'],'Build',log);
  progress.update(4,4,'Ready');progress.finish('Setup complete. Run npm run local or double-click START.cmd. No AI or domain setup required.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))setup().catch(error=>{console.error(`AINA SETUP ERROR: ${error.message}`);process.exitCode=1;});
