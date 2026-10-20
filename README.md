# AINA 3D — local ViTuTi presentation

AINA includes the 3D character, Malay voice recordings, lip movement, wave, flight, jetpack sound, exhaust smoke, montage and landing animation. Everything used during the presentation runs on your PC.

## Step-by-step Windows installation (recommended)

You need an internet connection for the first setup, free disk space for the app and media, and a browser with WebGL/hardware acceleration enabled. Node.js, npm and Git do not need to be installed beforehand when using the ZIP method below.

### 1. Download the project

1. Open [the AINA 3D repository](https://github.com/lqmnwido/aina-3d).
2. Click the green **Code** button, then **Download ZIP**. Alternatively, [download the main branch ZIP directly](https://github.com/lqmnwido/aina-3d/archive/refs/heads/main.zip).
3. Wait for the download to finish.

### 2. Extract the ZIP

1. Right-click the downloaded ZIP and choose **Extract All**.
2. Extract it into a folder you can write to, such as a folder inside **Documents**.
3. Open the extracted project folder, normally called **aina-3d-main**.
4. Confirm that **SETUP.cmd**, **START.cmd**, **README.md** and the **aina-web** folder are visible together.

Run the scripts from the extracted folder, not from inside the ZIP. Keep the folder structure intact.

### 3. Install and set up AINA

1. Double-click **SETUP.cmd**.
2. Keep the setup window open and stay connected to the internet.
3. Wait while setup finds a compatible Node.js installation or installs a private Node.js 24 LTS runtime with npm, installs the app dependencies, downloads missing videos and builds AINA.
4. Wait for **Setup complete**. Press a key to close the completed setup window.

The first setup takes longer because it downloads dependencies and any missing media. The five bundled videos total approximately **550 MB**; download time depends on your connection. Later unchanged starts reuse installed files.

No administrator rights, domain, Cloudflare, Python, AI models, API key or separate voice server are required. A downloaded Node.js runtime stays inside the project's **.runtime** folder; your global PATH is not changed.

### 4. Start AINA

1. Double-click **START.cmd**.
2. Wait for the progress bar to reach **100% Ready**.
3. The browser opens **http://localhost:5173**. If it does not open automatically, enter that address manually.
4. Keep this terminal window open while using AINA.

After setup has completed, AINA can run offline. For daily use, open **START.cmd**; you do not need to run setup every time.

### 5. Run the presentation

1. Turn on your speakers and check the computer/browser volume.
2. Click **Start bersama AINA**. AINA waves and plays the welcome.
3. Wait until the greeting finishes.
4. Press **Space**, or tap/click the screen, to trigger the launch voice, rocket flight and montage.
5. After the montage finishes, AINA lands and plays the success message.

Dragging the character rotates it rather than launching the montage. Voice commands are not used in this local version. Video controls are hidden, and the montage plays with sound at full volume.

### 6. Stop AINA

Return to the terminal window and press **Ctrl+C**. Closing only the browser tab does not stop the local server. To start again later, double-click **START.cmd**.

## Terminal alternative (Node.js already installed)

1. Open PowerShell in the extracted repository folder containing `package.json`.
2. With Node.js 22.12+ and npm installed, run setup once:

```powershell
npm.cmd run setup
```

3. Start the local server:

```powershell
npm.cmd run local
```

4. Open **http://localhost:5173** and keep PowerShell open. Press **Ctrl+C** to stop.

The same commands work inside `aina-web`. On macOS/Linux use `npm` and install Node.js yourself. If Node is only installed privately by SETUP.cmd, use START.cmd rather than expecting `npm` to be globally available.

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

## Updating an existing installation

Stop AINA first with **Ctrl+C**. For a ZIP installation, download the latest ZIP into a new folder, extract it, and run its **SETUP.cmd** followed by **START.cmd**. This keeps your previous folder available if needed.

For a Git clone, run `git pull` and `git lfs pull`, then run **SETUP.cmd** and **START.cmd**. Preserve any custom changes before pulling. Do not copy `node_modules` or `.runtime` from another PC; setup prepares the runtime and dependencies for the current machine.

## Troubleshooting

| Problem | What to do |
| --- | --- |
| Cannot find SETUP.cmd or START.cmd | Extract the ZIP and open the project folder containing both scripts and `aina-web`. |
| `npm` is not recognized | Use SETUP.cmd, then START.cmd. The private npm installation is not added to the global PATH. |
| Setup fails or a video is missing | Keep internet connected and rerun SETUP.cmd. Video pointer files are downloaded automatically; manual Git LFS installation is unnecessary for the ZIP method. |
| Browser does not open | Check that the terminal says Ready, then open http://localhost:5173 manually. |
| Page stops working after closing the terminal | Run START.cmd again and keep its window open. |
| Port is already in use | Stop the previous AINA terminal with Ctrl+C before opening another copy. |
| No sound | Click Start, unmute the browser/site and check speakers and system volume. |
| Model is blank or not displayed | Enable browser hardware acceleration/WebGL and reload the page. |
| Old video or voice still appears | Stop the app, run START.cmd again, then reload the browser with Ctrl+F5. |
| Build or dependency error | Run SETUP.cmd again. Detailed errors are shown in the terminal; logs are in `aina-web/.local/setup.log` or `aina-web/.local/build.log`. |

## Editing the presentation

- Montage: copy a video into `aina-web/public/media/`, update its URL in `src/main.jsx` and the asset checker, then rebuild.
- Voice: select WAV paths in `src/scripted-audio.js`. Text changes alone do not change prerecorded speech.
- After changing files: reload the browser with Ctrl+F5.

See [app details](aina-web/README.md) and [Blender notes](reconstruction/README.md).
