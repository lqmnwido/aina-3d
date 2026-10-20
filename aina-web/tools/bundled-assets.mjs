import {readFile,readdir,rename,stat,unlink} from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import path from 'node:path';
const prefix='version https://git-lfs.github.com/spec/v1';
export function parseLFSPointer(text){
  if(!text.startsWith(prefix))return null;
  const oid=text.match(/^oid sha256:([a-f0-9]{64})$/m)?.[1],size=Number(text.match(/^size (\d+)$/m)?.[1]);
  if(!oid||!Number.isSafeInteger(size)||size<=0)throw Error('Invalid Git LFS asset pointer');
  return {oid,size};
}
export async function assetPointers(directory){
  const result=[];
  async function walk(folder){
    for(const entry of await readdir(folder,{withFileTypes:true})){
      const file=path.join(folder,entry.name);
      if(entry.isDirectory())await walk(file);
      else if(entry.isFile()&&(await stat(file)).size<1024){
        const pointer=parseLFSPointer(await readFile(file,'utf8'));
        if(pointer)result.push({file,...pointer});
      }
    }
  }
  await walk(directory);return result;
}
export async function restoreBundledAssets(root,{fetchFile=fetch}={}){
  for(const asset of await assetPointers(path.join(root,'public'))){
    const relative=path.relative(path.dirname(root),asset.file).split(path.sep).map(encodeURIComponent).join('/');
    const url=`https://media.githubusercontent.com/media/lqmnwido/aina-3d/main/${relative}`;
    const temporary=asset.file+'.download';
    try{
      const response=await fetchFile(url,{signal:AbortSignal.timeout(15*60*1000)});
      if(!response.ok||!response.body)throw Error(`HTTP ${response.status}`);
      await pipeline(Readable.fromWeb(response.body),createWriteStream(temporary,{flags:'w'}));
      const hash=createHash('sha256');for await(const bytes of createReadStream(temporary))hash.update(bytes);
      if((await stat(temporary)).size!==asset.size||hash.digest('hex')!==asset.oid)throw Error('Downloaded asset does not match the Git LFS checksum');
      await rename(temporary,asset.file);
    }catch(error){
      await unlink(temporary).catch(()=>{});
      throw Error(`Cannot download ${relative}: ${error.message}. Connect to the internet and rerun setup, or run git lfs pull.`);
    }
  }
}
