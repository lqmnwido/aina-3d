import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SCRIPTED_AUDIO} from '../src/scripted-audio.js';
import {LANDING_MESSAGE} from '../src/launch.js';
import {SCRIPTED_HELP} from '../src/scripted-replies.js';
test('greeting, launch, landing and apology have nonempty static WAVs, no live TTS needed',()=>{
  assert.equal(SCRIPTED_AUDIO.size,6);
  assert.ok(SCRIPTED_AUDIO.has('Selamat Datang YBM! Sila beri arahan untuk lancarkan V2T.'));
  assert.ok(SCRIPTED_AUDIO.has(LANDING_MESSAGE));assert.ok(SCRIPTED_AUDIO.has(SCRIPTED_HELP));
  assert.equal(SCRIPTED_AUDIO.get(LANDING_MESSAGE),'/audio/vituti-landing-selected-hype-34db74885b08.wav','landing uses the user-selected first sentence with the expressive full thank-you phrase, not synthetic pitch processing');
  for(const url of SCRIPTED_AUDIO.values()){
    const bytes=readFileSync(new URL('../public'+url,import.meta.url));
    assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.ok(bytes.length>10000);
  }
});
