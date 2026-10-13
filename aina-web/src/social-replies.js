export const THANKS_REPLY='Sama-sama, saya seronok untuk membantu anda!';
export function isThanks(text=''){
  const words=text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g,'');
  return /^terimakasih(?:aina)?$/.test(words);
}
