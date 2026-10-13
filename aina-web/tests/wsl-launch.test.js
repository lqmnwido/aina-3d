import test from 'node:test';
import assert from 'node:assert/strict';
import {toWslPath,vllmArgs,vllmStopArgs} from '../local-speech/wsl-launch.js';
test('WSL preserves a Windows workspace path with spaces as one argument',()=>{
  const script='C:\\Users\\Wido\\Documents\\ChatGPT\\AINA 3D\\aina-web\\local-speech\\asr_vllm_server.py';
  assert.equal(toWslPath(script),'/mnt/c/Users/Wido/Documents/ChatGPT/AINA 3D/aina-web/local-speech/asr_vllm_server.py');
  const args=vllmArgs(script,{});assert.equal(args.at(-1),toWslPath(script));assert.ok(args.includes('AINA_ASR_PORT=8765'));
});
test('native shutdown targets only this exact script, not other Linux processes',()=>{
  const pattern=new RegExp(vllmStopArgs('C:/AINA/project/asr_vllm_server.py',{}).at(-1));
  assert.ok(pattern.test('/opt/aina-asr/bin/python /mnt/c/AINA/project/asr_vllm_server.py'));
  assert.equal(pattern.test('/opt/aina-asr/bin/python /mnt/c/other/asr_vllm_server.py'),false);
  assert.equal(pattern.test('/opt/aina-asr/bin/python /mnt/c/AINA/project/asr_vllm_serverXpy'),false);
});
test('WSL rejects relative or non-drive paths and allows explicit runtime tuning',()=>{
  assert.throws(()=>toWslPath('local-speech/asr_vllm_server.py'),/absolute/);
  const args=vllmArgs('D:/AINA/asr.py',{AINA_ASR_GPU_FRACTION:'.26',AINA_ASR_PORT:'8767'});
  assert.ok(args.includes('AINA_ASR_GPU_FRACTION=.26'));assert.ok(args.includes('AINA_ASR_PORT=8767'));
});
test('vLLM chat shares the installed runtime but has an independent port and GPU budget',()=>{
  const args=vllmArgs('C:/AINA/chat_vllm_server.py',{AINA_CHAT_PORT:'8770',AINA_CHAT_GPU_FRACTION:'.23'});
  assert.ok(args.includes('AINA_CHAT_PORT=8770'));assert.ok(args.includes('AINA_CHAT_GPU_FRACTION=.23'));
  assert.equal(args.at(-1),'/mnt/c/AINA/chat_vllm_server.py');
});
