import * as THREE from 'three';
const normalized=name=>name.toLowerCase().replace(/[^a-z0-9]/g,'');

export function fitEyesToOutlines(scene){
  const meshes=[];scene.traverse(object=>{if(object.isMesh)meshes.push(object);});
  for(const side of ['l','r']){
    const eye=meshes.find(object=>normalized(object.name)==='eye'+side);
    const rim=meshes.find(object=>normalized(object.name)==='eyebezel'+side);
    if(!eye||!rim||eye.userData.fittedToOutline)continue;
    scene.updateMatrixWorld(true);
    // Measure resting vertices only; geometry.boundingBox also includes Blink.
    const toParent=new THREE.Matrix4().copy(eye.parent.matrixWorld).invert();
    const size=object=>new THREE.Box3().setFromBufferAttribute(object.geometry.attributes.position)
      .applyMatrix4(new THREE.Matrix4().multiplyMatrices(toParent,object.matrixWorld))
      .getSize(new THREE.Vector3());
    const current=size(eye),target=size(rim);
    // Retain the enlarged outline width, but make the front silhouette round.
    // Scale the mesh, not its vertices, so all exported Blink morphs still work.
    eye.scale.x*=target.x/current.x;eye.scale.y*=target.x/current.y;
    eye.userData.fittedToOutline=true;
  }
}
