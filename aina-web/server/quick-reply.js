import {GREETING} from './qwen.js';
// Deterministic small-talk only, not canned answers to substantive questions.
export function quickReply(text=''){
  const value=text.toLowerCase().replace(/[^a-z0-9]/g,'');
  if(/^(?:hi|hai|helo|hello)(?:aina)?$/.test(value))return GREETING;
  if(/^(?:(?:hi|hai|helo|hello))?(?:aina)?(?:sihat(?:ke)?|apakhabar)(?:aina)?$/.test(value))return 'Hai! Saya sihat. Awak pula?';
  return null;
}
