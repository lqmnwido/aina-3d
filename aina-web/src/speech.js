import {speechCues,cueAt,shapeForSound} from './voice-motion.js';
import {SCRIPTED_AUDIO} from './scripted-audio.js';
export const GREETING='Selamat Datang YB Menteri! Sila beri arahan untuk lancarkan V2T.';
const resting={speaking:false,voiceActive:false,expression:'neutral',open:0,round:0,wide:0,closed:0,fv:0,energy:0};
export const motion={...resting};

// Playback and lip motion use only the four bundled recordings.
export class Speaker {
  constructor(onState=()=>{}){this.onState=onState;this.generation=0;this.context=null;this.preparedAudio=new Map();}
  async unlock(){this.context ||= new AudioContext();await this.context.resume();}
  async loadPrepared(url){
    await this.unlock();
    if(!this.preparedAudio.has(url)){
      const pending=fetch(url,{cache:'force-cache'}).then(async response=>{
        if(!response.ok||!response.headers.get('content-type')?.includes('audio'))throw Error('Audio AINA tidak tersedia. Muat semula halaman.');
        return this.context.decodeAudioData(await response.arrayBuffer());
      }).catch(error=>{this.preparedAudio.delete(url);throw error;});
      this.preparedAudio.set(url,pending);
    }
    return this.preparedAudio.get(url);
  }
  async preloadScripted(){await Promise.all([...SCRIPTED_AUDIO.values()].map(url=>this.loadPrepared(url)));}
  stop(){
    this.generation++;
    if(this.source){try{this.source.stop();}catch{}this.source.disconnect();this.source=null;}
    this.resolve?.();this.resolve=null;
    cancelAnimationFrame(this.frame);Object.assign(motion,resting);this.onState(false);
  }
  async speak(text,_provider,_voiceURI,expression='natural'){
    this.stop();const generation=this.generation,url=SCRIPTED_AUDIO.get(text);
    if(!url)throw Error('Rakaman suara ini tidak disertakan dalam AINA.');
    const audio=await this.loadPrepared(url);
    if(generation!==this.generation)return;
    const source=this.context.createBufferSource();source.buffer=audio;
    const rate=expression==='cheerful'?1.06:1;source.playbackRate.value=rate;
    const analyser=this.context.createAnalyser();analyser.fftSize=512;
    source.connect(analyser);analyser.connect(this.context.destination);this.source=source;
    const samples=new Float32Array(analyser.fftSize),cues=speechCues(text,audio.duration,[]);
    const playbackStart=this.context.currentTime;
    const tick=()=>{
      if(generation!==this.generation)return;
      analyser.getFloatTimeDomainData(samples);
      const rms=Math.sqrt(samples.reduce((sum,value)=>sum+value*value,0)/samples.length);
      motion.energy=Math.min(1,Math.max(0,(rms-.008)*9));
      const sound=cueAt(cues,(this.context.currentTime-playbackStart)*rate);
      Object.assign(motion,shapeForSound(sound,sound?motion.energy:0));
      this.frame=requestAnimationFrame(tick);
    };
    try{
      await new Promise(resolve=>{
        this.resolve=resolve;
        source.onended=()=>{source.disconnect();analyser.disconnect();resolve();};
        Object.assign(motion,{speaking:true,voiceActive:true,expression});this.onState(true);
        source.start();tick();
      });
    }finally{
      if(generation===this.generation){
        cancelAnimationFrame(this.frame);this.source=null;this.resolve=null;
        Object.assign(motion,resting);this.onState(false);
      }
    }
  }
}
