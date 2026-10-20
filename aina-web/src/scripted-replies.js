import {isThanks,THANKS_REPLY} from './social-replies.js';
export const SCRIPTED_HELP='Maaf! Saya tidak dapat membantu Anda!';
export function scriptedReply(text=''){
  if(isThanks(text))return THANKS_REPLY;
  const value=text.toLowerCase().replace(/[^a-z0-9]/g,'');
  if(/^(hi|hai|helo|hello)(aina)?$/.test(value))return 'Selamat Datang YB Menteri! Sila beri arahan untuk lancarkan V2T.';
  if(/^(hi|hai|helo|hello)?(aina)?(sihat(ke)?|apakhabar)(aina)?$/.test(value))return 'Hai! Saya sihat. Awak pula?';
  return SCRIPTED_HELP;
}
