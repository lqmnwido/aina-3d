export function isLaunchCommand(text=''){
  const words=text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g,'');
  // Accept ViTuTi and the explicitly requested ASR pronunciation fallbacks.
  // Anchor the whole command so questions and negated requests never launch.
  return /^(?:tolong)?(?:launchkan|lancarkan)(?:vituti|vtuti|vtwot|vtt|videotih|vtuit|vitotti)$/.test(words);
}
export function rocketPose(seconds){
  if(seconds<0)return {y:0,tilt:0,scale:1};
  const lift=Math.max(0,seconds);
  // Keep the character in view during the first part of the ascent. Smoke
  // must not obscure this phase; accelerate and recede into the sky afterward.
  return {y:.55*lift*lift+.35*lift*lift*lift,tilt:-.13*(1-Math.exp(-lift*2)),scale:Math.max(.68,1-lift*.12)};
}
export const LAUNCH_ACK='Okay, saya akan lancarkan ViTuTi sekarang!';
export const LANDING_MESSAGE='ViTuTi telah berjaya dilancarkan! Terima Kasih kepada semua pihak!';
export const LAUNCH_TIMING={smoke:0,montage:4.15,playback:4.25,flight:3.2,landing:4.2,returnDelay:.6,fadeOut:2,clearSmoke:1.6};
export function landingPose(seconds){
  if(seconds>=LAUNCH_TIMING.landing)return {x:0,y:0,tilt:0,scale:1};
  const progress=Math.max(0,Math.min(1,seconds/3.2));
  const eased=progress*progress*(3-2*progress);
  const settle=Math.max(0,Math.min(1,seconds-3.2));
  const bounce=seconds>3.2&&seconds<4.2?Math.abs(Math.sin(settle*Math.PI*2))*(1-settle)*.14:0;
  return {x:.3*Math.sin(progress*Math.PI),y:3.7*(1-eased)+bounce,tilt:.1*Math.sin(progress*Math.PI*2),scale:.72+.28*eased-.025*Math.pow(Math.sin(settle*Math.PI),2)};
}
