import { speechCues, cueAt, shapeForSound } from './voice-motion.js';
import { speechSegments } from './speech-segments.js';
import {SCRIPTED_AUDIO} from './scripted-audio.js';
export const GREETING = 'Selamat Datang YBM! Sila beri arahan untuk lancarkan V2T.';
const resting = { speaking:false,voiceActive:false,expression:'neutral',open:0,round:0,wide:0,closed:0,fv:0,energy:0 };
export const motion = { ...resting };

export class Speaker {
  constructor(onState) { this.onState = onState; this.generation = 0; this.context = null;this.preparedAudio=new Map(); }
  async loadPrepared(url){
    await this.unlock();
    if(!this.preparedAudio.has(url)){
      const pending=fetch(url,{cache:'force-cache'}).then(async response=>{
        if(!response.ok||!response.headers.get('content-type')?.includes('audio'))throw new Error('Audio AINA tidak tersedia. Muat semula halaman.');
        return this.context.decodeAudioData(await response.arrayBuffer());
      }).catch(error=>{this.preparedAudio.delete(url);throw error;});
      this.preparedAudio.set(url,pending);
    }
    return this.preparedAudio.get(url);
  }
  async preloadScripted(){await Promise.all([...SCRIPTED_AUDIO.values()].map(url=>this.loadPrepared(url)));}
  async unlock() {
    this.context ||= new AudioContext();
    await this.context.resume();
  }
  stop() {
    this.generation++;
    this.request?.abort(); this.request = null;
    this.resolve?.(); this.resolve = null;
    window.speechSynthesis?.cancel();
    if (this.source) { try { this.source.stop(); } catch {} this.source.disconnect(); this.source = null; }
    cancelAnimationFrame(this.frame);
    Object.assign(motion,resting);
    this.onState(false);
  }
  async speak(text, provider, voiceURI, expression='neutral') {
    this.stop();
    const generation = this.generation;
    if (provider === 'qwen' || provider === 'azure' || provider === 'local') {
      this.request = new AbortController();
      const signal=this.request.signal;
      const segments=provider==='local'?speechSegments(text):[text];
      if(!segments.length)return;
      const prepare=async segment=>{
      const url=provider==='local'?SCRIPTED_AUDIO.get(segment):null;
      if(url)return {audio:await this.loadPrepared(url),words:[]};
      const response = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text:segment }), signal });
      if (!response.ok) {
        const type=response.headers.get('content-type')||'';
        const message=type.includes('application/json')?(await response.json()).error:'Pelayan suara tidak tersedia. Muat semula halaman selepas sistem sedia.';
        throw new Error(message||'Speech synthesis failed.');
      }
      if(response.headers.get('content-type')?.includes('text/html'))throw new Error('Pelayan menghantar halaman HTML, bukan audio. Muat semula halaman selepas sistem sedia.');
      let bytes, words=[];
      if(response.headers.get('content-type')?.includes('application/json')){
        const data=await response.json();words=data.words||[];
        bytes=Uint8Array.from(atob(data.audio),c=>c.charCodeAt(0)).buffer;
      }else bytes=await response.arrayBuffer();
      signal.throwIfAborted();
      await this.unlock();
      const audio = await this.context.decodeAudioData(bytes);
      return {audio,words};
      };
      // Fetch at most one segment ahead. Attach an error handler immediately
      // so an interrupted prefetch cannot become an unhandled rejection.
      const pending=segment=>prepare(segment).then(value=>({value}),error=>({error}));
      let next=pending(segments[0]);
      try { for(let index=0;index<segments.length;index++){
      const result=await next;
      if(result.error)throw result.error;
      const {audio,words}=result.value;
      if (generation !== this.generation) return;
      if(index+1<segments.length)next=pending(segments[index+1]);
      const source = this.context.createBufferSource(); source.buffer = audio;
      // A small tempo/pitch lift gives the launch lines a brighter delivery.
      // Natural delivery keeps the recorded pitch and timing untouched.
      const rate=expression==='greetingHype'?1.06:expression==='natural'?1:expression==='joyful'?1.10:expression==='cheerful'?1.06:expression==='annoyed'?.98:1;source.playbackRate.value=rate;
      const analyser = this.context.createAnalyser(); analyser.fftSize = 512;
      source.connect(analyser); analyser.connect(this.context.destination); this.source = source;
      const samples = new Float32Array(analyser.fftSize);
      const cues=speechCues(segments[index],audio.duration,words);
      let playbackStart=0;
      const tick = () => {
        if (generation !== this.generation) return;
        analyser.getFloatTimeDomainData(samples);
        const rms = Math.sqrt(samples.reduce((s,x) => s+x*x,0)/samples.length);
        motion.energy = Math.min(1, Math.max(0,(rms-.008)*9));
        const sound=cueAt(cues,(this.context.currentTime-playbackStart)*rate);
        Object.assign(motion,shapeForSound(sound,sound?motion.energy:0));
        this.frame = requestAnimationFrame(tick);
      };
      await new Promise(resolve => {
        this.resolve = resolve;
        source.onended = () => {
          if (generation === this.generation) { cancelAnimationFrame(this.frame); Object.assign(motion,resting,{voiceActive:index<segments.length-1,expression:index<segments.length-1?expression:'neutral'}); if(index===segments.length-1)this.onState(false); this.source = null; this.resolve = null; }
          source.disconnect(); analyser.disconnect(); resolve();
        };
        motion.speaking = true; motion.voiceActive=true;motion.expression=expression; this.onState(true); playbackStart=this.context.currentTime;source.start(); tick();
      });
      if (generation !== this.generation) return;
      }
      } finally {
        if(generation===this.generation){
          this.request=null;cancelAnimationFrame(this.frame);
          Object.assign(motion,resting);this.onState(false);
        }
      }
    } else {
      if (!window.speechSynthesis) throw new Error('Speech synthesis is unavailable in this browser. Enable Qwen TTS on the server.');
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ms-MY'; utterance.rate = 1.02; utterance.pitch = 1.26;
      if(expression==='joyful'){utterance.rate=1.10;utterance.pitch=1.4;}
      const voices = window.speechSynthesis.getVoices();
      utterance.voice = voices.find(v => v.voiceURI === voiceURI && /^ms/i.test(v.lang)) || voices.find(v => /^ms/i.test(v.lang)&&/Yasmin/i.test(v.name)) || voices.find(v=>/^ms/i.test(v.lang)&&!/Osman/i.test(v.name)) || null;
      if(!utterance.voice) throw new Error('Tiada suara Melayu pada peranti ini. Sambungkan Azure Speech untuk suara AINA.');
      let start = 0, boundaryAt = 0, charIndex = 0, hasBoundary = false;
      utterance.onboundary = e => { charIndex = e.charIndex; boundaryAt = performance.now(); hasBoundary = true; };
      // Native speech audio is not exposed to Web Audio. Word boundaries drive
      // approximate visemes; a syllable clock supports voices without boundaries.
      const tick = () => {
        if (generation !== this.generation) return;
        const now = performance.now();
        const pos = hasBoundary ? charIndex : Math.floor((now-start)/85)%text.length;
        const character = text[pos]?.toLowerCase() || 'a';
        const pulse = .22+.65*Math.abs(Math.sin((now-(hasBoundary ? boundaryAt : start))*.022));
        const silence = /[.,!?]/.test(character);
        motion.energy = silence?0:pulse;
        Object.assign(motion,shapeForSound(character,motion.energy));
        this.frame = requestAnimationFrame(tick);
      };
      await new Promise((resolve,reject) => {
        this.resolve = resolve;
        const finish = error => {
          if (generation !== this.generation) return resolve();
          cancelAnimationFrame(this.frame); Object.assign(motion,resting); this.onState(false); this.resolve = null;
          error ? reject(error) : resolve();
        };
        utterance.onstart = () => { start = performance.now(); motion.speaking = true; motion.voiceActive=true;motion.expression=expression; this.onState(true); tick(); };
        utterance.onend = () => finish();
        utterance.onerror = e => finish(e.error === 'canceled' || e.error === 'interrupted' ? null : new Error(`Voice playback failed: ${e.error}. Try another voice.`));
        window.speechSynthesis.speak(utterance);
      });
    }
  }
}

export class Microphone {
  setMuted(value){this.stream?.getTracks().forEach(track=>{track.enabled=!value;});}
  reconnect(message){
    this.stop();this.requested=true;this.onStatus('connecting');this.onError(message);
    this.retryTimer=setTimeout(()=>{this.retryTimer=null;this.start();},1500);
  }
  constructor({ onStatus, onPartial, onFinal, onError, shouldSend, onLevel=()=>{}, onInterrupt=()=>{},onSpeechStart=()=>{} }) {
    Object.assign(this,{onStatus,onPartial,onFinal,onError,shouldSend,onLevel,onInterrupt,onSpeechStart}); this.token = 0;
  }
  async start() {
    this.stop(); const token = this.token;
    this.onStatus('connecting'); this.requested = true;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Use localhost or HTTPS to enable your microphone.');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (token !== this.token) { stream.getTracks().forEach(t=>t.stop()); return; }
      this.stream = stream;this.setMuted(motion.voiceActive||motion.speaking); this.context = new AudioContext();
      await this.context.audioWorklet.addModule('/pcm-worklet.js');
      if (token !== this.token) return;
      await this.context.resume();
      const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/asr`);
      this.socket = socket; let ready = false; const seen = new Set(),eligible=new Set();
      const canSend=()=>this.shouldSend()&&!motion.voiceActive&&!motion.speaking;
      const source = this.context.createMediaStreamSource(stream); this.node = new AudioWorkletNode(this.context,'pcm-recorder');
      const mute = this.context.createGain(); mute.gain.value = 0;
      this.filter=this.context.createBiquadFilter();this.filter.type='highpass';this.filter.frequency.value=90;this.filter.Q.value=.7;
      source.connect(this.filter);this.filter.connect(this.node); this.node.connect(mute); mute.connect(this.context.destination);
      this.node.port.onmessage = ({ data }) => {
        const blocked=motion.voiceActive||motion.speaking;
        stream.getTracks().forEach(track=>{track.enabled=!blocked;});
        if (!ready || socket.readyState !== WebSocket.OPEN) return;
        if(blocked){this.onLevel(0);socket.send(new ArrayBuffer(data.byteLength));return;}
        const pcm=new DataView(data);let square=0;
        for(let i=0;i<pcm.byteLength;i+=2)square+=(pcm.getInt16(i,true)/32768)**2;
        const level=Math.sqrt(square/(pcm.byteLength/2));this.onLevel(level);
        if (socket.bufferedAmount > 256000) { this.onError('Connection is too slow. Reconnect your microphone.'); this.stop(); return; }
        // Listen during thinking; suppress only AINA's own playback echo.
        socket.send(canSend() ? data : new ArrayBuffer(data.byteLength));
      };
      socket.onmessage = ({data}) => {
        if (token !== this.token) return;
        try {
          const m = JSON.parse(data);
          if (m.type === 'ready') { ready = true; this.onStatus('listening'); }
          if (m.type === 'speech-start' && canSend()) {if(m.id)eligible.add(m.id);this.onStatus('hearing');this.onSpeechStart();}
          if (m.type === 'speech-end') this.onStatus('transcribing');
          if (m.type === 'no-speech') {eligible.delete(m.id);this.onStatus('listening');this.onError(m.message||'Suara dikesan tetapi perkataan tidak jelas. Cuba cakap sekali lagi.');}
          if (m.type === 'partial' && canSend()) this.onPartial(m.text);
          if (m.type === 'final' && m.text.trim() && !seen.has(m.id)) {
            this.onStatus('listening');
            if(!/[\p{L}\p{N}]/u.test(m.text)){eligible.delete(m.id);this.onError('Perkataan belum jelas. Cuba cakap sekali lagi.');return;}
            seen.add(m.id); if (seen.size > 500) seen.delete(seen.values().next().value);
            // A legitimate user turn may finish decoding after Aina starts
            // playing her preceding reply. Never silently discard that turn.
            if (!motion.voiceActive&&!motion.speaking&&(eligible.has(m.id)||this.shouldSend())) this.onFinal(m.text);
            eligible.delete(m.id);
          }
          if (m.type === 'error') { this.reconnect(m.message||'Sambungan suara terganggu. Menyambung semula…'); }
        } catch { this.onError('Invalid transcription response.'); this.stop(); }
      };
      socket.onerror = () => { if (token === this.token) this.reconnect('Sambungan suara terganggu. Menyambung semula…'); };
      socket.onclose = () => { if (token === this.token) this.reconnect('Sambungan suara terputus. Menyambung semula…'); };
    } catch (e) {
      if (token === this.token) {
        const messages={NotAllowedError:'Benarkan akses mikrofon dalam pelayar, kemudian tekan ikon mikrofon.',NotFoundError:'Tiada mikrofon ditemui. Sambungkan mikrofon dan cuba lagi.',NotReadableError:'Mikrofon tidak dapat dibaca. Semak peranti audio atau aplikasi yang menggunakannya.',NotSupportedError:'Mikrofon tidak disokong dalam pelayar ini. Cuba buka http://localhost:5173 dalam Chrome atau Edge.'};
        this.onError(messages[e.name]||e.message);this.stop();
      }
    }
  }
  stop() {
    clearTimeout(this.retryTimer);this.retryTimer=null;
    this.token++; this.requested = false;
    this.node?.disconnect(); this.node = null;
    this.filter?.disconnect();this.filter=null;
    this.stream?.getTracks().forEach(t=>t.stop()); this.stream = null;
    this.context?.close().catch(()=>{}); this.context = null;
    this.socket?.close(); this.socket = null;
    this.onStatus('off');
  }
}
