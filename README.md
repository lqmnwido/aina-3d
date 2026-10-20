# AINA 3D — local ViTuTi presentation

AINA includes the 3D character, Malay voice recordings, lip movement, wave, flight, jetpack sound, exhaust smoke, montage and landing animation. Everything used during the presentation runs on your PC.

## Windows: two clicks

1. Download this repository and extract it to a normal folder.
2. Double-click **SETUP.cmd** once. It finds a compatible Node.js or downloads a private, checksum-verified Node.js 24 LTS runtime with npm. It then installs the locked dependencies, downloads any missing Git LFS media and builds AINA.
3. Double-click **START.cmd**. Your browser opens **http://localhost:5173**.

No administrator rights, domain, Cloudflare, Python, AI models, API key or separate voice server are needed. Setup needs internet for downloads; after setup, the presentation works offline. Keep the terminal open; **Ctrl+C** stops AINA.

Click **Start bersama AINA** to play the welcome. After the greeting, press **Space** or tap/click the screen to launch. Dragging rotates the model.

## Terminal alternative

With Node.js 22.12+ and npm installed, run from this folder:

```powershell
npm.cmd run setup
npm.cmd run local
```

The same commands work inside `aina-web`. On macOS/Linux use `npm` and install Node.js yourself. The Windows scripts install a private runtime inside `.runtime`; they do not change the global PATH. If Node is only installed privately, use START.cmd rather than expecting npm to be globally available.

Setup runs `npm ci` against the app lockfile. Startup reuses installed dependencies and the existing build when unchanged; it builds again after source or asset changes. It automatically runs setup if dependencies are missing or their manifest changed. Progress is shown on screen, with detailed output only on error. Logs are in `aina-web/.local/`.

## Assets included in Git

| Folder | Contents |
| --- | --- |
| `aina-web/public/models/` | Browser GLB, editable Blender scene and fallback image |
| `reconstruction/` | Original Blender reconstruction and scripts |
| `aina-web/public/audio/` | Prerecorded voices, including selected v10 greeting and previous takes |
| `aina-web/public/media/` | Current V2T_v4_4 montage and earlier video versions |
| `aina-web/src/` | Face and mouth animation, wave, launch, smoke, fire, sound and landing |

**Videos use Git LFS**, including the current 204 MB montage. With Git and Git LFS:

```powershell
git lfs install
git clone https://github.com/lqmnwido/aina-3d.git
cd aina-3d
git lfs pull
```

If a GitHub ZIP or clone without LFS contains pointer files, SETUP.cmd downloads the referenced videos from this public repository and verifies their SHA256 and size. No separate Git LFS install is required for that setup path. To publish changed videos, use Git LFS when adding and pushing them.

AI checkpoints, Python environments, credentials, temporary files and Node dependencies are not committed and are not required to play AINA. Historical voice-generation and tunnel tools remain in the source for reference; the default launcher never executes them or reads their settings.

## Current sequence

1. The v10 welcome says “Selamat Datang YB Menteri!”
2. After a 400 ms delay, AINA says “Sila beri arahan untuk lancarkan V2T.”
3. Space/touch triggers the launch voice, then flight, fire and smoke.
4. The smoke reveals `v2t-v4-4.mp4` with sound at full volume and no video controls.
5. The video ends, smoke transitions back to AINA's landing and success message.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run setup` | Install dependencies, restore media and build |
| `npm run local` / `npm start` | Serve locally; no AI or tunnel |
| `npm run dev` | Vite development server |
| `npm run build` | Validate assets and create `aina-web/dist` |
| `npm run check` | Check required model, voice and montage assets |
| `npm test` | Run automated checks |

The local server binds to 127.0.0.1. It ignores old .env and Cloudflare files. To use another port, set PORT in the shell before launching; e.g. `$env:PORT=5174` in PowerShell.

## Editing and troubleshooting

- Montage: copy a video into `aina-web/public/media/`, update its URL in `src/main.jsx` and the asset checker, then rebuild.
- Voice: select WAV paths in `src/scripted-audio.js`. Text changes alone do not change prerecorded speech.
- Missing video or LFS pointer: connect to the internet and run setup again.
- No sound: click Start and check the browser/site volume.
- Model display: enable browser hardware acceleration/WebGL.
- Port in use: close the other AINA terminal before starting another copy.
- Build or dependency error: run SETUP.cmd again; errors include the log path.
- After changing files: reload the browser with Ctrl+F5.

See [app details](aina-web/README.md) and [Blender notes](reconstruction/README.md).
