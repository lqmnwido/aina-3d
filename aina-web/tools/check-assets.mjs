import {existsSync, statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SCRIPTED_AUDIO} from '../src/scripted-audio.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function checkAssets(){
  const assets=new Set([...SCRIPTED_AUDIO.values(),'/models/aina.glb','/models/aina-fallback.png','/models/AINA_voice.blend','/media/precomp_13-current.mp4']);
  const missing=[...assets].filter(asset=>{
    const file=path.join(root,'public',asset);
    return !existsSync(file)||statSync(file).size===0;
  });
  if(missing.length)throw new Error(`Missing bundled assets: ${missing.join(', ')}. Download the complete repository.`);
  return assets.size;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(`Verified ${checkAssets()} required model, voice and montage assets.`);
