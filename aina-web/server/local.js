// Local presentation only: no dotenv, AI imports, external API or tunnel.
import express from 'express';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function createLocalApp(directory=path.join(root,'dist')){
  if(!existsSync(path.join(directory,'index.html')))throw Error('Build missing. Run npm run setup first.');
  const app=express();app.disable('x-powered-by');
  app.get('/api/config',(_req,res)=>res.set('Cache-Control','no-store').json({application:'aina-local',inputMode:'keyboard',local:true,configured:true,ttsConfigured:true,chatConfigured:true,tts:'local',chat:'scripted',asrMode:'disabled',asrModel:null,voice:'AINA prerecorded audio'}));
  app.use('/api',(_req,res)=>res.status(404).json({error:'Local presentation uses bundled audio. No AI service is running.'}));
  app.use(express.static(directory,{setHeaders(res,file){if(file.endsWith('.html'))res.set('Cache-Control','no-store');}}));
  app.use((_req,res)=>res.status(404).type('text/plain').send('File not found'));
  return app;
}
export function startLocalServer({port=Number(process.env.PORT||5173)}={}){
  if(!Number.isInteger(port)||port<0||port>65535)throw Error('PORT must be a number between 0 and 65535.');
  return new Promise((resolve,reject)=>{
    const server=createLocalApp().listen(port,'127.0.0.1',()=>resolve(server));
    server.once('error',reject);
  });
}
