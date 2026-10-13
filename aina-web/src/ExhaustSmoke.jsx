import React,{forwardRef,useImperativeHandle,useMemo,useEffect} from 'react';
import * as THREE from 'three';
import {SmokeParticles} from './smoke-particles';
const vertex=`attribute float radius;attribute float opacity;varying float alpha;void main(){alpha=opacity;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=min(180.,radius*650./max(.1,-p.z));}`;
const fragment=`varying float alpha;uniform float time;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
void main(){vec2 uv=gl_PointCoord;float r=length(uv-.5)*2.;float n=noise(uv*5.+vec2(time*.2,0.))*.65+noise(uv*11.-time*.13)*.35;float soft=1.-smoothstep(.1,.75+n*.3,r);gl_FragColor=vec4(vec3(.24,.25,.27)+(n-.5)*.07,alpha*soft*(.25+n*.45));}`;
export default forwardRef(function ExhaustSmoke(_,ref){
  const data=useMemo(()=>{
    const geometry=new THREE.BufferGeometry();
    const particles=new SmokeParticles();
    geometry.setAttribute('position',new THREE.BufferAttribute(particles.positions,3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('radius',new THREE.BufferAttribute(particles.radii,1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('opacity',new THREE.BufferAttribute(particles.opacity,1).setUsage(THREE.DynamicDrawUsage));
    const material=new THREE.ShaderMaterial({uniforms:{time:{value:0}},vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false});
    return {geometry,material,particles,origin:new THREE.Vector3(),direction:new THREE.Vector3()};
  },[]);
  useEffect(()=>()=>{data.geometry.dispose();data.material.dispose();},[data]);
  useImperativeHandle(ref,()=>({update(time,source,options={}){
    // Emit near the flame's upper plume: its long tip is below the viewport at
    // ignition, which otherwise makes even immediate particles appear late.
    if(source){source.updateWorldMatrix(true,false);data.origin.set(0,-.25,0).applyMatrix4(source.matrixWorld);data.direction.set(0,-1,0).transformDirection(source.matrixWorld);}
    data.particles.update(time,source?data.origin:null,{...options,direction:data.direction});
    data.material.uniforms.time.value=time;
    data.geometry.userData.landing=Boolean(options.landing);
    for(const key of ['position','radius','opacity'])data.geometry.attributes[key].needsUpdate=true;
  }}),[data]);
  return <points name="aina-exhaust-smoke" geometry={data.geometry} material={data.material} frustumCulled={false}/>;
});
