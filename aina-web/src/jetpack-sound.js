// Local synthesized jetpack: filtered rushing air, low engine rumble and turbine.
// Shares the already-unlocked speech AudioContext; no download or new permission.
export class JetpackSound{
  prepare(context){
    if(this.buffer&&this.context===context)return;
    this.context=context;this.buffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate);
    const samples=this.buffer.getChannelData(0);let low=0;
    for(let i=0;i<samples.length;i++){const white=Math.random()*2-1;low=.98*low+.02*white;samples[i]=white*.55+low*2;}
  }
  play(context,{landing=false}={}){
    this.stop();this.prepare(context);
    const now=context.currentTime,duration=3.2;
    const master=context.createGain();master.connect(context.destination);
    const peak=landing ? .065 : .14;
    master.gain.setValueAtTime(0,now);master.gain.linearRampToValueAtTime(peak,now+.16);
    master.gain.setValueAtTime(peak,now+duration-.7);master.gain.linearRampToValueAtTime(0,now+duration);
    const noise=context.createBufferSource();noise.buffer=this.buffer;noise.loop=true;
    const filter=context.createBiquadFilter();filter.type='lowpass';filter.Q.value=.7;
    filter.frequency.setValueAtTime(landing?1400:700,now);filter.frequency.exponentialRampToValueAtTime(landing?450:2300,now+duration);
    noise.connect(filter);filter.connect(master);
    const rumble=context.createOscillator(),rumbleGain=context.createGain();rumble.type='sawtooth';rumbleGain.gain.value=.13;
    rumble.frequency.setValueAtTime(landing?75:45,now);rumble.frequency.linearRampToValueAtTime(landing?38:95,now+duration);
    rumble.connect(rumbleGain);rumbleGain.connect(filter);
    const turbine=context.createOscillator(),turbineGain=context.createGain();turbine.type='sine';turbineGain.gain.value=.035;
    turbine.frequency.setValueAtTime(landing?700:260,now);turbine.frequency.exponentialRampToValueAtTime(landing?220:950,now+duration);
    turbine.connect(turbineGain);turbineGain.connect(master);
    const nodes=[noise,rumble,turbine];nodes.forEach(node=>{node.start(now);node.stop(now+duration+.02);});
    const dispose=()=>{nodes.forEach(node=>{try{node.stop();}catch{}node.disconnect();});filter.disconnect();rumbleGain.disconnect();turbineGain.disconnect();master.disconnect();};
    noise.onended=()=>{dispose();if(this.cleanup===dispose)this.cleanup=null;};this.cleanup=dispose;
  }
  stop(){const cleanup=this.cleanup;this.cleanup=null;cleanup?.();}
}
