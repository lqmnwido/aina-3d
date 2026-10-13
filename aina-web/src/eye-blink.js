import * as THREE from 'three';
const normalized=name=>name.toLowerCase().replace(/[^a-z0-9]/g,'');

// Derive the eye's actual exported Blink deformation, not an independent timer.
export function eyeBlinkFit(eye){
  const base=eye.geometry.attributes.position;
  const index=eye.morphTargetDictionary?.Blink;
  const target=eye.geometry.morphAttributes.position?.[index];
  if(!base||!target)return null;
  let sumY=0,sumTarget=0,sumYY=0,sumYT=0;
  for(let i=0;i<base.count;i++){
    const y=base.getY(i),t=target.getY(i)+(eye.geometry.morphTargetsRelative?y:0);
    sumY+=y;sumTarget+=t;sumYY+=y*y;sumYT+=y*t;
  }
  const denominator=base.count*sumYY-sumY*sumY;
  if(Math.abs(denominator)<1e-10)return null;
  const scale=(base.count*sumYT-sumY*sumTarget)/denominator;
  return {scale,offset:(sumTarget-scale*sumY)/base.count};
}

export function addLensBlinkTargets(scene){
  const meshes=[];scene.updateMatrixWorld(true);scene.traverse(object=>{if(object.isMesh)meshes.push(object);});
  const lenses=[];
  for(const side of ['l','r']){
    const eye=meshes.find(mesh=>normalized(mesh.name)==='eye'+side);
    const lens=meshes.find(mesh=>normalized(mesh.name)==='bluelensmeniscus'+side);
    if(!eye||!lens)continue;
    if(lens.morphTargetDictionary?.Blink!==undefined){lenses.push(lens);continue;}
    const fit=eyeBlinkFit(eye);if(!fit)continue;
    const geometry=lens.geometry.clone(),base=geometry.attributes.position;
    const delta=new Float32Array(base.count*3),point=new THREE.Vector3(),original=new THREE.Vector3();
    for(let i=0;i<base.count;i++){
      original.fromBufferAttribute(base,i);point.copy(original);
      // Transform through the eye's local coordinates so its pivot, scale and
      // downward eyelid motion also apply to the separate blue lens geometry.
      lens.localToWorld(point);eye.worldToLocal(point);
      point.y=point.y*fit.scale+fit.offset;
      eye.localToWorld(point);lens.worldToLocal(point);point.sub(original);
      delta.set([point.x,point.y,point.z],i*3);
    }
    const blink=new THREE.BufferAttribute(delta,3);blink.name='Blink';
    geometry.morphTargetsRelative=true;geometry.morphAttributes.position=[blink];
    lens.geometry=geometry;lens.updateMorphTargets();lenses.push(lens);
  }
  return lenses;
}
