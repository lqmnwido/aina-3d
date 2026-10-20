import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {createLocalApp} from '../server/local.js';
import {parseLFSPointer,assetPointers,restoreBundledAssets} from '../tools/bundled-assets.mjs';

test('local presentation serves video ranges, rejects missing assets and has no AI endpoints',async()=>{
  const folder=await mkdtemp(path.join(os.tmpdir(),'aina-local-test-'));
  let server;
  try{
    await writeFile(path.join(folder,'index.html'),'<title>AINA</title><div id="root"></div>');
    await mkdir(path.join(folder,'media'));
    await writeFile(path.join(folder,'media','montage.mp4'),Buffer.from('0123456789'));
    server=await new Promise(resolve=>{const s=createLocalApp(folder).listen(0,'127.0.0.1',()=>resolve(s));});
    const base=`http://127.0.0.1:${server.address().port}`;
    const config=await(await fetch(base+'/api/config')).json();
    assert.equal(config.application,'aina-local');assert.equal(config.asrMode,'disabled');assert.equal(config.chat,'scripted');
    const home=await fetch(base);assert.equal(home.status,200);assert.equal(home.headers.get('cache-control'),'no-store');
    const video=await fetch(base+'/media/montage.mp4',{headers:{Range:'bytes=2-5'}});
    assert.equal(video.status,206);assert.equal(video.headers.get('content-range'),'bytes 2-5/10');assert.equal(await video.text(),'2345');
    const missing=await fetch(base+'/media/not-present.mp4');assert.equal(missing.status,404);
    for(const endpoint of ['tts','chat']){
      const response=await fetch(base+'/api/'+endpoint,{method:'POST'});
      assert.equal(response.status,404);assert.match((await response.json()).error,/No AI service/);
    }
  }finally{
    if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
    await rm(folder,{recursive:true,force:true});
  }
});

test('asset check detects LFS pointers without confusing downloaded media',async()=>{
  const folder=await mkdtemp(path.join(os.tmpdir(),'aina-lfs-test-'));
  const oid='a'.repeat(64),pointer=`version https://git-lfs.github.com/spec/v1\noid sha256:${oid}\nsize 200000000\n`;
  try{
    assert.deepEqual(parseLFSPointer(pointer),{oid,size:200000000});assert.equal(parseLFSPointer('RIFF audio data'),null);
    assert.throws(()=>parseLFSPointer('version https://git-lfs.github.com/spec/v1\nsize invalid'));
    await writeFile(path.join(folder,'video.mp4'),pointer);await writeFile(path.join(folder,'sound.wav'),'RIFF audio data');
    const pointers=await assetPointers(folder);assert.equal(pointers.length,1);assert.equal(pointers[0].oid,oid);
  }finally{await rm(folder,{recursive:true,force:true});}
});

test('setup replaces LFS pointers only after verifying downloaded content',async()=>{
  const folder=await mkdtemp(path.join(os.tmpdir(),'aina-lfs-download-'));
  const root=path.join(folder,'renamed presentation folder'),media=path.join(root,'public','media');
  const video=Buffer.from('video content for checksum verification');
  const oid=createHash('sha256').update(video).digest('hex');
  const pointer=`version https://git-lfs.github.com/spec/v1\noid sha256:${oid}\nsize ${video.length}\n`;
  try{
    await mkdir(media,{recursive:true});const file=path.join(media,'test.mp4');await writeFile(file,pointer);
    await assert.rejects(restoreBundledAssets(root,{fetchFile:async()=>new Response('wrong content')}),/checksum/);
    assert.equal(await readFile(file,'utf8'),pointer,'failed download preserves the pointer for retry');
    await restoreBundledAssets(root,{fetchFile:async url=>{assert.match(url,/aina-3d\/main\/aina-web\/public\/media\/test.mp4$/);return new Response(video);}});
    assert.deepEqual(await readFile(file),video);assert.deepEqual(await assetPointers(path.join(root,'public')),[]);
  }finally{await rm(folder,{recursive:true,force:true});}
});
