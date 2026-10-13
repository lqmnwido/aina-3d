import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
await mkdir('qa',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
try{
  const context=await browser.newContext({permissions:['microphone'],viewport:{width:1200,height:900}});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    window.WebSocket=class{
      static OPEN=1;readyState=1;bufferedAmount=0;
      constructor(){window.ainaTestSocket=this;setTimeout(()=>this.onmessage?.({data:JSON.stringify({type:'ready'})}),50);}
      send(){}close(){this.readyState=3;}
    };
  });
  const data=Buffer.alloc(4800),header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(data.length+36,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(24000,24);header.writeUInt32LE(48000,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(data.length,40);
  await page.route('**/api/tts',route=>route.fulfill({contentType:'audio/wav',body:Buffer.concat([header,data])}));
  await page.goto('http://127.0.0.1:5173/');
  const start=page.getByRole('button',{name:'Start bersama AINA'});await start.waitFor();await start.click({timeout:30000});
  await page.locator('.transcription-status').filter({hasText:'Mendengar'}).waitFor({timeout:20000});
  await page.screenshot({path:'qa/face-neutral.png'});
  await page.evaluate(()=>window.ainaTestSocket.onmessage({data:JSON.stringify({type:'final',id:'angry-face-test',text:'Soalan yang tidak dikenali'})}));
  await page.locator('.transcription-status').filter({hasText:'AINA sedang bercakap'}).waitFor({timeout:10000});
  await page.waitForTimeout(500);await page.screenshot({path:'qa/face-angry.png'});
  await page.locator('.transcription-status').filter({hasText:'Mendengar'}).waitFor({timeout:10000});
  await page.waitForTimeout(500);await page.screenshot({path:'qa/face-reset.png'});
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Angry reply plays, restores listening and has no browser errors.');
}finally{await browser.close();}
