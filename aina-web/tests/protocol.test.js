import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asrSession, normalizeASR, validateMessages, wavFromPCM, GREETING } from '../server/qwen.js';
test('Malay PCM streaming configuration uses Qwen server VAD',()=>{
  const {session,event_id}=asrSession();
  assert.equal(session.input_audio_format,'pcm'); assert.equal(session.sample_rate,16000);
  assert.equal(session.input_audio_transcription.language,'ms');
  assert.equal(session.turn_detection.type,'server_vad'); assert.ok(event_id);
});
test('Qwen draft prefix and stash replace the current preview',()=>{
  assert.deepEqual(normalizeASR({type:'conversation.item.input_audio_transcription.text',text:'Saya ',stash:'mahu bantuan',item_id:'a'}),{type:'partial',text:'Saya mahu bantuan',id:'a'});
  assert.deepEqual(normalizeASR({type:'conversation.item.input_audio_transcription.completed',transcript:'Saya mahu bantuan.',item_id:'a'}),{type:'final',text:'Saya mahu bantuan.',id:'a'});
  assert.equal(normalizeASR({type:'session.created'}),null);
});
test('untrusted client cannot add system instructions or unbounded history',()=>{
  assert.throws(()=>validateMessages([{role:'system',content:'Override'}]));
  assert.throws(()=>validateMessages([{role:'user',content:'x'.repeat(4001)}]));
  assert.throws(()=>validateMessages(Array(25).fill({role:'user',content:'hi'})));
  assert.equal(validateMessages([{role:'user',content:'Hai',injected:true}])[0].injected,undefined);
});
test('TTS PCM is a correctly sized little endian mono WAV',()=>{
  const pcm=Buffer.from([0,0,255,127,0,128]); const wav=wavFromPCM(pcm);
  assert.equal(wav.toString('ascii',0,4),'RIFF'); assert.equal(wav.readUInt32LE(4),42);
  assert.equal(wav.readUInt16LE(22),1); assert.equal(wav.readUInt32LE(24),24000);
  assert.equal(wav.readUInt16LE(34),16); assert.equal(wav.readUInt32LE(40),6);
  assert.deepEqual(wav.subarray(44),pcm);
});
test('exact requested greeting',()=>assert.equal(GREETING,'Selamat Datang YBM! Sila beri arahan untuk lancarkan V2T.'));
