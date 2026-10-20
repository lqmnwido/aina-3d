import {LAUNCH_ACK,LANDING_MESSAGE} from './launch.js';
import {SCRIPTED_HELP} from './scripted-replies.js';
export const SCRIPTED_AUDIO=new Map([
  ['Selamat Datang YB Menteri!','/audio/aina-yb-menteri-welcome-happy-v10.wav'],
  ['Sila beri arahan untuk lancarkan V2T.','/audio/aina-yb-menteri-instruction-happy-v10.wav'],
  ['Selamat Datang YB Menteri! Sila beri arahan untuk lancarkan V2T.','/audio/aina-yb-menteri-happy-400ms-preview-v10.wav'],
  [LAUNCH_ACK,'/audio/vituti-launch-dbd50ca0283a.wav'],
  [LANDING_MESSAGE,'/audio/vituti-landing-selected-hype-34db74885b08.wav'],
  [SCRIPTED_HELP,'/audio/aina-unknown-4400b7ae6ad3.wav'],
]);
