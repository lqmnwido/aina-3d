import test from 'node:test';
import assert from 'node:assert/strict';
import {progressLine,createProgress} from '../tools/startup-ui.js';
test('progress counts completed checks',()=>{
  assert.match(progressLine(1,3,'Assets ready'),/33%/);
  assert.match(progressLine(3,3,'Ready'),/100%/);
});
test('TTY progress updates one line and suppresses duplicates',()=>{
  let output='';const ui=createProgress({isTTY:true,write:chunk=>output+=chunk});
  ui.update(0,3,'Preparing');ui.update(0,3,'Preparing');ui.update(1,3,'Ready');
  assert.equal(output.split('\r').length,3);assert.equal(output.includes('\n'),false);
});
