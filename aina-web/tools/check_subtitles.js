import {chromium} from '@playwright/test';import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));let completeChat;
 await page.route('**/api/config',route=>route.fulfill({contentType:'application/json',body:'{"configured":true,"ttsConfigured":true,"chatConfigured":true,"tts":"local"}'}));
 await page.route('**/api/chat',async route=>{await new Promise(r=>completeChat=r);await route.fulfill({contentType:'application/json',body:'{"text":"Hai! Saya sihat, terima kasih. Awak pula?"}'});});
 await page.route('**/api/tts',async route=>{const wav=Buffer.alloc(24044);wav.write('RIFF');wav.writeUInt32LE(24036,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(24000,24);wav.writeUInt32LE(48000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(24000,40);await route.fulfill({contentType:'audio/wav',body:wav});});
 await page.goto('http://localhost:5173');await page.locator('.start-button:enabled').waitFor({timeout:60000});
 await page.evaluate(async()=>{const url=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/speech.js')?.name||'/src/speech.js';const {Microphone}=await import(url);Microphone.prototype.start=async function(){this.requested=true;window.testMic=this;this.onStatus('listening');};});
 await page.getByRole('button',{name:'Start bersama AINA'}).click();
 try{await page.locator('.transcription-status').filter({hasText:'Mendengar'}).waitFor({timeout:10000});}catch(e){console.log(await page.locator('body').innerText(),errors);throw e;}
 await page.evaluate(()=>{window.testMic.onSpeechStart();window.testMic.onPartial('Hi. Sihat');});
 assert.match(await page.locator('.user-transcript').innerText(),/Hi\. Sihat/);
 await page.evaluate(()=>window.testMic.onFinal('Hi. Sihat ke?'));
 await page.locator('.transcription-status').filter({hasText:'sedang berfikir'}).waitFor();
 assert.match(await page.locator('.user-transcript').innerText(),/Hi\. Sihat ke\?/);
 await page.screenshot({path:'qa/transcription-thinking.png'});
 completeChat();await page.locator('.reply-subtitle').filter({hasText:'Saya sihat'}).waitFor();
 await page.locator('.transcription-status').filter({hasText:'Mendengar'}).waitFor();
 completeChat=null;await page.evaluate(()=>window.testMic.onFinal('Saya perlukan bantuan.'));
 await page.locator('.transcription-status').filter({hasText:'sedang berfikir'}).waitFor();
 for(let i=0;i<100&&!completeChat;i++)await page.waitForTimeout(20);
 assert.ok(completeChat,'chat request reached backend mock');
 await page.evaluate(()=>{window.testMic.onStatus('hearing');window.testMic.onSpeechStart();window.testMic.onPartial('Sebentar');});
 await page.locator('.transcription-status').filter({hasText:'Saya dengar anda bercakap'}).waitFor();
 completeChat();await page.waitForTimeout(150);
 assert.equal(await page.locator('.reply-subtitle').count(),0,'interrupted reply must not speak or overwrite the new turn');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'qa/transcription-mobile.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('PASS: live draft, final transcript, visible thinking/listening, reply subtitles, interruption during thinking, desktop/mobile. Browser uses mocked speech/chat.');
}finally{await browser.close();}
