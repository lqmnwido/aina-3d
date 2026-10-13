# AINA web app

See [repository quick start](../README.md) for installation, local serving and deployment.

## Presentation flow

1. Start enables browser audio and waves AINA's hand.
2. AINA says “Selamat Datang YBM!” then waits 400 ms and says “Sila beri arahan untuk lancarkan V2T.”
3. Space or a screen tap plays “Okay, saya akan lancarkan ViTuTi sekarang!”
4. After the voice finishes, AINA flies upward with procedural jetpack audio, fire and smoke trails.
5. The screen-wide smoke reveals the unmuted montage without video controls.
6. At the end, the smoke transition and rocket landing return AINA; she plays the success message.

No microphone is requested. ASR/LLM inference is not part of this version. Legacy speech code remains available separately but does not run by default.

## Files to edit

- `src/main.jsx`: greeting, input handling and playback lifecycle.
- `src/Avatar.jsx`: model appearance, face, mouth, wave and rocket motion.
- `src/launch.js`: launch/landing text and sequence timing.
- `src/scripted-audio.js`: exact text-to-WAV mapping.
- `src/speech.js`: audio playback, analysis for lip movement, rates and legacy microphone helper.
- `src/LaunchSmoke.jsx`, `src/ExhaustSmoke.jsx`, `src/smoke-particles.js`: smoke simulation.
- `src/jetpack-sound.js`: procedural sound effect.
- `public/models/`, `public/audio/`, `public/media/`: shipped assets.

Keep all mapped WAV paths valid. Build checks catch missing required assets. Rebuild after changing model, audio or video. The app uses prerecorded speech, not live voice generation, so editing text alone does not change the spoken recording.

## Standalone commands

```sh
npm ci
npm run setup
npm run build
npm run local
```

Use `npm run dev` for development; `npm start` serves the built distribution. Configuration is in .env (created from .env.example without overwriting existing values). Private Cloudflare config is optional.

Tests: `npm test`. Browser integration audit: with Chrome installed and the app running at localhost:5173, run `node tools/check_space_launch.js`. Historical tools may require optional AI services or private recording references; they are not installation prerequisites.
