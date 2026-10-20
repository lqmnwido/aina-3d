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
