import sdk from 'microsoft-cognitiveservices-speech-sdk';
export const xml = text => text.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function malaySSML(text, voice='ms-MY-YasminNeural') {
  // Yasmin is a native Malay female voice. Prosody gives the fictional character
  // a brighter, youthful delivery; this is not a clone of a real child.
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ms-MY"><voice name="${xml(voice)}"><prosody pitch="+26%" rate="+2%">${xml(text).replace(/\bAINA\b/g,'<sub alias="Aina">AINA</sub>')}</prosody></voice></speak>`;
}
export function synthesizeMalay(text, config, signal) {
  return new Promise((resolve,reject)=>{
    if(!config.azureKey || !config.azureRegion) return reject(new Error('Configure AZURE_SPEECH_KEY and AZURE_SPEECH_REGION for AINA’s Malay voice.'));
    const speech=sdk.SpeechConfig.fromSubscription(config.azureKey,config.azureRegion);
    speech.speechSynthesisOutputFormat=sdk.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm;
    speech.setProperty(sdk.PropertyId.SpeechServiceResponse_RequestWordBoundary,'true');
    const synth=new sdk.SpeechSynthesizer(speech,null);const words=[];let done=false;
    synth.wordBoundary=(_sender,e)=>{
      if(e.text?.trim()) words.push({text:e.text,offset:e.audioOffset/10000000,duration:Math.max(.04,e.duration/10000000),textOffset:e.textOffset});
    };
    const close=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);synth.close();};
    const fail=e=>{if(done)return;done=true;close();reject(e);};
    const abort=()=>fail(new Error('Speech cancelled.'));
    const timer=setTimeout(()=>fail(new Error('Malay speech synthesis timed out.')),45000);
    signal?.addEventListener('abort',abort,{once:true});
    synth.speakSsmlAsync(malaySSML(text,config.azureVoice),result=>{
      if(done)return;
      if(result.reason!==sdk.ResultReason.SynthesizingAudioCompleted)return fail(new Error('Malay TTS failed. Check Azure Speech credentials, region and voice access.'));
      done=true;close();resolve({audio:Buffer.from(result.audioData).toString('base64'),words,provider:'azure',voice:config.azureVoice,mime:'audio/wav'});
    },()=>fail(new Error('Cannot connect to the Malay speech service.')));
    if(signal?.aborted)abort();
  });
}
