import {test} from 'node:test';
import assert from 'node:assert/strict';
import {speechCues,cueAt,shapeForSound} from '../src/voice-motion.js';
test('word cue times preserve genuine pauses',()=>{
  const cues=speechCues('Apa boleh',2,[{text:'Apa',offset:.2,duration:.5},{text:'boleh',offset:1.1,duration:.7}]);
  assert.equal(cueAt(cues,.1),'');assert.equal(cueAt(cues,.3),'a');assert.equal(cueAt(cues,.9),'');assert.equal(cueAt(cues,1.12),'b');
});
test('Malay mouth shapes distinguish closures, vowels and lip/teeth contact',()=>{
  assert.equal(shapeForSound('m',1).closed,1);assert.ok(shapeForSound('a',.7).open>.7);
  assert.ok(shapeForSound('u',.7).round>.8);assert.ok(shapeForSound('i',.7).wide>.7);
  assert.equal(shapeForSound('f',.7).fv,.9);assert.equal(shapeForSound('a',0).closed,1);
});
