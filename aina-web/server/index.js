import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import path from 'node:path';
import {existsSync} from 'node:fs';
import { fileURLToPath } from 'node:url';
import WebSocket, { WebSocketServer } from 'ws';
import { asrSession, event, normalizeASR, validateMessages, synthesize } from './qwen.js';
import { synthesizeMalay } from './malay-tts.js';
import {quickReply} from './quick-reply.js';
import {scriptedReply} from '../src/scripted-replies.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = {
  asr: process.env.ASR_PROVIDER || 'local',
  chat: process.env.CHAT_PROVIDER || 'vllm',
  localChat: process.env.LOCAL_CHAT_URL || 'http://127.0.0.1:8768',
  localASR: process.env.LOCAL_ASR_URL || 'http://127.0.0.1:8765',
  localTTS: process.env.LOCAL_TTS_URL || 'http://127.0.0.1:8766',
  key: process.env.DASHSCOPE_API_KEY || '',
  wsURL: process.env.QWEN_WS_URL || 'wss://dashscope-intl.aliyuncs.com/api-ws/v1/realtime',
  chatURL: process.env.QWEN_CHAT_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
  asrModel: process.env.QWEN_ASR_MODEL || 'qwen3-asr-flash-realtime',
  chatModel: process.env.QWEN_CHAT_MODEL || 'qwen-plus',
  tts: ['browser','qwen','local'].includes(process.env.TTS_PROVIDER) ? process.env.TTS_PROVIDER : 'azure',
  azureKey: process.env.AZURE_SPEECH_KEY || '',
  azureRegion: process.env.AZURE_SPEECH_REGION || 'southeastasia',
  azureVoice: process.env.AZURE_SPEECH_VOICE || 'ms-MY-YasminNeural',
  ttsModel: process.env.QWEN_TTS_MODEL || 'qwen3-tts-flash-realtime',
  ttsVoice: process.env.QWEN_TTS_VOICE || 'Cherry',
  ttsLanguage: process.env.QWEN_TTS_LANGUAGE || 'Auto',
};
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '128kb' }));
// Same-origin only; credentials stay on this server, never in the React bundle.
app.use('/api', (req, res, next) => {
  if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)
    return res.status(403).json({ error: 'Same-origin access only.' });
  res.set('Cache-Control', 'no-store'); next();
});
app.get('/api/config', async (_req, res) => {
  if((process.env.AINA_INPUT_MODE||'keyboard')==='keyboard'){
    const ready=['vituti-launch-dbd50ca0283a.wav','vituti-landing-selected-hype-34db74885b08.wav'].every(file=>existsSync(path.join(root,'public','audio',file)));
    return res.json({inputMode:'keyboard',configured:ready,ttsConfigured:ready,chatConfigured:true,tts:'local',local:true,chat:'scripted',asrModel:null,asrMode:'disabled',voice:'AINA · audio sedia ada'});
  }
  const health=async url=>{try{return await(await fetch(url+'/health',{signal:AbortSignal.timeout(2000)})).json();}catch{return {ready:false};}};
  const [asr,tts]=await Promise.all([config.asr==='local'?health(config.localASR):Promise.resolve({ready:Boolean(config.key)}),config.tts==='local'?health(config.localTTS):Promise.resolve({ready:config.tts==='azure'?Boolean(config.azureKey):config.tts==='qwen'?Boolean(config.key):true})]);
  let chatConfigured=config.chat==='scripted'||Boolean(config.key);
  if(config.chat==='vllm')chatConfigured=(await health(config.localChat)).ready===true;
  res.json({configured:asr.ready,ttsConfigured:tts.ready,chatConfigured,tts:config.tts,asrModel:config.asr==='local'?'Qwen3-ASR-0.6B (local)':config.asrModel,asrMode:asr.mode,asrDevice:asr.device,voice:config.tts==='local'?'AINA · Chatterbox Melayu':config.azureVoice,local:config.asr==='local',chat:config.chat});
});
function requireKey(req, res, next) {
  if (!['vllm','scripted'].includes(config.chat) && !config.key) return res.status(503).json({ error: 'Add DASHSCOPE_API_KEY to aina-web/.env and restart the server to enable Qwen.' });
  next();
}
app.post('/api/chat', requireKey, async (req, res) => {
  let messages;
  try { messages = validateMessages(req.body.messages); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  const last=messages.at(-1);const quick=last?.role==='user'?quickReply(last.content):null;
  if(config.chat==='scripted')return res.json({text:scriptedReply(last?.content),scripted:true});
  if(quick)return res.json({text:quick,cachedSmallTalk:true});
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(),30000);
  res.on('close', () => { if (!res.writableEnded) controller.abort(); });
  try {
    const local=config.chat==='vllm',stream=local&&req.body.stream===true;
    const response = await fetch(local?config.localChat+'/chat':config.chatURL, {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model:local?'aina-local':config.chatModel,temperature:.3,max_tokens:96,...(local?{stream}:{}),
        messages: [{ role: 'system', content: 'Anda Aina, pembantu suara yang ceria. Jawab soalan dengan tepat dalam Bahasa Melayu Malaysia, maksimum dua ayat pendek. Ibu negara bermaksud bandar pusat negara (capital city), bukan pemimpin atau negara lain. Jangan mereka fakta; jika tidak pasti, nyatakan tidak pasti. Jangan gunakan markdown. Jangan mendakwa boleh melakukan tindakan yang tidak tersedia.' }, ...messages] }),
    });
    if (!response.ok) throw new Error(`${config.chat==='vllm'?'Local vLLM':'Qwen'} chat returned HTTP ${response.status}. ${config.chat==='vllm'?'Check local-speech/chat-vllm-error.log.':'Check model availability and configuration.'}`);
    if(stream){
      res.type('application/x-ndjson');res.flushHeaders();let buffer='',text='',done=false;const decoder=new TextDecoder();
      const consume=line=>{if(!line.trim())return;const m=JSON.parse(line);if(m.error)throw new Error(m.error);if(m.message?.content){text+=m.message.content;res.write(JSON.stringify({type:'delta',text})+'\n');}if(m.done)done=true;};
      for await(const bytes of response.body){buffer+=decoder.decode(bytes,{stream:true});let end;while((end=buffer.indexOf('\n'))>=0){consume(buffer.slice(0,end));buffer=buffer.slice(end+1);}}
      buffer+=decoder.decode();if(buffer)consume(buffer);
      if(!done||!text.trim())throw new Error('Reply stream ended before completion.');
      res.end(JSON.stringify({type:'final',text:text.trim()})+'\n');return;
    }
    const data = await response.json();
    const text = (local?data.message?.content:data.choices?.[0]?.message?.content)?.trim();
    if (!text) throw new Error('Qwen returned an empty reply.');
    res.json({ text });
  } catch (e) { if (!res.destroyed){const message=e.name==='AbortError'?'Qwen reply timed out or was cancelled.':config.chat==='vllm'&&e.message==='fetch failed'?'Enjin jawapan vLLM belum tersedia. Jalankan npm run local dan tunggu model siap.':e.message;if(res.headersSent)res.end(JSON.stringify({type:'error',message})+'\n');else res.status(502).json({error:message});} }
  finally { clearTimeout(timeout); }
});
app.post('/api/tts', async (req, res) => {
  const text = req.body.text;
  if (typeof text !== 'string' || !text.trim() || text.length > 2000) return res.status(400).json({ error: 'Speech must be 1–2000 characters.' });
  const controller = new AbortController();
  res.on('close', () => { if (!res.writableEnded) controller.abort(); });
  try {
    if(config.tts === 'local'){
      const response=await fetch(config.localTTS+'/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text}),signal:controller.signal});
      if(!response.ok)throw new Error((await response.text()).slice(0,250)||'Local Malay TTS failed.');
      res.set('X-Generation-Seconds',response.headers.get('X-Generation-Seconds')||'unknown');
      res.type('audio/wav').send(Buffer.from(await response.arrayBuffer()));
    }else if(config.tts === 'azure') res.json(await synthesizeMalay(text,config,controller.signal));
    else {
      if(!config.key)return res.status(503).json({error:'Configure DASHSCOPE_API_KEY for Qwen TTS.'});
      res.type('audio/wav').send(await synthesize(text,config,controller.signal));
    }
  }
  catch (e) { if (!res.destroyed) res.status(502).json({ error: e.message }); }
});
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true, maxPayload: 32000 });
server.on('upgrade', (req, socket, head) => {
  if (req.url?.split('?')[0] !== '/ws/asr') return; // Vite owns its HMR upgrade.
  if((process.env.AINA_INPUT_MODE||'keyboard')==='keyboard'){socket.write('HTTP/1.1 410 Gone\r\nConnection: close\r\n\r\n');socket.destroy();return;}
  let origin;
  try { origin = new URL(req.headers.origin).host; } catch { socket.destroy(); return; }
  if (origin !== req.headers.host) { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
});
wss.on('connection', client => {
  const send = data => { if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(data)); };
  if(config.asr==='local'){
    const url=new URL(config.localASR);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.pathname='/ws/asr';
    const local=new WebSocket(url,{handshakeTimeout:10000,maxPayload:128000});
    let ready=false;
    local.on('message',raw=>{try{const m=JSON.parse(raw);if(m.type==='ready')ready=true;send(m);}catch{send({type:'error',message:'Invalid local ASR response.'});}});
    client.on('message',(raw,binary)=>{if(ready&&local.readyState===WebSocket.OPEN)local.send(raw,{binary});});
    local.on('error',()=>{send({type:'error',message:'Local Qwen ASR is not running. Use npm run local.'});client.close();});
    local.on('close',()=>client.close());client.on('close',()=>local.close());client.on('error',()=>local.close());return;
  }
  if (!config.key) {
    send({ type: 'error', message: 'Add DASHSCOPE_API_KEY to aina-web/.env and restart the server.' });
    client.close(1008, 'Qwen is not configured'); return;
  }
  const url = new URL(config.wsURL); url.searchParams.set('model', config.asrModel);
  const upstream = new WebSocket(url, { headers: { Authorization: `Bearer ${config.key}` }, handshakeTimeout: 10000 });
  let ready = false; let finishing = false;
  const timeout = setTimeout(() => { send({ type: 'error', message: 'Qwen ASR connection timed out.' }); client.close(); upstream.close(); }, 15000);
  const lifetime = setTimeout(() => { send({ type: 'error', message: 'Voice session ended after 30 minutes. Start again to continue.' }); client.close(); }, 30*60*1000);
  upstream.on('open', () => upstream.send(JSON.stringify(asrSession())));
  upstream.on('message', raw => {
    try {
      const m = normalizeASR(JSON.parse(raw));
      if (!m) return;
      if (m.type === 'ready') { ready = true; clearTimeout(timeout); }
      send(m);
      if (m.type === 'error' || m.type === 'finished') { client.close(); upstream.close(); }
    } catch { send({ type: 'error', message: 'Invalid Qwen ASR response.' }); client.close(); }
  });
  client.on('message', (raw, binary) => {
    if (upstream.readyState !== WebSocket.OPEN || !ready || finishing) return;
    if (binary) {
      if (raw.length % 2 !== 0) { client.close(1003, 'Expected PCM16'); return; }
      if (upstream.bufferedAmount > 512000) { send({ type: 'error', message: 'Voice connection is too slow. Please reconnect.' }); client.close(); return; }
      upstream.send(JSON.stringify(event('input_audio_buffer.append', { audio: raw.toString('base64') })));
    } else {
      try {
        if (JSON.parse(raw).type === 'finish') {
          finishing = true; upstream.send(JSON.stringify(event('session.finish')));
          setTimeout(() => { if (client.readyState === WebSocket.OPEN) client.close(); }, 5000).unref();
        }
      } catch { client.close(1003, 'Invalid message'); }
    }
  });
  upstream.on('error', () => { send({ type: 'error', message: 'Cannot connect to Qwen ASR. Check credentials, region, and model.' }); client.close(); });
  upstream.on('close', () => { clearTimeout(timeout); if (client.readyState === WebSocket.OPEN) { if (!finishing) send({ type: 'error', message: 'Qwen ASR connection closed. Reconnect the microphone.' }); client.close(); } });
  client.on('close', () => { clearTimeout(timeout); clearTimeout(lifetime); upstream.close(); });
  client.on('error', () => upstream.close());
});
if (process.argv.includes('--production')) {
  app.use(express.static(path.join(root, 'dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({ root, server: { middlewareMode: true, allowedHosts:['gimmick.kohich.site'], hmr: { server },watch:{ignored:['**/local-speech/**','**/public/models/*.blend*']} }, appType: 'spa' });
  app.use(vite.middlewares);
}
app.use((err, _req, res, _next) => res.status(400).json({ error: err.type === 'entity.too.large' ? 'Request too large.' : 'Invalid request.' }));
server.listen(Number(process.env.PORT || 5173), process.env.HOST || '127.0.0.1', () => {
  console.log('AINA ready: http://localhost:' + (process.env.PORT || 5173));
});
