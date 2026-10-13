import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Box3,Vector3} from 'three';
import {fitEyesToOutlines} from '../src/eye-size.js';
import {applyNeonLEDs} from '../src/neon-led.js';

test('black eyes are round at the original outline width without losing Blink or growing on reinitialization',async()=>{
  const bytes=readFileSync(new URL('../public/models/aina.glb',import.meta.url));
  const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const size=object=>{object.updateMatrix();return new Box3().setFromBufferAttribute(object.geometry.attributes.position).applyMatrix4(object.matrix).getSize(new Vector3());};
  fitEyesToOutlines(scene);applyNeonLEDs(scene);
  for(const side of ['L','R']){
    const eye=scene.getObjectByName('Eye'+side),rim=scene.getObjectByName('Eye_bezel'+side);
    const actual=size(eye),expected=size(rim);
    assert.ok(Math.abs(actual.x-expected.x)<1e-6);
    assert.ok(Math.abs(actual.y-actual.x)<1e-6);
    assert.equal(eye.visible,true);assert.equal(rim.visible,false);
    assert.ok(eye.morphTargetDictionary.Blink!==undefined);
    const scale=eye.scale.clone();fitEyesToOutlines(scene);assert.deepEqual(eye.scale,scale);
  }
});
