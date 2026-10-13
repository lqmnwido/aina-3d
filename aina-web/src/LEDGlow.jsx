import {useEffect,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {preserveBloomAlpha} from './neon-led';
export default function LEDGlow(){
  const {gl,scene,camera,size,invalidate}=useThree();
  const chain=useRef(null);
  useEffect(()=>{
    const composer=new EffectComposer(gl);
    const render=new RenderPass(scene,camera);
    // A high threshold keeps ordinary pastel surfaces out of the LED halo.
    const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.4,.3,1.4);
    preserveBloomAlpha(bloom);
    const output=new OutputPass();
    composer.addPass(render);composer.addPass(bloom);composer.addPass(output);
    chain.current={composer,render,bloom,output};invalidate();
    return()=>{chain.current=null;render.dispose();bloom.dispose();output.dispose();composer.dispose();};
  },[gl,scene,camera,invalidate]);
  useEffect(()=>{
    const composer=chain.current?.composer;
    if(composer){composer.setPixelRatio(Math.min(gl.getPixelRatio(),1.25));composer.setSize(size.width,size.height);invalidate();}
  },[gl,size.width,size.height,invalidate]);
  useFrame((_,delta)=>{if(chain.current)chain.current.composer.render(delta);else gl.render(scene,camera);},1);
  return null;
}
