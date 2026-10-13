export function toWslPath(windowsPath){
  const normalized=windowsPath.replaceAll('\\','/');
  const match=/^([A-Za-z]):\/(.*)$/.exec(normalized);
  if(!match)throw new Error('WSL requires an absolute Windows drive path.');
  return `/mnt/${match[1].toLowerCase()}/${match[2]}`;
}

export function vllmArgs(script,env=process.env){
  return ['-d',env.AINA_WSL_DISTRO||'AINA-Ubuntu','-u','root','--exec','env',
    'PYTHONUNBUFFERED=1','HF_HUB_OFFLINE=1','TOKENIZERS_PARALLELISM=false',
    'VLLM_WORKER_MULTIPROC_METHOD=spawn',
    `AINA_ASR_PORT=${env.AINA_ASR_PORT||'8765'}`,
    `AINA_ASR_WINDOW=${env.AINA_ASR_WINDOW||'.6'}`,
    `AINA_VAD_SILENCE=${env.AINA_VAD_SILENCE||'.4'}`,
    `AINA_ASR_GPU_FRACTION=${env.AINA_ASR_GPU_FRACTION||'.30'}`,
    `AINA_CHAT_PORT=${env.AINA_CHAT_PORT||'8768'}`,
    `AINA_CHAT_GPU_FRACTION=${env.AINA_CHAT_GPU_FRACTION||'.25'}`,
    '/opt/aina-asr/bin/python',toWslPath(script)];
}

export function vllmStopArgs(script,env=process.env){
  const command=`/opt/aina-asr/bin/python ${toWslPath(script)}`;
  const pattern='^'+command.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$';
  return ['-d',env.AINA_WSL_DISTRO||'AINA-Ubuntu','-u','root','--exec','/usr/bin/pkill','-TERM','-f',pattern];
}
