import React,{useCallback,useEffect,useRef,useState} from 'react';
import {LAUNCH_TIMING} from './launch';
import LaunchSmoke from './LaunchSmoke';
export default function LaunchReveal({video,exhaustPath,landing,onClose,onEnded}){
  const player=useRef(null);
  const cloudSnapshot=useRef([]),announceRef=useRef(true);
  const [videoReady,setVideoReady]=useState(false);
  const [returning,setReturning]=useState(false),[ending,setEnding]=useState(false),[clearing,setClearing]=useState(false);
  const finishing=useRef(false),returnTimer=useRef(null),callbacks=useRef({onClose,onEnded});callbacks.current={onClose,onEnded};
  useEffect(()=>()=>clearTimeout(returnTimer.current),[]);
  const finish=useCallback(announce=>{
    if(finishing.current)return;
    finishing.current=true;
    announceRef.current=announce;
    if(!announce)player.current?.pause();
    // Keep the complete final frame unobscured, then smoke and fade it away.
    returnTimer.current=setTimeout(()=>{
      setReturning(true);
    },LAUNCH_TIMING.returnDelay*1000);
  },[]);
  const coverReturn=useCallback(()=>{
    setEnding(true);
    returnTimer.current=setTimeout(()=>{
      setClearing(true);
      // Start descent once the video is hidden; dissolve the transition veil
      // while world-space exhaust follows the actual landing flame.
      (announceRef.current?callbacks.current.onEnded:callbacks.current.onClose)();
    },LAUNCH_TIMING.fadeOut*1000);
  },[]);
  useEffect(()=>{const listener=e=>{if(e.key==='Escape')finish(false);};window.addEventListener('keydown',listener);return()=>window.removeEventListener('keydown',listener);},[finish]);
  const [error,setError]=useState(false);
  const [blocked,setBlocked]=useState(false);
  const play=useCallback(async()=>{
    const element=player.current;if(!element)return;
    element.muted=false;element.defaultMuted=false;element.volume=1;
    try{await element.play();setBlocked(false);}
    catch(e){if(e.name==='NotAllowedError')setBlocked(true);else if(e.name!=='AbortError')setError(true);}
  },[]);
  return <div className={`launch-reveal ${videoReady?'video-ready':''} ${ending?'montage-ending':''} ${clearing?'smoke-clearing':''} ${landing?'landing-stage':''}`} style={{'--fade-out':`${LAUNCH_TIMING.fadeOut}s`,'--smoke-clear':`${LAUNCH_TIMING.clearSmoke}s`}} aria-label="Pelancaran ViTuTi">
    <LaunchSmoke path={exhaustPath} snapshot={cloudSnapshot} clearing={videoReady||returning} onCovered={()=>{if(!finishing.current){setVideoReady(true);play();}}}/>
    {returning&&<LaunchSmoke path={exhaustPath} snapshot={cloudSnapshot} reverse clearing={clearing} onCovered={coverReturn}/>}
    <div className="montage-reveal"><video ref={player} src={video} playsInline preload="auto" disablePictureInPicture disableRemotePlayback controlsList="nodownload nofullscreen noremoteplayback" aria-label="Video montage" onClick={()=>{if(blocked&&!finishing.current)play();}} onContextMenu={e=>e.preventDefault()} onError={()=>setError(true)} onEnded={()=>finish(true)}/>{error&&<p className="montage-error" role="alert">Video montage tidak dapat dimainkan.</p>}{blocked&&!error&&<span className="video-accessibility-status" role="status">Klik video untuk mainkan dengan suara.</span>}
    </div>
  </div>;
}
