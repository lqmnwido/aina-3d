import {LAUNCH_ACK,LANDING_MESSAGE} from './launch.js';
import {SCRIPTED_HELP} from './scripted-replies.js';
export const SCRIPTED_AUDIO=new Map([
  ['Selamat Datang YBM!','/audio/aina-ybm-welcome-hi-tone-v1.wav'],
  ['Sila beri arahan untuk lancarkan V2T.','/audio/aina-ybm-instruction-hi-tone-v1.wav'],
  ['Selamat Datang YBM! Sila beri arahan untuk lancarkan V2T.','/audio/aina-ybm-hi-tone-400ms-preview.wav'],
  [LAUNCH_ACK,'/audio/vituti-launch-dbd50ca0283a.wav'],
  [LANDING_MESSAGE,'/audio/vituti-landing-selected-hype-34db74885b08.wav'],
  [SCRIPTED_HELP,'/audio/aina-unknown-4400b7ae6ad3.wav'],
]);
