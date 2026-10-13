import React,{useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
const vertex=`varying vec2 uvFlame;void main(){uvFlame=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const fragment=`
  varying vec2 uvFlame;uniform float time;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
  void main(){
    vec2 uv=uvFlame;float y=uv.y;
    float turbulence=noise(vec2(uv.x*9.,y*12.+time*9.))*.65+noise(vec2(uv.x*19.,y*24.+time*17.))*.35;
    float curl=sin(y*14.-time*10.)*.04*(1.-y);
    float width=(.035+.23*pow(y,.65))*(.7+.4*turbulence);
    float radius=abs(uv.x-.5-curl)/width;
    float plume=1.-smoothstep(.25,1.,radius);
    float tip=smoothstep(.02,.2,y)*(1.-smoothstep(.89,1.,y));
    float alpha=plume*tip*(.45+.55*turbulence);
    vec3 orange=vec3(1.,.18,.018),gold=vec3(1.,.65,.12),core=vec3(.75,.96,1.);
    vec3 color=mix(orange,gold,plume);color=mix(color,core,pow(plume,4.)*smoothstep(.25,.85,y));
    gl_FragColor=vec4(color*1.8,alpha*.8);
  }`;
export default function RocketExhaust(){
  const sparks=useRef();
  const material=useMemo(()=>new THREE.ShaderMaterial({uniforms:{time:{value:0}},vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false}),[]);
  React.useEffect(()=>()=>material.dispose(),[material]);
  useFrame(({clock})=>{
    const t=clock.elapsedTime;material.uniforms.time.value=t;
    sparks.current?.children.forEach((spark,i)=>{const age=(t*(1.3+i*.035)+i*.17)%1;spark.position.set(Math.sin(i*7.1)*age*.25,-age*1.8,Math.cos(i*3.9)*age*.18);spark.scale.setScalar((1-age)*.026);});
  });
  return <group>
    {[0,Math.PI/3,Math.PI*2/3].map(angle=><mesh key={angle} position={[0,-.63,0]} rotation={[0,angle,0]} material={material}><planeGeometry args={[.8,1.5]}/></mesh>)}
    <group ref={sparks}>{Array.from({length:16},(_,i)=><mesh key={i}><sphereGeometry args={[1,6,4]}/><meshBasicMaterial color={i%2?'#ffb253':'#d6ffff'} toneMapped={false} transparent opacity={.8} depthWrite={false} blending={THREE.AdditiveBlending}/></mesh>)}</group>
    <pointLight color="#ffb368" intensity={5} distance={3}/>
  </group>;
}
