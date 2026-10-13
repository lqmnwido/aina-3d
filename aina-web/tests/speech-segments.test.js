import test from 'node:test';
import assert from 'node:assert/strict';
import {speechSegments} from '../src/speech-segments.js';
import {LAUNCH_ACK,LANDING_MESSAGE} from '../src/launch.js';
test('fixed launch and landing lines remain intact',()=>{
  for(const text of [LAUNCH_ACK,LANDING_MESSAGE])assert.deepEqual(speechSegments(text),[text]);
});
test('long replies preserve words and sentence punctuation',()=>{
  const text='Saya boleh membantu anda. '+ 'Ini penerangan yang jelas dan mesra untuk anda. '.repeat(8).trim();
  const parts=speechSegments(text);
  assert.equal(parts[0],'Saya boleh membantu anda.');
  assert.equal(parts.join(' '),text);
  assert.ok(parts.every(part=>part.length<=150));
});
test('long sentences split at words and empty replies produce no segments',()=>{
  const text='perkataan '.repeat(50).trim();
  assert.equal(speechSegments(text).join(' '),text);
  assert.ok(speechSegments(text).every(part=>part.length<=150));
  assert.deepEqual(speechSegments(' '),[]);
});
test('decimals and URLs are not dropped at sentence boundaries',()=>{
  const text='Nilainya 3.14 dan alamatnya example.com. '+ 'Saya akan terangkan dengan lebih jelas untuk anda. '.repeat(5).trim();
  assert.equal(speechSegments(text).join(' '),text);
});
