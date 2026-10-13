import {test} from 'node:test';import assert from 'node:assert/strict';
import {quickReply} from '../server/quick-reply.js';
test('simple Malay greetings bypass reload/generation delay',()=>{
  for(const text of ['Hi. Sihat ke?','Hai Aina, sihat ke?','Apa khabar?'])assert.equal(quickReply(text),'Hai! Saya sihat. Awak pula?');
  assert.match(quickReply('Hi!'),/Selamat Datang YBM/);
});
test('substantive and negated requests still go to the language model',()=>{
  for(const text of ['Hi. Apa cuaca hari ini?','Saya tidak sihat ke?','Jom kita mulakan lunch di rims.','Kenapa saya tidak sihat?','!'])assert.equal(quickReply(text),null);
});
