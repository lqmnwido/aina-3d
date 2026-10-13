import test from 'node:test';
import assert from 'node:assert/strict';
import {scriptedReply,SCRIPTED_HELP} from '../src/scripted-replies.js';
import {isLaunchCommand} from '../src/launch.js';
test('V T T launch fallbacks are accepted without accepting negated commands',()=>{
  assert.equal(isLaunchCommand('tolong launchkan V T T'),true);
  assert.equal(isLaunchCommand('tolong lancarkan V T T.'),true);
  assert.equal(isLaunchCommand('Tolong lancarkan V Tuti.'),true);
  assert.equal(isLaunchCommand('tolong lancarkan video tih'),true);
  assert.equal(isLaunchCommand('Jangan tolong lancarkan video tih'),false);
  assert.equal(isLaunchCommand('Jangan tolong launchkan V T T'),false);
});
test('unmatched commands return a fixed helpful segment, not an LLM reply',()=>{
  assert.equal(scriptedReply('anything else'),SCRIPTED_HELP);
  assert.equal(SCRIPTED_HELP,'Maaf! Saya tidak dapat membantu Anda!');
  assert.equal(scriptedReply('Terima kasih'),'Sama-sama, saya seronok untuk membantu anda!');
});
