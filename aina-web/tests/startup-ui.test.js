import test from 'node:test';
import assert from 'node:assert/strict';
import {progressLine,createProgress,probe} from '../local-speech/startup-ui.js';
test('progress counts completed checks, not estimated model progress',()=>{
  assert.match(progressLine(3,7,'Loading'),/42% \(3\/7\)/);
  assert.match(progressLine(7,7,'Ready'),/100%/);
});
test('TTY progress updates one line and suppresses duplicate messages',()=>{
  let output='';const ui=createProgress({isTTY:true,write:chunk=>output+=chunk});
  ui.update(0,7,'Loading');ui.update(0,7,'Loading');ui.update(1,7,'Loading');
  assert.equal(output.split('\r').length,3);assert.equal(output.includes('\n'),false);
});
test('HTTP 200 alone is not AI readiness',async()=>{
  assert.equal((await probe('local','health',async()=>({ok:true,json:async()=>({ready:false})}))).ok,false);
});
test('public checks reject error pages and incomplete AI configuration',async()=>{
  assert.equal((await probe('site','page',async()=>({ok:true,text:async()=>'<title>Cloudflare error</title>'}))).ok,false);
  const config={local:true,configured:true,ttsConfigured:true,chatConfigured:false,tts:'local',chat:'vllm'};
  assert.equal((await probe('site','config',async()=>({ok:true,json:async()=>config}))).ok,false);
  config.chatConfigured=true;
  assert.equal((await probe('site','config',async()=>({ok:true,json:async()=>config}))).ok,true);
});
