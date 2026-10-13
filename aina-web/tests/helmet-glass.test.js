import test from 'node:test';
import assert from 'node:assert/strict';
import {createHelmetGlass} from '../src/helmet-glass.js';

test('helmet is clear glossy dielectric glass without tint, rainbow coating or neon',()=>{
  const glass=createHelmetGlass();
  try{
    assert.equal(glass.isMeshPhysicalMaterial,true);
    assert.equal(glass.color.getHex(),0xffffff);
    assert.equal(glass.transmission,0);
    assert.equal(glass.transparent,true);
    assert.equal(glass.depthWrite,false);
    assert.ok(glass.opacity>0&&glass.opacity<.15);
    assert.equal(glass.metalness,0);
    assert.ok(glass.roughness>0&&glass.roughness<=.02);
    assert.ok(glass.ior>=1.4&&glass.ior<=1.5);
    assert.ok(glass.thickness>0&&glass.thickness<=.015);
    assert.equal(glass.iridescence,0);
    assert.equal(glass.emissive.getHex(),0);
    assert.equal(glass.attenuationDistance,Infinity);
  }finally{glass.dispose();}
});
