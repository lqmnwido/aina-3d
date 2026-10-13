import https from 'node:https';
import dns from 'node:dns';
import {Resolver} from 'node:dns/promises';

// A new record can remain negatively cached at the PC's upstream DNS.
// This fallback is scoped to AINA's public readiness check; OS settings are
// untouched and HTTPS still verifies the requested hostname normally.
export async function publicRequest(url,options){
  try{return await fetch(url,options);}catch(error){
    if(new URL(url).hostname!=='gimmick.kohich.site'||!['ENOTFOUND','EAI_AGAIN'].includes(error.cause?.code))throw error;
  }
  const resolver=new Resolver({timeout:1500,tries:1});resolver.setServers(['1.1.1.1','1.0.0.1']);
  const lookup=(hostname,opts,callback)=>dns.lookup(hostname,opts,(error,address,family)=>{
    if(!error)return callback(null,address,family);
    if(!['ENOTFOUND','EAI_AGAIN'].includes(error.code))return callback(error);
    resolver.resolve4(hostname).then(addresses=>{
      if(opts.all)callback(null,addresses.map(address=>({address,family:4})));
      else callback(null,addresses[0],4);
    },callback);
  });
  return await new Promise((resolve,reject)=>{
    const request=https.get(url,{lookup,signal:AbortSignal.timeout(5000)},response=>{
      const chunks=[];let bytes=0;
      response.on('data',chunk=>{
        bytes+=chunk.length;
        if(bytes>262144){request.destroy(new Error('Readiness response too large'));return;}
        chunks.push(chunk);
      });
      response.on('error',reject);
      response.on('end',()=>{
        const text=Buffer.concat(chunks).toString('utf8'),status=response.statusCode;
        resolve({ok:status>=200&&status<300,status,text:async()=>text,json:async()=>JSON.parse(text)});
      });
    });
    request.on('error',reject);
  });
}
