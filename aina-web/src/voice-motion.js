export function phonemes(text) { return (text.toLowerCase().match(/ng|ny|sy|kh|[a-zà-ÿ]/g)||[]); }
export function shapeForSound(sound, energy) {
  const e=Math.max(0,Math.min(1,energy));
  const closed={open:0,round:0,wide:0,closed:1,fv:0};
  if(e<.045||/[mbp]/.test(sound))return closed;
  if(/[ou]/.test(sound))return {...closed,closed:0,round:.65+.3*e};
  if(/[ei]/.test(sound))return {...closed,closed:0,wide:.4+.5*e};
  if(/[fv]/.test(sound))return {...closed,closed:0,fv:.9};
  return {...closed,closed:0,open:/a/.test(sound)?.35+.6*e:.12+.32*e};
}
export function speechCues(text, duration, words=[]) {
  const valid=words.filter(w=>Number.isFinite(w.offset)&&Number.isFinite(w.duration)&&w.duration>0);
  const items=valid.length?valid:[{text,offset:0,duration}];
  const cues=[];
  for(const w of items){
    const sounds=phonemes(w.text);const step=w.duration/Math.max(1,sounds.length);
    sounds.forEach((sound,i)=>cues.push({sound,start:w.offset+i*step,end:w.offset+(i+1)*step}));
  }
  return cues.sort((a,b)=>a.start-b.start);
}
export function cueAt(cues,time) { return cues.find(c=>time>=c.start&&time<c.end)?.sound||''; }
