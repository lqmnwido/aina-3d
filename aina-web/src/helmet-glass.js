import * as THREE from 'three';

export function createHelmetGlass(){
  // The space backdrop is HTML behind a transparent canvas. Alpha composite
  // a thin reflective shell so those stars remain visible through its edges.
  const material=new THREE.MeshPhysicalMaterial({
    color:'#ffffff',metalness:0,roughness:.015,
    transmission:0,thickness:.012,ior:1.45,
    attenuationColor:'#ffffff',attenuationDistance:Infinity,
    clearcoat:0,iridescence:0,envMapIntensity:.7,
    transparent:true,opacity:.12,depthWrite:false,side:THREE.FrontSide,
  });
  material.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',
      'diffuseColor.a *= 0.25 + 2.0 * pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);\n#include <opaque_fragment>');
  };
  material.customProgramCacheKey=()=> 'aina-clear-shell-fresnel-v1';
  return material;
}
