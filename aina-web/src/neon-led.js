import * as THREE from 'three';
export const FACE_LED_INTENSITY=3.8;
export function preserveBloomAlpha(bloom){
  // Stock bloom writes opaque alpha even for black pixels. Derive alpha from
  // the light itself so the pastel HTML background stays visible around AINA.
  for(const material of bloom.separableBlurMaterials){
    material.fragmentShader=material.fragmentShader.replace(
      'gl_FragColor = vec4( diffuseSum, 1.0 );',
      'gl_FragColor = vec4( diffuseSum, clamp( max( max( diffuseSum.r, diffuseSum.g ), diffuseSum.b ), 0.0, 1.0 ) );'
    );
    material.needsUpdate=true;
  }
}
export function applyNeonLEDs(scene){
  const lights=[];
  scene.traverse(object=>{
    if(!object.isMesh)return;
    const name=object.name.toLowerCase().replace(/[^a-z0-9]/g,'');
    const blue=name.startsWith('bluelensmeniscus');
    const eyeOutline=name==='eyebezell'||name==='eyebezelr';
    const face=name.includes('fittedluminousseam');
    const glassLine=name.includes('outerpearlbubblerim')||name.includes('inneropticalrim')||name.includes('lowercyanarc');
    if(glassLine||blue||eyeOutline){object.visible=false;return;}
    if(!face)return;
    // Keep the fitted face outline, not decorative lines around the globe.
    object.visible=true;
    const color='#48f5ff';
    const materials=(Array.isArray(object.material)?object.material:[object.material]).map(original=>{
      const material=original.clone();
      material.emissive=new THREE.Color(color);
      material.emissiveIntensity=FACE_LED_INTENSITY;
      material.metalness=.08;material.roughness=.22;
      return material;
    });
    object.material=Array.isArray(object.material)?materials:materials[0];
    lights.push(object);
  });
  return lights;
}
