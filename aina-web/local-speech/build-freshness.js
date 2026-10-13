import {existsSync,readdirSync,statSync} from 'node:fs';
import path from 'node:path';

export function needsFrontendBuild(root){
  const index=path.join(root,'dist','index.html');
  if(!existsSync(index))return true;
  const built=statSync(index).mtimeMs;
  const newer=target=>{
    if(!existsSync(target))return false;
    const info=statSync(target);
    if(info.isDirectory())return readdirSync(target,{withFileTypes:true})
      .some(entry=>!entry.isSymbolicLink()&&newer(path.join(target,entry.name)));
    return info.mtimeMs>built;
  };
  return ['src','public','index.html','package.json','package-lock.json','vite.config.js','vite.config.mjs','vite.config.ts']
    .some(name=>newer(path.join(root,name)));
}
