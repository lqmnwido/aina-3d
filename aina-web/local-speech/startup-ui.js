export function progressLine(completed,total,label){
  const percent=Math.floor(completed/total*100),filled=Math.floor(completed/total*24);
  return `AINA [${'='.repeat(filled)}${' '.repeat(24-filled)}] ${String(percent).padStart(3)}% (${completed}/${total}) ${label}`;
}
export function createProgress(output=process.stdout){
  let previous='',width=0;
  return {
    update(completed,total,label){
      const line=progressLine(completed,total,label);
      if(line===previous)return;
      if(output.isTTY){output.write('\r'+line+' '.repeat(Math.max(0,width-line.length)));width=line.length;}
      else output.write(line+'\n');
      previous=line;
    },
    finish(message){output.write((output.isTTY?'\n':'')+message+'\n');}
  };
}
export async function probe(url,kind='health',request=fetch){
  try{
    const response=await request(url,{signal:AbortSignal.timeout(3000)});
    if(!response.ok)return {ok:false,error:`HTTP ${response.status}`};
    if(kind==='page'){
      const html=await response.text();
      const ok=/<title>AINA\b/.test(html)&&html.includes('id="root"');
      return {ok,error:ok?'':'Response is not the AINA page'};
    }
    const data=await response.json();
    const ok=kind==='config'?data.local===true&&data.configured===true&&data.ttsConfigured===true&&data.chatConfigured===true&&data.tts==='local'&&['scripted','vllm'].includes(data.chat):data.ready===true;
    return {ok,error:ok?'':'AI services are still loading'};
  }catch(error){return {ok:false,error:error.message};}
}
