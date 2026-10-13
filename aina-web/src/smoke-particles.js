export class SmokeParticles{
  constructor(count=192){
    this.count=count;this.positions=new Float32Array(count*3);this.radii=new Float32Array(count);this.opacity=new Float32Array(count);
    this.base=new Float32Array(count*3);this.born=new Float64Array(count).fill(-100);this.index=0;this.emitting=false;this.lastEmission=0;this.previous=null;
    this.landing=new Uint8Array(count);this.direction=new Float32Array(count*3);this.ground=new Float32Array(count);
  }
  spawn(time,point,options={}){
    const i=this.index++%this.count;this.born[i]=time;
    this.base[i*3]=point.x+Math.sin(i*7.3)*.055;this.base[i*3+1]=point.y;this.base[i*3+2]=point.z+Math.cos(i*5.7)*.055;
    this.landing[i]=options.landing?1:0;this.ground[i]=options.groundY??-.055;
    const d=options.direction||{x:0,y:-1,z:0};this.direction.set([d.x,d.y,d.z],i*3);
  }
  update(time,origin,options={}){
    if(origin){
      if(!this.emitting){for(let i=0;i<6;i++)this.spawn(time-i*.012,origin,options);this.lastEmission=time;}
      else{
        const steps=Math.min(8,Math.floor((time-this.lastEmission)/.016));
        for(let j=1;j<=steps;j++){const fraction=j/steps;this.spawn(time-(steps-j)*.016,{x:this.previous.x+(origin.x-this.previous.x)*fraction,y:this.previous.y+(origin.y-this.previous.y)*fraction,z:this.previous.z+(origin.z-this.previous.z)*fraction},options);}
        if(steps)this.lastEmission=time;
      }
      this.previous={x:origin.x,y:origin.y,z:origin.z};this.emitting=true;
    }else this.emitting=false;
    for(let i=0;i<this.count;i++){
      const landing=Boolean(this.landing[i]),life=landing?2.2:1.5;
      const age=time-this.born[i],alive=age>=0&&age<life;
      this.opacity[i]=alive?(1-age/life)*(landing?.4:.65):0;this.radii[i]=alive ? (landing?.12:.24)+age*(landing?.22:.5) : 0;
      if(alive&&landing){
        const floor=this.ground[i]+.08,speed=2.8;
        const dy=Math.min(-.3,this.direction[i*3+1]);
        const hit=Math.max(0,(this.base[i*3+1]-floor)/(-dy*speed));
        const fall=Math.min(age,hit),spread=Math.max(0,age-hit);
        const angle=i*2.39996,radial=spread*(1.05+.3*Math.sin(i*3.1));
        this.positions[i*3]=this.base[i*3]+this.direction[i*3]*speed*fall+Math.cos(angle)*radial;
        this.positions[i*3+1]=Math.max(floor,this.base[i*3+1]+dy*speed*fall)+spread*.1;
        this.positions[i*3+2]=this.base[i*3+2]+this.direction[i*3+2]*speed*fall+Math.sin(angle)*radial;
        this.radii[i]+=(spread*.5);
        continue;
      }
      if(alive){this.positions[i*3]=this.base[i*3]+Math.sin(i*7.3)*age*.13;this.positions[i*3+1]=this.base[i*3+1]-age*.5;this.positions[i*3+2]=this.base[i*3+2]+Math.cos(i*5.7)*age*.10;}
    }
  }
}
