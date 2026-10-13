export async function readReply(response,onDelta=()=>{}){
  if(!response.headers.get('content-type')?.includes('application/x-ndjson')){
    const data=await response.json();if(!response.ok)throw new Error(data.error||'AINA tidak dapat menjawab.');return data.text;
  }
  if(!response.ok)throw new Error('AINA tidak dapat menjawab.');
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',final='';
  const consume=line=>{if(!line.trim())return;const event=JSON.parse(line);if(event.type==='error')throw new Error(event.message);if(event.type==='delta')onDelta(event.text);if(event.type==='final')final=event.text;};
  try{while(true){const {value,done}=await reader.read();buffer+=decoder.decode(value||new Uint8Array(),{stream:!done});let end;while((end=buffer.indexOf('\n'))>=0){consume(buffer.slice(0,end));buffer=buffer.slice(end+1);}if(done)break;}if(buffer)consume(buffer);if(!final?.trim())throw new Error('AINA returned an incomplete reply.');return final;}
  finally{reader.releaseLock();}
}
