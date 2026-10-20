import {existsSync, statSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SCRIPTED_AUDIO} from '../src/scripted-audio.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function checkAssets(){
  const assets=new Set([...SCRIPTED_AUDIO.values(),'/models/aina.glb','/models/aina-fallback.png','/models/AINA_voice.blend','/media/v2t-v4-4.mp4']);
  const missing=[...assets].filter(asset=>{
    const file=path.join(root,'public',asset);
    if(!existsSync(file)||statSync(file).size===0)return true;
    return statSync(file).size<1024&&readFileSync(file,'utf8').startsWith('version https://git-lfs.github.com/spec/v1');
  });
  if(missing.length)throw new Error(`Missing bundled assets or Git LFS pointers: ${missing.join(', ')}. Run SETUP.cmd or npm run setup to download the complete assets.`);
  return assets.size;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(`Verified ${checkAssets()} required model, voice and montage assets.`);
