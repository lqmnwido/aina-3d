import React,{useCallback,useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {X} from 'lucide-react';
import Avatar from './Avatar';
import {Speaker,GREETING} from './speech';
import './styles.css';
import {LAUNCH_ACK,LANDING_MESSAGE} from './launch';
import LaunchReveal from './LaunchReveal';
import {JetpackSound} from './jetpack-sound';
const MONTAGE_VIDEO='/media/precomp_13-current.mp4';
const stars=Array.from({length:135},(_,i)=>({x:(i*73.37+19)%100,y:(i*47.91+7)%100,r:(i%13===0?1.1:.35+(i%4)*.14)*.12,opacity:.18+(i%6)*.08}));
function SpaceBackdrop(){
  return <div className="space-backdrop" aria-hidden="true"><div className="space-nebula"/><svg className="space-stars" viewBox="0 0 100 100" preserveAspectRatio="none">{stars.map((s,i)=><circle key={i} cx={s.x} cy={s.y} r={s.r} fill="white" opacity={s.opacity}/>)}</svg><div className="space-planet"><div className="planet-ring"/></div><div className="space-horizon"/></div>;
}
function App(){
  const [started,setStarted]=useState(false),[greeting,setGreeting]=useState(false);
  const greetingRef=useRef(false);
  const [loaded,setLoaded]=useState(false),[launch,setLaunch]=useState(0),[landing,setLanding]=useState(0),[montage,setMontage]=useState(0);
  const [preparingLaunch,setPreparingLaunch]=useState(false),[joyful,setJoyful]=useState(false),[wave,setWave]=useState(0),[error,setError]=useState('');
  const speaker=useRef(null),jetpack=useRef(null),launchRef=useRef(0),landingRef=useRef(0),announceLanding=useRef(false),generation=useRef(0),takeOffId=useRef(0),exhaustPath=useRef(null);
  const onLoaded=useCallback(()=>setLoaded(true),[]);
  useEffect(()=>{
    speaker.current=new Speaker(()=>{});jetpack.current=new JetpackSound();
    speaker.current.preloadScripted().catch(()=>{});
    return()=>{generation.current++;speaker.current.stop();jetpack.current.stop();};
  },[]);
  const launchAina=useCallback(async()=>{
    if(!loaded||!started||greetingRef.current||launchRef.current||landingRef.current)return;
    const id=Date.now(),ticket=++generation.current;
    launchRef.current=id;exhaustPath.current=null;setError('');setPreparingLaunch(true);setWave(v=>v+1);
    let departed=false;
    try{
      await speaker.current.unlock();jetpack.current.prepare(speaker.current.context);
      await speaker.current.speak(LAUNCH_ACK,'local',undefined,'cheerful');
      if(ticket===generation.current){departed=true;setLaunch(id);}
    }catch(e){if(ticket===generation.current&&e.name!=='AbortError')setError(e.message);}
    finally{setPreparingLaunch(false);if(!departed&&launchRef.current===id)launchRef.current=0;}
  },[loaded,started]);
  const start=useCallback(async()=>{
    if(!loaded||greetingRef.current||started)return;
    greetingRef.current=true;setGreeting(true);setJoyful(true);setError('');setWave(v=>v+1);
    const ticket=++generation.current;
    try{
      await speaker.current.unlock();
      const [welcome,instruction]=GREETING.split(/(?<=!)\s+/u);
      await speaker.current.speak(welcome,'local',undefined,'greetingHype');
      if(ticket!==generation.current)return;
      // End the first audio and mouth animation, then wait in real time.
      await new Promise(resolve=>setTimeout(resolve,400));
      if(ticket!==generation.current)return;
      await speaker.current.speak(instruction,'local',undefined,'greetingHype');
      setStarted(true);
    }catch(e){if(e.name!=='AbortError')setError(e.message);}
    finally{greetingRef.current=false;setGreeting(false);setJoyful(false);}
  },[loaded,started]);
  useEffect(()=>{
    const keydown=event=>{
      if(event.code!=='Space'||event.repeat||event.ctrlKey||event.altKey||event.metaKey)return;
      if(event.target instanceof HTMLElement&&event.target.closest('button,input,textarea,select,[contenteditable="true"]'))return;
      event.preventDefault();launchAina();
    };
    window.addEventListener('keydown',keydown);return()=>window.removeEventListener('keydown',keydown);
  },[launchAina]);
  useEffect(()=>{
    let press=null;
    const blocked=target=>target instanceof Element&&target.closest('button,input,textarea,select,video,.error,[contenteditable="true"]');
    const down=event=>{
      press=event.isPrimary&&event.button===0&&!blocked(event.target)
        ?{id:event.pointerId,x:event.clientX,y:event.clientY,time:performance.now()}:null;
    };
    const up=event=>{
      const start=press;press=null;
      if(!start||start.id!==event.pointerId||blocked(event.target))return;
      if(Math.hypot(event.clientX-start.x,event.clientY-start.y)>10||performance.now()-start.time>700)return;
      launchAina();
    };
    const cancel=()=>{press=null;};
    window.addEventListener('pointerdown',down,true);window.addEventListener('pointerup',up,true);window.addEventListener('pointercancel',cancel,true);
    return()=>{window.removeEventListener('pointerdown',down,true);window.removeEventListener('pointerup',up,true);window.removeEventListener('pointercancel',cancel,true);};
  },[launchAina]);
  const takeOff=useCallback(id=>{if(takeOffId.current===id)return;takeOffId.current=id;setMontage(id);jetpack.current?.play(speaker.current.context);},[]);
  const landingStart=useCallback(()=>jetpack.current?.play(speaker.current.context,{landing:true}),[]);
  const finishLaunch=announce=>{if(landingRef.current)return;jetpack.current?.stop();announceLanding.current=announce;setLaunch(0);const id=Date.now();landingRef.current=id;setLanding(id);};
  const landed=useCallback(async()=>{
    if(!landingRef.current)return;
    landingRef.current=0;jetpack.current?.stop();setLanding(0);setMontage(0);
    try{
      if(announceLanding.current){setJoyful(true);setWave(v=>v+1);await speaker.current.speak(LANDING_MESSAGE,'local',undefined,'natural');}
    }catch(e){if(e.name!=='AbortError')setError(e.message);}
    finally{launchRef.current=0;setJoyful(false);}
  },[]);
  const active=greeting||preparingLaunch||launch>0||landing>0||joyful;
  return <div className="app-shell model-only space-theme">
    <SpaceBackdrop/>
    <main className="voice-room" data-launch-ready={started&&!active}>
      <div className="avatar-wrap"><Avatar wave={wave} joyful={joyful} spin={0} view={0} launch={launch} exhaustPath={exhaustPath} preparingLaunch={preparingLaunch} landing={landing} onTakeOff={takeOff} onLandingStart={landingStart} onLanded={landed} onLoaded={onLoaded}/></div>
      {!active&&!started&&<button className="space-launch-hint" onClick={start} disabled={!loaded} aria-label="Start bersama AINA"><span>{loaded?'Start bersama AINA':'Menyediakan AINA…'}</span></button>}
      {error&&<div className="error" role="alert"><span>{error}</span><button onClick={()=>setError('')} aria-label="Tutup ralat"><X size={15}/></button></div>}
    </main>
    {montage>0&&<LaunchReveal key={montage} video={MONTAGE_VIDEO} exhaustPath={exhaustPath} landing={Boolean(landing)} onClose={()=>finishLaunch(false)} onEnded={()=>finishLaunch(true)}/>}
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
