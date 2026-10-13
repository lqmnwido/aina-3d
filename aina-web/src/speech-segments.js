// Sentence-level playback, not native model streaming. Short character lines
// stay intact to preserve their approved delivery and launch timing.
export function speechSegments(text, limit=150) {
  const clean=text.trim();
  if(clean.length<=limit)return clean?[clean]:[];
  const sentences=clean.split(/(?<=[.!?])\s+/u);
  const segments=[];
  for(const sentence of sentences){
    let part='';
    for(const word of sentence.trim().split(/\s+/)){
      if(part && (part+' '+word).length>limit){segments.push(part);part='';}
      part+=(part?' ':'')+word;
    }
    if(part)segments.push(part);
  }
  return segments;
}
