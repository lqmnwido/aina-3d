import * as THREE from 'three';
const normalized=name=>name.toLowerCase().replace(/[^a-z0-9]/g,'');
export function createAngryFace(scene){
  const controls=[];scene.updateMatrixWorld(true);
  for(const side of ['l','r']){
    const name='aina-expression-eye-'+side;
    const existing=scene.getObjectByName(name);
    if(existing){
      const brow=existing.getObjectByName(name+'-brow');
      if(brow){existing.remove(brow);brow.geometry.dispose();brow.material.dispose();}
      controls.push({pivot:existing,side});continue;
    }
    let eye;scene.traverse(object=>{if(object.isMesh&&normalized(object.name)==='eye'+side)eye=object;});
    if(!eye)continue;
    const parent=eye.parent,pivot=new THREE.Group();pivot.name=name;pivot.position.copy(eye.position);parent.add(pivot);pivot.updateWorldMatrix(true,false);
    const members=[];scene.traverse(object=>{if(object.isMesh&&['eye'+side,'eyebezel'+side,'bluelensmeniscus'+side].includes(normalized(object.name)))members.push(object);});
    // Eye, rim and blue line remain one unit, including their existing Blink.
    for(const object of members)pivot.attach(object);
    controls.push({pivot,side});
  }
  return controls;
}
export function applyAngryFace(controls,amount){
  const value=THREE.MathUtils.clamp(amount,0,1);
  for(const {pivot,side} of controls){
    pivot.rotation.z=(side==='l'?-.10:.10)*value;
    pivot.scale.y=1-.18*value;
  }
}
