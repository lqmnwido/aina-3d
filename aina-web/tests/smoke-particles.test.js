import {test} from 'node:test';import assert from 'node:assert/strict';
import {SmokeParticles} from '../src/smoke-particles.js';
test('landing exhaust leaves the live nozzle, hits the floor and spreads sideways',()=>{
  const smoke=new SmokeParticles();
  smoke.update(0,{x:.3,y:1,z:.2},{landing:true,groundY:0,direction:{x:0,y:-1,z:0}});
  const initialX=smoke.positions[0],initialY=smoke.positions[1];
  smoke.update(.2,null);
  assert.ok(smoke.positions[1]<initialY,'plume flows down, not toward avatar');
  assert.ok(Math.abs(smoke.positions[0]-initialX)<.001,'narrow plume before ground contact');
  smoke.update(.8,null);
  assert.ok(smoke.positions[1]>=.08&&smoke.positions[1]<.2,'puffs stay above the floor');
  assert.ok(smoke.positions[0]>initialX+.3,'ground impact pushes smoke outward');
  assert.ok(smoke.radii[0]>.4,'ground cloud expands rather than being sucked into the engine');
});
test('landing particles stay in world space when the engine changes position',()=>{
  const smoke=new SmokeParticles();
  smoke.update(0,{x:0,y:2,z:0},{landing:true});
  smoke.update(.064,{x:1,y:1,z:0},{landing:true});
  assert.ok(Math.abs(smoke.positions[0])<.06,'old smoke does not teleport after the nozzle');
  assert.ok(smoke.base[9*3]>.9,'new smoke is emitted from the new nozzle position');
  smoke.update(3,null);assert.ok(smoke.opacity.every(v=>v===0));
});
test('smoke is visible on the first ignition frame, without waiting to grow',()=>{
  const smoke=new SmokeParticles();smoke.update(0,{x:0,y:0,z:0});
  assert.equal(smoke.opacity.filter(value=>value>0).length,6);
  assert.ok(smoke.radii[0]>=.23);assert.ok(smoke.opacity[0]>.6);
});
test('slower frames fill the moving trail rather than dropping a single puff',()=>{
  const smoke=new SmokeParticles();smoke.update(0,{x:0,y:0,z:0});smoke.update(.064,{x:0,y:1,z:0});
  assert.equal(smoke.index,10);assert.ok(smoke.base[6*3+1]>0&&smoke.base[6*3+1]<1);
  assert.equal(smoke.base[9*3+1],1);smoke.update(2,null);assert.ok(smoke.opacity.every(value=>value===0));
});
