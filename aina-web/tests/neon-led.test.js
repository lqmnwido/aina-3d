import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {addLensBlinkTargets} from '../src/eye-blink.js';
import {applyNeonLEDs,preserveBloomAlpha,FACE_LED_INTENSITY} from '../src/neon-led.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {Vector2} from 'three';
test('LED bloom preserves transparent background instead of painting it black',()=>{
  const bloom=new UnrealBloomPass(new Vector2(1,1),.4,.3,1.4);
  try{
    preserveBloomAlpha(bloom);
    for(const material of bloom.separableBlurMaterials){
      assert.ok(!material.fragmentShader.includes('vec4( diffuseSum, 1.0 )'));
      assert.ok(material.fragmentShader.includes('clamp( max( max( diffuseSum.r'));
    }
  }finally{bloom.dispose();}
});
test('face outline glows while all decorative glass lines are hidden and Blink remains intact',async()=>{
  const bytes=readFileSync(new URL('../public/models/aina.glb',import.meta.url));
  const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const lenses=addLensBlinkTargets(scene),geometry=lenses.map(lens=>lens.geometry);
  const eye=scene.getObjectByName('EyeL'),originalEyeMaterial=eye.material;
  const lights=applyNeonLEDs(scene);assert.equal(lights.length,1);
  for(const light of lights){assert.equal(light.visible,true);assert.ok(light.material.emissive.getHex()>0);}
  assert.equal(eye.material,originalEyeMaterial,'black eyes retain their original material');
  let seams=0,glassLines=0;scene.traverse(object=>{
    const name=object.name.toLowerCase().replace(/[^a-z0-9]/g,'');
    if(!object.isMesh)return;
    if(name.startsWith('bluelensmeniscus')||name==='eyebezell'||name==='eyebezelr')assert.equal(object.visible,false);
    if(name.includes('fittedluminousseam')){
      assert.equal(object.visible,true);assert.equal(object.material.emissiveIntensity,FACE_LED_INTENSITY);seams++;
    }
    if(name.includes('outerpearlbubblerim')||name.includes('inneropticalrim')||name.includes('lowercyanarc')){
      assert.equal(object.visible,false);glassLines++;
    }
  });assert.equal(seams,1);assert.equal(glassLines,3);
  let globe;scene.traverse(object=>{if(object.name.toLowerCase().includes('transparent_bubble_shell'))globe=object;});
  assert.ok(globe);assert.equal(globe.visible,true,'the glass globe remains visible');
  lenses.forEach((lens,index)=>{assert.equal(lens.geometry,geometry[index]);assert.equal(lens.morphTargetDictionary.Blink,0);});
});
