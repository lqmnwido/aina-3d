import React,{useEffect,useRef} from 'react';
import {rocketPose,LAUNCH_TIMING} from './launch';
// Projected exhaust puffs, not a radial burst from a fixed screen location.
export default function LaunchSmoke({path,snapshot,reverse=false,clearing=false,onCovered,onCleared}){
  const canvas=useRef(null);
  const state=useRef({clearing,onCovered,onCleared});state.current={clearing,onCovered,onCleared};
  useEffect(()=>{
    const element=canvas.current,context=element.getContext('2d');
    const puff=document.createElement('canvas');puff.width=puff.height=128;
    const brush=puff.getContext('2d'),gradient=brush.createRadialGradient(58,54,4,64,64,64);
    gradient.addColorStop(0,'rgba(72,75,80,.85)');gradient.addColorStop(.4,'rgba(78,81,86,.6)');gradient.addColorStop(.75,'rgba(88,91,96,.18)');gradient.addColorStop(1,'rgba(88,91,96,0)');
    brush.fillStyle=gradient;brush.fillRect(0,0,128,128);
    const probe=document.createElement('canvas');probe.width=probe.height=16;
    const meter=probe.getContext('2d',{willReadFrequently:true});
    const returnPath=reverse?[...(snapshot?.current||[])]:[];
    // Early cancellation can precede the full-cloud snapshot. Mature enough
    // overlapping puffs along that partial path to cover the screen safely.
    const saved=returnPath.length?returnPath:[{x:.5,y:.8},{x:.5,y:.4},{x:.5,y:0}];
    const particles=reverse?(saved.every(p=>Number.isFinite(p.age))?saved.map(p=>({...p})):
      saved.flatMap((p,i)=>Array.from({length:12},(_,j)=>({...p,seed:i*12+j,age:8})))):[];
    let frame,lastEmission=-1,previous=null,index=0,covered=false,lastProbe=0,clearStart=null;
    const start=performance.now()/1000;
    const draw=()=>{
      const now=performance.now()/1000,elapsed=now-start,width=innerWidth,height=innerHeight;
      if(element.width!==width||element.height!==height){element.width=width;element.height=height;}
      const source=path.current||{x:.5,y:.9-rocketPose(elapsed).y*.23,active:elapsed<LAUNCH_TIMING.flight};
      if(!reverse&&(source.active||particles.length===0)){
        const steps=lastEmission<0?1:Math.min(6,Math.floor((now-lastEmission)/.05));
        for(let j=1;j<=steps;j++){
          const fraction=j/steps,from=previous||source;
          const x=from.x+(source.x-from.x)*fraction,y=from.y+(source.y-from.y)*fraction;
          particles.push({born:now-(steps-j)*.05,x,y,seed:index++});
          if(snapshot&&y>-.3&&y<1.2)snapshot.current.push({x,y});
        }
        if(steps)lastEmission=now;
      }
      previous={x:source.x,y:source.y};context.clearRect(0,0,width,height);
      if(state.current.clearing&&clearStart===null)clearStart=now;
      const clearElapsed=clearStart===null?0:now-clearStart;
      // A transition veil is not engine exhaust: dissolve it in place.
      // Landing exhaust is emitted separately in world space from the nozzle.
      const fade=reverse?(clearStart===null?Math.min(1,elapsed/.8):Math.max(0,1-clearElapsed/1.2)):
        clearStart===null?1:Math.max(0,1-clearElapsed/LAUNCH_TIMING.clearSmoke);
      element.style.opacity=String(fade);
      for(let i=particles.length-1;i>=0;i--){
        const particle=particles[i],age=reverse?particle.age+clearElapsed*.12:now-particle.born;
        if(age<0)continue;
        // Small plume first; accumulated older smoke broadens smoothly.
        const radius=(8+age*18+age*age*37)*Math.min(width,height)/900;
        const alpha=Math.min(.72,.16+age*.17);
        const x=particle.x*width+Math.sin(particle.seed*2.4)*age*26;
        const y=particle.y*height-age*20;
        context.globalAlpha=alpha;
        context.drawImage(puff,x-radius,y-radius,radius*2,radius*2.15);
      }
      element.dataset.particles=String(particles.length);element.dataset.sourceX=String(source.x);element.dataset.sourceY=String(source.y);
      element.dataset.sourceMode=source.mode||'launch';
      // Gate the reveal on actual edge-to-edge opacity, not an assumed timer.
      element.dataset.phase=reverse?(clearStart===null?'wide-cloud':'veil-dissipation'):'exhaust-expansion';
      if(!covered&&elapsed>(reverse?.8:LAUNCH_TIMING.montage)&&now-lastProbe>.2){
        lastProbe=now;meter.clearRect(0,0,16,16);meter.drawImage(element,0,0,16,16);
        const pixels=meter.getImageData(0,0,16,16).data;let minimum=255;
        for(let i=3;i<pixels.length;i+=4)minimum=Math.min(minimum,pixels[i]*fade);
        element.dataset.coverage=String(minimum/255);
        if(minimum>=245){
          covered=true;element.dataset.covered='true';
          if(!reverse&&snapshot)snapshot.current=particles.map(p=>({x:p.x,y:p.y,seed:p.seed,age:now-p.born}));
          state.current.onCovered?.();
        }
      }
      if(clearStart===null||fade>0)frame=requestAnimationFrame(draw);else{context.clearRect(0,0,width,height);state.current.onCleared?.();}
    };
    frame=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frame);
  },[path,snapshot,reverse]);
  return <canvas ref={canvas} className={`rocket-smoke ${reverse?'return-smoke':'launch-trail'}`} aria-hidden="true"/>;
}
