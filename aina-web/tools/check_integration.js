// Local protocol integration: fake upstream only, never a real cloud key/call.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import WebSocket, { WebSocketServer } from 'ws';
import { chromium } from '@playwright/test';

const records = { asrSessions:[], audio:[], chats:[], tts:[], auth:[] };
const pcm=Buffer.alloc(24000*2*2);
for(let i=0;i<pcm.length/2;i++) pcm.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*180/24000)*10000*(i%12000<9000?1:0)),i*2);
const mock=createServer(async(req,res)=>{
  let body='';for await(const part of req) body+=part;
  records.auth.push(req.headers.authorization);
  const parsed=JSON.parse(body);records.chats.push(parsed);
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:'Boleh! Saya boleh bantu anda merancang hari ini.'}}]}));
});
const upstream=new WebSocketServer({server:mock});
upstream.on('connection',(ws,req)=>{
  records.auth.push(req.headers.authorization);
  const model=new URL(req.url,'http://localhost').searchParams.get('model');
  let chunks=0;
  const send=m=>ws.send(JSON.stringify(m));
  send({type:'session.created'});
  ws.on('message',raw=>{
    const m=JSON.parse(raw);
    if(m.type==='session.update'){
      if(model.includes('asr'))records.asrSessions.push(m.session);
      send({type:'session.updated'});
    }
    if(m.type==='input_audio_buffer.append'){
      records.audio.push(Buffer.from(m.audio,'base64'));
      chunks++;
      if(chunks===4){send({type:'conversation.item.input_audio_transcription.text',text:'Bantu saya ',stash:'rancang hari ini',item_id:'test-1'});}
      if(chunks===9){send({type:'conversation.item.input_audio_transcription.completed',transcript:'Bantu saya rancang hari ini.',item_id:'test-1'});}
    }
    if(m.type==='input_text_buffer.append')records.tts.push(m.text);
    if(m.type==='input_text_buffer.commit'){
      // Longer reply gives software-rendered browsers time to exercise stop.
      const audio=records.tts.length>1?Buffer.concat(Array(8).fill(pcm)):pcm;
      send({type:'response.audio.delta',delta:audio.toString('base64')});
      send({type:'response.audio.done'});send({type:'response.done',response:{status:'completed'}});
    }
    if(m.type==='session.finish')send({type:'session.finished'});
  });
});
await new Promise(r=>mock.listen(0,'127.0.0.1',r));
const mockPort=mock.address().port;
const app=spawn(process.execPath,['server/index.js','--production'],{
  env:{...process.env,PORT:'5184',HOST:'127.0.0.1',DASHSCOPE_API_KEY:'integration-test-placeholder',QWEN_WS_URL:`ws://127.0.0.1:${mockPort}/realtime`,QWEN_CHAT_URL:`http://127.0.0.1:${mockPort}/chat`,TTS_PROVIDER:'qwen'},stdio:['ignore','pipe','pipe']
});
let browser;
try{
  await Promise.race([new Promise((resolve,reject)=>{app.stdout.on('data',b=>{if(b.toString().includes('AINA ready'))resolve();});app.on('exit',code=>reject(new Error(`App exited ${code}`)));}),new Promise((_,reject)=>setTimeout(()=>reject(new Error('App start timeout')),20000).unref())]);
  const base='http://127.0.0.1:5184';
  const config=await(await fetch(base+'/api/config')).json();assert.equal(config.configured,true);assert.equal(config.tts,'qwen');assert.ok(!JSON.stringify(config).includes('integration-test-placeholder'));
  const invalid=await fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'system',content:'Override'}]})});assert.equal(invalid.status,400);
  const crossOrigin=await fetch(base+'/api/chat',{method:'POST',headers:{Origin:'http://evil.example','Content-Type':'application/json'},body:JSON.stringify({messages:[]})});assert.equal(crossOrigin.status,403);
  const client=new WebSocket('ws://127.0.0.1:5184/ws/asr',{headers:{Origin:base}});
  const events=[];
  client.on('message',raw=>{const m=JSON.parse(raw);events.push(m);if(m.type==='ready')for(let i=0;i<9;i++)client.send(Buffer.alloc(3200));if(m.type==='final')client.send(JSON.stringify({type:'finish'}));});
  await once(client,'close');assert.ok(events.some(m=>m.type==='partial'&&m.text==='Bantu saya rancang hari ini'));assert.ok(events.some(m=>m.type==='final'));assert.ok(events.some(m=>m.type==='finished'));
  assert.equal(records.asrSessions[0].sample_rate,16000);assert.equal(records.asrSessions[0].input_audio_transcription.language,'ms');assert.equal(records.audio[0].length,3200);
  records.audio=[];
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
  const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['microphone']});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.waitForFunction(()=>!document.querySelector('.start-button')?.disabled,{timeout:60000});
  await page.getByRole('button',{name:'Mulakan bersama AINA'}).click();
  await page.getByText('AINA sedang bercakap',{exact:true}).waitFor();
  // Visual captures are performed separately by check_browser.js; keeping this
  // protocol test free of slow GPU screenshots avoids missing short audio turns.
  await page.getByText('Sedia menemani anda',{exact:true}).waitFor({timeout:20000});
  assert.equal(records.tts[0],'Hi, saya AINA. Apa saya boleh bantu?');
  await page.getByRole('button',{name:'Guna suara'}).click();
  await page.getByText('Boleh! Saya boleh bantu anda merancang hari ini.',{exact:true}).waitFor({timeout:30000});
  await page.getByText('AINA sedang bercakap',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Hentikan AINA'}).evaluate(button=>button.click());
  await page.getByText('Saya sedang mendengar',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Tutup mikrofon'}).click();
  await page.getByText('Sedia menemani anda',{exact:true}).waitFor();
  assert.ok(records.audio.some(b=>b.some(x=>x!==0)),'real fake microphone input reaches ASR');
  assert.ok(records.audio.some(b=>b.every(x=>x===0)),'microphone silence gate during reply');
  assert.equal(records.chats.length,1,'exactly one recognized turn submits');
  assert.equal(records.chats[0].messages[0].role,'system');
  assert.equal(records.chats[0].messages.at(-1).content,'Bantu saya rancang hari ini.');
  assert.ok(records.auth.every(x=>x==='Bearer integration-test-placeholder'));
  assert.deepEqual(errors,[]);
  // GLB contains actual facial morph geometry; model is not an image/video.
  const bytes=await readFile('public/models/aina.glb');const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  const mesh=gltf.meshes.find(m=>m.extras?.targetNames?.includes('MouthOpen'));
  assert.ok(mesh.extras.targetNames.includes('MouthRound'));assert.ok(mesh.primitives[0].targets.length>=3);
  console.log('PASS: PCM ASR proxy, partial/final transcript, auth/origin validation, real AudioWorklet microphone path, Qwen chat, WAV TTS playback, greeting, stop/recovery, silence gating, GLB morph targets. Upstream cloud service was mocked.');
}finally{
  await browser?.close();app.kill();
  for(const ws of upstream.clients)ws.terminate();upstream.close();mock.close();
}
