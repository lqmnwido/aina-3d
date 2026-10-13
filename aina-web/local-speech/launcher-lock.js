import {openSync,closeSync,readFileSync,writeFileSync,unlinkSync} from 'node:fs';

export function acquireLauncherLock(file){
  for(let attempt=0;attempt<2;attempt++){
    try{
      const fd=openSync(file,'wx');
      try{writeFileSync(fd,String(process.pid));}finally{closeSync(fd);}
      return ()=>{try{if(readFileSync(file,'utf8')===String(process.pid))unlinkSync(file);}catch{}};
    }catch(error){
      if(error.code!=='EEXIST')throw error;
      const pid=Number(readFileSync(file,'utf8'));
      if(!Number.isInteger(pid)||pid<=0)throw new Error('Another AINA launcher is starting. Keep its terminal open.');
      try{process.kill(pid,0);}catch(error){
        if(error.code==='ESRCH'){try{unlinkSync(file);}catch{}continue;}
        throw error;
      }
      throw new Error('AINA is already running. Use its existing terminal; a second AI stack was not started.');
    }
  }
  throw new Error('Could not acquire the AINA startup lock.');
}
