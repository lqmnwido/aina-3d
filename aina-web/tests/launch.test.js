import {test} from 'node:test';import assert from 'node:assert/strict';
import {isLaunchCommand,rocketPose,landingPose,LAUNCH_ACK,LANDING_MESSAGE,LAUNCH_TIMING} from '../src/launch.js';
test('ViTuTi command requires the new montage name and rejects retired names',()=>{
  for(const phrase of ['Tolong launchkan ViTuTi.','TOLONG LAUNCHKAN VITUTI!','Tolong launchkan Vi Tu Ti','Tolong lancarkan ViTuTi','tolong launchkan V two T','tolong lancarkan V two T','Tolong launchkan vituti','tolong lancarkan v t t','TOLONG LANCARKAN V T T.'])assert.equal(isLaunchCommand(phrase),true,phrase);
  for(const phrase of ['Tolong launchkan','Tolong launchkan di rims.','Tolong launchkan D rings','Tolong launchkan D-Reams.','Apa itu ViTuTi?','Tolong makan lunch','Jom kita launch ViTuTi'])assert.equal(isLaunchCommand(phrase),false,phrase);
});
test('v tuit and vitotti work with both launch verbs and punctuation',()=>{
  for(const verb of ['launchkan','lancarkan'])for(const name of ['v tuit','vitotti']){
    const command=`tolong ${verb} ${name}`;
    assert.equal(isLaunchCommand(command),true,command);
    assert.equal(isLaunchCommand(command.toUpperCase()+'.'),true,command);
    assert.equal(isLaunchCommand('Jangan '+command),false,command);
    assert.equal(isLaunchCommand('Kenapa '+command+'?'),false,command);
    assert.equal(isLaunchCommand(command+' projek lain'),false,command);
  }
});

test('launch commands also accept every supported name without tolong',()=>{
  for(const verb of ['launchkan','lancarkan'])for(const name of ['ViTuTi','Vi Tu Ti','V Tuti','V two T','v t t','video tih','v tuit','vitotti']){
    const command=`${verb} ${name}`;
    assert.equal(isLaunchCommand(command),true,command);
    assert.equal(isLaunchCommand(command.toUpperCase()+'.'),true,command);
    for(const invalid of ['Jangan '+command,'Kenapa '+command+'?',command+' projek lain'])assert.equal(isLaunchCommand(invalid),false,invalid);
  }
});
test('rocket immediately climbs smoothly with smoke, then reveals montage',()=>{assert.equal(rocketPose(-1).y,0);assert.equal(rocketPose(0).y,0);assert.ok(rocketPose(.1).y>0);assert.ok(rocketPose(1).y>.1);assert.ok(rocketPose(1.5).y<2.5);assert.ok(rocketPose(2).y>rocketPose(1).y);assert.ok(rocketPose(3).y>9);assert.ok(rocketPose(2).scale<rocketPose(1).scale);assert.equal(LAUNCH_TIMING.smoke,0);assert.ok(LAUNCH_TIMING.montage>LAUNCH_TIMING.flight);assert.ok(LAUNCH_TIMING.playback>=LAUNCH_TIMING.montage);});
test('take-off has no initial shake or discontinuity',()=>{
  let previous=rocketPose(0);
  for(let i=1;i<=60;i++){const current=rocketPose(i/60);assert.ok(current.y>previous.y);assert.ok(current.tilt<=previous.tilt);assert.ok(Math.abs(current.tilt-previous.tilt)<.005);previous=current;}
});
test('negated requests, questions and unrelated launches do not trigger montage',()=>{
  for(const text of ['Jangan tolong launchkan','Jangan tolong launchkan ViTuTi.','Kenapa tolong launchkan ViTuTi?','Jangan tolong launchkan V two T','Kenapa tolong lancarkan V two T?','Jangan tolong lancarkan v t t','Kenapa tolong lancarkan v t t?','Tolong launchkan V two','Tolong launchkan projek lain','Tolong','Launchkan'])assert.equal(isLaunchCommand(text),false,text);
});
test('landing descends, settles and restores size before the exact thank-you line',()=>{
  assert.equal(LAUNCH_ACK,'Okay, saya akan lancarkan ViTuTi sekarang!');
  assert.equal(LANDING_MESSAGE,'ViTuTi telah berjaya dilancarkan! Terima Kasih kepada semua pihak!');
  assert.ok(landingPose(0).y>landingPose(1).y);assert.ok(landingPose(1).y>landingPose(2).y);
  assert.ok(landingPose(2).y>.5,'visible descent lasts beyond two seconds');
  assert.deepEqual(landingPose(LAUNCH_TIMING.landing),{x:0,y:0,tilt:0,scale:1});
});
