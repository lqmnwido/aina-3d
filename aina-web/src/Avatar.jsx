import React,{Suspense,useEffect,useRef,useState} from 'react';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {useGLTF,Environment,Lightformer,ContactShadows,OrbitControls} from '@react-three/drei';
import * as THREE from 'three';
import {motion} from './speech';
import {rocketPose,landingPose,LAUNCH_TIMING} from './launch';
import RocketExhaust from './RocketExhaust';
import ExhaustSmoke from './ExhaustSmoke';
import {addLensBlinkTargets} from './eye-blink';
import {createAngryFace,applyAngryFace} from './angry-face';
import {applyNeonLEDs} from './neon-led';
import LEDGlow from './LEDGlow';
import {createHelmetGlass} from './helmet-glass';
import {fitEyesToOutlines} from './eye-size';

function AnimationBudget(){
  const invalidate=useThree(state=>state.invalidate);
  useEffect(()=>{const timer=setInterval(()=>{if(!document.hidden)invalidate();},1000/30);return()=>clearInterval(timer);},[invalidate]);
  return null;
}

function Character({wave,joyful,spin,view,launch,landing,exhaustPath,onTakeOff,onLandingStart,onLanded,onLoaded}){
  const {gl,camera,scene:world}=useThree();
  const {scene}=useGLTF('/models/aina.glb');const group=useRef(),rig=useRef({morphs:[],arm:null});
  const time=useRef(0),waveStart=useRef(-100),spinStart=useRef(-100),spinBase=useRef(0),nextBlink=useRef(2.5);
  const launchStart=useRef(-100),flame=useRef();
  const smoke=useRef();
  const projectedExhaust=useRef(new THREE.Vector3());
  const joy=useRef(0);
  const anger=useRef(0),angryFace=useRef([]);
  const landingStart=useRef(-100),landingDone=useRef(false);
  useEffect(()=>{landingStart.current=-100;landingDone.current=false;},[landing]);
  // Start at the first rendered flight frame, not before a GPU/context stall.
  useEffect(()=>{launchStart.current=-100;},[launch]);
  useEffect(()=>{if(wave)waveStart.current=time.current;},[wave]);
  useEffect(()=>{if(spin){spinStart.current=time.current;spinBase.current=group.current?.rotation.y||0;}},[spin]);
  useEffect(()=>{spinStart.current=-100;if(group.current)group.current.rotation.y=view;},[view]);
  useEffect(()=>{
    fitEyesToOutlines(scene);
    addLensBlinkTargets(scene);
    angryFace.current=createAngryFace(scene);
    applyNeonLEDs(scene);
    const morphs=[];let arm=null;
    scene.traverse(o=>{
      if(o.morphTargetDictionary)morphs.push(o);
      if(o.name.toLowerCase().replace(/[^a-z0-9]/g,'').includes('ctrlflipperl')&&!o.isMesh)arm={object:o,rotation:o.rotation.clone()};
      if(o.isMesh){
        o.castShadow=true;
        if(o.name.includes('transparent_bubble_shell')){
          o.material=createHelmetGlass();
          o.castShadow=false;
        }
        if(o.name.startsWith('Cheek')){o.material.transparent=true;o.material.opacity=.09;o.material.depthWrite=false;}
        if(o.name.includes('oral_cavity')){o.material.side=THREE.DoubleSide;o.material.roughness=.95;}
        if(o.name.includes('upper_teeth')||o.name.includes('tongue'))o.material.side=THREE.DoubleSide;
      }
    });
    rig.current={morphs,arm};
    let disposed=false;
    const frame=requestAnimationFrame(()=>{
      // Hidden exhaust normally compiles on first take-off. Compile it before
      // enabling Start; restore visibility synchronously before the next draw.
      const visible=flame.current.visible;flame.current.visible=true;
      let ready;
      try{ready=gl.compileAsync(world,camera);}finally{flame.current.visible=visible;}
      ready.then(()=>{if(!disposed)onLoaded();}).catch(()=>{if(!disposed)onLoaded();});
    });
    return()=>{disposed=true;cancelAnimationFrame(frame);};
  },[scene,onLoaded,gl,camera,world]);
  useFrame(({clock},dt)=>{
    const t=clock.elapsedTime;time.current=t;
    joy.current=THREE.MathUtils.damp(joy.current,joyful?1:0,5,dt);
    anger.current=THREE.MathUtils.damp(anger.current,motion.voiceActive&&motion.expression==='annoyed'?1:0,12,dt);
    applyAngryFace(angryFace.current,anger.current);
    if(t>nextBlink.current+.18)nextBlink.current=t+3+Math.random()*3;
    const blink=t>=nextBlink.current?Math.sin(Math.min(1,(t-nextBlink.current)/.18)*Math.PI):0;
    for(const o of rig.current.morphs){
      const d=o.morphTargetDictionary,w=o.morphTargetInfluences;
      for(const [key,target] of [['MouthOpen',motion.open],['MouthRound',motion.round],['MouthWide',motion.wide],['MouthClosed',motion.closed],['MouthFV',motion.fv],['Blink',blink]])if(d[key]!==undefined)w[d[key]]=THREE.MathUtils.damp(w[d[key]],target||0,22,dt);
    }
    const elapsed=t-waveStart.current;
    // Source video: lift ~0.8s, rock the left flipper repeatedly, lower ~4.2s.
    const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
    const envelope=ease((elapsed-.45)/.65)*(1-ease((elapsed-3.95)/.8));
    const waveAngle=envelope*(1+.12*joy.current)*(1.5+.23*Math.sin((elapsed-1.2)*Math.PI*4));
    const arm=rig.current.arm;if(arm)arm.object.rotation.z=arm.rotation.z-waveAngle;
    if(group.current){
      if(launch&&launchStart.current===-100){launchStart.current=performance.now();onTakeOff(launch);}
      if(landing&&landingStart.current===-100){landingStart.current=performance.now();onLandingStart();}
      const landingElapsed=(performance.now()-landingStart.current)/1000;
      const flight=landing?landingPose(landingElapsed):rocketPose(launch?(performance.now()-launchStart.current)/1000:-1);
      group.current.position.y=Math.sin(t*1.5)*.018+flight.y+joy.current*Math.sin(t*5)*.018;
      group.current.position.x=flight.x||0;
      group.current.rotation.z=Math.sin(t*.65)*.008-envelope*.06+flight.tilt;
      group.current.scale.setScalar(flight.scale);
      const thrust=Boolean(launch)&&(performance.now()-launchStart.current)/1000<LAUNCH_TIMING.flight;
      if(flame.current){flame.current.visible=thrust||(Boolean(landing)&&landingElapsed<3.2);flame.current.scale.setScalar((launch?1:.5*Math.max(0,1-landingElapsed/3.2))*(.9+Math.sin(t*50)*.12));}
      const landingThrust=Boolean(landing)&&landingElapsed<3.2;
      smoke.current?.update(t,thrust||landingThrust?flame.current:null,{landing:landingThrust,groundY:-.055});
      if(launch||landing){group.current.updateWorldMatrix(true,false);projectedExhaust.current.set(0,-.4,0).applyMatrix4(group.current.matrixWorld).project(camera);exhaustPath.current={x:(projectedExhaust.current.x+1)/2,y:(1-projectedExhaust.current.y)/2,active:thrust||landingThrust,mode:landing?'landing':'launch'};}
      const progress=Math.max(0,Math.min(1,(t-spinStart.current)/8));
      if(progress<1)group.current.rotation.y=spinBase.current+ease(progress)*Math.PI*2;
      if(landing&&landingElapsed>=LAUNCH_TIMING.landing&&!landingDone.current){landingDone.current=true;onLanded();}
    }
  });
  return <><group ref={group} name="aina-flight-rig"><primitive object={scene}/><group ref={flame} name="aina-rocket-exhaust" visible={false} position={[0,-.15,0]}><RocketExhaust/></group></group><ExhaustSmoke ref={smoke}/></>;
}
class SceneBoundary extends React.Component{state={failed:false};static getDerivedStateFromError(){return{failed:true};}componentDidCatch(){this.props.onError();}render(){return this.state.failed?null:this.props.children;}}
export default function Avatar(props){
  const [failed,setFailed]=useState(false);
  return <div className={`avatar-canvas ${props.launch?'launching':props.landing?'landing':''}`} style={{'--flight-duration':`${LAUNCH_TIMING.flight}s`,'--landing-duration':`${LAUNCH_TIMING.landing}s`}} aria-label="AINA dalam glob kaca, model 3D boleh diputar">
    {failed?<img className="aina-fallback" src="/models/aina-fallback.png" alt="Aina" onLoad={props.onLoaded} onAnimationStart={()=>{if(props.launch)props.onTakeOff(props.launch);else if(props.landing)props.onLandingStart();}} onAnimationEnd={()=>{if(props.landing)props.onLanded();}}/>:<SceneBoundary onError={()=>setFailed(true)}><Canvas frameloop={props.preparingLaunch||props.launch||props.landing?'always':'demand'} dpr={[1,1.5]} camera={{position:[0,1.64,7.5],fov:32}} gl={{antialias:true,alpha:true}} onCreated={({gl})=>{gl.setClearColor('#000000',0);gl.toneMapping=THREE.ACESFilmicToneMapping;}}>
      <AnimationBudget/><LEDGlow/>
      <ambientLight intensity={.65}/><directionalLight position={[2,5,4]} intensity={2.2} color="#fff2fa"/>
      <pointLight position={[-3,2,2]} intensity={14} color="#ff90ca"/><pointLight position={[3,1,2]} intensity={16} color="#88f5ff"/>
      <Suspense fallback={null}><Environment resolution={256} background={false}>
        <Lightformer position={[-3,2,4]} scale={[.6,4,1]} intensity={4} color="#ffd1ee"/>
        <Lightformer position={[3,3,3]} rotation={[0,0,-.6]} scale={[2.3,.65,1]} intensity={5} color="white"/>
        <Lightformer position={[3,1,0]} rotation={[0,-Math.PI/2,0]} scale={[.5,3,1]} intensity={3} color="#a5faff"/>
        <Lightformer position={[0,5,0]} rotation={[Math.PI/2,0,0]} scale={[8,8,1]} intensity={.8}/>
        <mesh><sphereGeometry args={[30,32,16]}/><meshBasicMaterial color="#c9cbd8" side={THREE.BackSide}/></mesh>
      </Environment><Character {...props}/><ContactShadows position={[0,-.055,0]} opacity={props.launch?0:.23} scale={8} blur={2.8} far={4} resolution={256} frames={1}/></Suspense>
      <OrbitControls enabled={!props.launch&&!props.landing} target={[0,1.6,0]} enablePan={false} enableZoom={false} minPolarAngle={Math.PI/2-.35} maxPolarAngle={Math.PI/2+.35} enableDamping dampingFactor={.12}/>
    </Canvas></SceneBoundary>}
  </div>;
}
