import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {addLensBlinkTargets} from '../src/eye-blink.js';
import {createAngryFace,applyAngryFace} from '../src/angry-face.js';
test('angry expression groups both eyes, blue lines and rims, and returns to neutral',async()=>{
  const bytes=readFileSync(new URL('../public/models/aina.glb',import.meta.url));
  const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const lenses=addLensBlinkTargets(scene),controls=createAngryFace(scene);
  assert.equal(controls.length,2);
  for(const lens of lenses){assert.ok(controls.some(control=>control.pivot===lens.parent));assert.equal(lens.morphTargetDictionary.Blink,0);}
  applyAngryFace(controls,1);
  assert.ok(controls[0].pivot.rotation.z<0);assert.ok(controls[1].pivot.rotation.z>0);
  for(const control of controls){assert.ok(Math.abs(control.pivot.scale.y-.82)<1e-8);assert.equal(control.pivot.getObjectByName(control.pivot.name+'-brow'),undefined);}
  applyAngryFace(controls,0);
  for(const control of controls){assert.equal(Math.abs(control.pivot.rotation.z),0);assert.equal(control.pivot.scale.y,1);}
  assert.equal(createAngryFace(scene)[0].pivot,controls[0].pivot,'initialization never nests or duplicates expression groups');
});
