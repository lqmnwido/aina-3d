// Conservative end trimming: preserve speech, remove quiet tail, fade to zero.
export function cleanPcmWav(wav){
  let fmt,data;
  for(let offset=12;offset+8<=wav.length;){
    const size=wav.readUInt32LE(offset+4),id=wav.toString('ascii',offset,offset+4);
    if(offset+8+size>wav.length)throw new Error('Truncated WAV');
    if(id==='fmt ')fmt=wav.subarray(offset+8,offset+8+size);
    if(id==='data')data=wav.subarray(offset+8,offset+8+size);
    offset+=8+size+(size%2);
  }
  if(!fmt||!data||fmt.readUInt16LE(0)!==1||fmt.readUInt16LE(2)!==1||fmt.readUInt16LE(14)!==16)throw new Error('Expected mono PCM16');
  const sr=fmt.readUInt32LE(4),samples=data.length/2,window=Math.round(sr*.02);
  let lastActive=0,quietStart=null,tailStart=null;
  for(let start=0;start<samples;start+=window){
    let sum=0;const end=Math.min(samples,start+window);
    for(let i=start;i<end;i++)sum+=(data.readInt16LE(i*2)/32768)**2;
    if(Math.sqrt(sum/(end-start))>.009){lastActive=end;quietStart=null;}
    else{
      quietStart??=start;
      // Fixed short utterances have no deliberate multi-second pause.
      // Remove a spurious sound after a long end silence, not just silence.
      if(quietStart>sr*1.5&&end-quietStart>=sr*1.4){tailStart=quietStart;break;}
    }
  }
  if(!lastActive)throw new Error('Silent speech');
  const end=Math.min(samples,(tailStart??lastActive)+Math.round(sr*.12));
  const pcm=Buffer.from(data.subarray(0,end*2)),fade=Math.min(end,Math.round(sr*.05));
  for(let i=0;i<fade;i++){
    const index=end-fade+i,gain=.5*(1+Math.cos(Math.PI*i/Math.max(1,fade-1)));
    pcm.writeInt16LE(Math.round(pcm.readInt16LE(index*2)*gain),index*2);
  }
  const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(pcm.length+36,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);fmt.copy(header,20,0,16);header.write('data',36);header.writeUInt32LE(pcm.length,40);
  return Buffer.concat([header,pcm]);
}
