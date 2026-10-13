import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {addLensBlinkTargets,eyeBlinkFit} from '../src/eye-blink.js';
function fixture(){
  const scene=new THREE.Group();scene.position.set(.3,1.7,.1);scene.rotation.z=.12;
  const eyes=[],lenses=[];
  for(const side of ['L','R']){
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,-1,0,0,0,0,0,1,0],3));
    const target=new THREE.Float32BufferAttribute([0,.85-.1728,0,0,-.1728,0,0,-.85-.1728,0],3);target.name='Blink';
    geometry.morphTargetsRelative=true;geometry.morphAttributes.position=[target];
    const eye=new THREE.Mesh(geometry);eye.name='Eye.'+side;eye.position.set(side==='L'?-.607:.607,.1,.716);eye.scale.set(.18,.196,.065);scene.add(eye);eyes.push(eye);
    const lensGeometry=new THREE.BufferGeometry();lensGeometry.setAttribute('position',new THREE.Float32BufferAttribute([eye.position.x,1.613,.74,eye.position.x,1.735,.76],3));
    const lens=new THREE.Mesh(lensGeometry);lens.name='Blue lens meniscus.'+side;lens.position.y=-1.7;scene.add(lens);lenses.push(lens);
  }
  return {scene,eyes,lenses};
}
test('both blue under-eye lenses acquire the eye Blink shape without changing the resting geometry',()=>{
  const {scene,eyes,lenses}=fixture(),originals=lenses.map(lens=>Array.from(lens.geometry.attributes.position.array));
  assert.equal(addLensBlinkTargets(scene).length,2);
  for(let side=0;side<2;side++){
    const lens=lenses[side],eye=eyes[side],fit=eyeBlinkFit(eye);
    assert.ok(Math.abs(fit.scale-.15)<1e-6);assert.ok(Math.abs(fit.offset+.1728)<1e-6);
    assert.deepEqual(Array.from(lens.geometry.attributes.position.array),originals[side]);
    assert.equal(lens.morphTargetDictionary.Blink,0);assert.equal(lens.morphTargetInfluences[0],0);
    const base=lens.geometry.attributes.position,delta=lens.geometry.morphAttributes.position[0];
    for(let i=0;i<base.count;i++){
      const start=eye.worldToLocal(lens.localToWorld(new THREE.Vector3().fromBufferAttribute(base,i)));
      const end=eye.worldToLocal(lens.localToWorld(new THREE.Vector3().fromBufferAttribute(base,i).add(new THREE.Vector3().fromBufferAttribute(delta,i))));
      assert.ok(Math.abs(end.y-(start.y*fit.scale+fit.offset))<1e-5);
      assert.ok(Math.abs(end.x-start.x)<1e-5);assert.ok(Math.abs(end.z-start.z)<1e-5);
    }
  }
});
test('reinitialization reuses the existing blue-lens Blink targets',()=>{
  const {scene,lenses}=fixture();addLensBlinkTargets(scene);const geometry=lenses[0].geometry;
  addLensBlinkTargets(scene);assert.equal(lenses[0].geometry,geometry);assert.equal(geometry.morphAttributes.position.length,1);
});
