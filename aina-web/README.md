# AINA local app

Follow the [step-by-step Windows installation guide](../README.md#step-by-step-windows-installation-recommended) in the main README.

1. Download the repository ZIP and extract it.
2. Open the extracted root folder containing **SETUP.cmd**, **START.cmd** and **aina-web**.
3. Double-click **SETUP.cmd**, stay connected to the internet and wait for **Setup complete**. It installs Node.js/npm if needed, installs dependencies, restores videos and builds the presentation.
4. Double-click **START.cmd** and wait for **100% Ready**. Open **http://localhost:5173** if the browser does not open automatically.
5. Click **Start bersama AINA**, wait for the greeting, then press **Space** or tap the screen to launch.
6. Keep the terminal open during use; press **Ctrl+C** in it to stop.

For later use, only run START.cmd. The presentation works offline after setup. Internet is required for initial installation and later dependency/media downloads.

If Node.js 22.12+ is already installed, from this folder:

```powershell
npm.cmd run setup
npm.cmd run local
```

The local launcher uses a small static server. It never starts ASR, TTS, LLM, WSL or Cloudflare and ignores old .env/tunnel configuration. The prerecorded v10 greeting has a 400 ms delay between its two lines. Space or touch plays the launch line, flight/fire/smoke, the V2T_v4_4 montage and landing sequence. The video has sound and no controls.

## Edit

- `src/main.jsx`: input, greeting lifecycle and montage URL.
- `src/Avatar.jsx`: character, face, mouth and wave animation.
- `src/launch.js`: launch/landing text and timing.
- `src/scripted-audio.js`: exact phrase to prerecorded WAV mapping.
- `src/LaunchSmoke.jsx`, `src/ExhaustSmoke.jsx`, `src/smoke-particles.js`: smoke.
- `src/jetpack-sound.js`: procedural sound effect.
- `public/models/`, `public/audio/`, `public/media/`: bundled assets.
- `tools/local.mjs`, `server/local.js`: local-only startup and HTTP server.
- `tools/setup.mjs`: locked npm installation, media retrieval and build.

Videos are tracked using Git LFS. Setup detects pointers in downloaded ZIPs and retrieves the real video, verifying its checksum. Missing assets are rejected before startup.

Use `npm run dev` for hot reload, `npm run build` to build and `npm test` to test. Setup/start logs are in `.local/`. After setup, unchanged starts do not reinstall or rebuild.

Historical AI-generation and cloud scripts are retained for reference and are outside the default local workflow. They may require additional private references, models and services.

See [full instructions](../README.md).
