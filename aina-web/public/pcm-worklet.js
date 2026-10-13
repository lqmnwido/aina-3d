// Continuous 16 kHz mono PCM16 resampling, independent of device sample rate.
class PCMRecorder extends AudioWorkletProcessor {
  constructor() { super(); this.samples = []; this.position = 0; this.chunk = []; }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    this.samples.push(...input);
    const ratio = sampleRate / 16000;
    while (this.position + 1 < this.samples.length) {
      const i = Math.floor(this.position), t = this.position - i;
      const x = this.samples[i]*(1-t) + this.samples[i+1]*t;
      this.chunk.push(Math.round(Math.max(-1,Math.min(1,x))*(x < 0 ? 32768 : 32767)));
      this.position += ratio;
      if (this.chunk.length === 1600) {
        const data = new ArrayBuffer(3200), view = new DataView(data);
        for (let j = 0; j < 1600; j++) view.setInt16(j*2,this.chunk[j],true);
        this.port.postMessage(data,[data]); this.chunk = [];
      }
    }
    const used = Math.min(Math.floor(this.position), this.samples.length);
    this.samples.splice(0,used); this.position -= used;
    return true;
  }
}
registerProcessor('pcm-recorder', PCMRecorder);
