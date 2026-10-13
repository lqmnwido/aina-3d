import {test} from 'node:test';import assert from 'node:assert/strict';
import {isThanks,THANKS_REPLY} from '../src/social-replies.js';
test('Terima kasih receives the exact happy acknowledgement',()=>{
  for(const text of ['Terima kasih','Terima kasih!','TERIMA KASIH.','Terima kasih, Aina.'])assert.equal(isThanks(text),true,text);
  for(const text of ['Jangan cakap terima kasih','Apa maksud terima kasih?','Terima kasih, tapi boleh tolong semak status?','!'])assert.equal(isThanks(text),false,text);
  assert.equal(THANKS_REPLY,'Sama-sama, saya seronok untuk membantu anda!');
});
