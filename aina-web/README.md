# AINA Web — local installation

AINA is a local event presentation with a 3D character, prerecorded Malay speech, wave, mouth movement, rocket flight, fire, exhaust smoke, montage and landing. **No AI services or domain are used.**

## Step 1 — Download

1. Open [lqmnwido/aina-3d](https://github.com/lqmnwido/aina-3d).
2. Select **Code → Download ZIP**.
3. Right-click the downloaded ZIP and select **Extract All**.
4. Open the extracted folder, then open **aina-web**.

Inside **aina-web**, you should see **SETUP.cmd**, **START.cmd**, **package.json**, **public** and **src**. Keep this folder structure intact. You may copy the entire **aina-web** folder to another location; the rest of the repository is not needed to run it.

## Step 2 — Install and set up (first time)

1. Connect the PC to the internet.
2. Double-click **SETUP.cmd** inside **aina-web**.
3. Keep the window open while it installs requirements and builds the app.
4. Wait for **Setup complete**, then press a key to close the setup window.

Setup automatically:

- Uses a compatible Node.js installation, or downloads a private Node.js 24 LTS runtime with npm and verifies its checksum.
- Downloads the current montage if the ZIP contains a Git LFS pointer.
- Installs dependencies from **package-lock.json**.
- Checks the required model, audio and video files, then builds AINA.

No manual Node.js/npm installation or administrator rights are required for this Windows method. A private runtime is stored in **aina-web/.runtime** and is not added to the global PATH. Initial setup needs internet; later unchanged starts work offline.

## Step 3 — Start locally

1. Double-click **START.cmd** inside **aina-web**.
2. Wait for **100% Ready**.
3. The browser opens **http://localhost:5173**. Enter that address manually if necessary.
4. Keep the terminal window open during the presentation.

For daily use, run **START.cmd**. You do not need to repeat setup unless dependencies change or you need to repair the installation.

## Step 4 — Run the presentation

1. Turn on speakers and check browser/system volume.
2. Click **Start bersama AINA**.
3. AINA waves and says “Selamat Datang YB Menteri!”
4. After a 400 ms delay, she says “Sila beri arahan untuk lancarkan V2T.”
5. Press **Space** or tap/click the screen after the greeting.
6. AINA plays the launch line, flies upward with fire/smoke and reveals the montage.
7. After the montage ends, AINA lands and plays the success message.

Dragging rotates the character. The montage plays with sound at full volume and no video controls. Voice commands and live voice generation are not part of this version.

## Step 5 — Stop

Return to the terminal window and press **Ctrl+C**. Closing the browser alone does not stop the server. Run START.cmd to open AINA again.

## Terminal installation (optional)

If Node.js **22.12+** and npm are already installed, open PowerShell **inside aina-web**, then run:

~~~powershell
npm.cmd run setup
npm.cmd run local
~~~

On later runs:

~~~powershell
npm.cmd run local
~~~

On macOS/Linux, install Node.js yourself and use **npm** instead of **npm.cmd**. If Windows setup installed only the private runtime, use START.cmd; npm will not be available globally.

For Git users with Git LFS installed:

~~~powershell
git clone https://github.com/lqmnwido/aina-3d.git
cd aina-3d
git lfs pull
cd aina-web
npm.cmd run setup
npm.cmd run local
~~~

## Exactly what is included

| Location | Required content |
| --- | --- |
| public/models/aina.glb | Current character model |
| public/models/aina-fallback.png | Fallback character display |
| public/audio/ | Four recordings: welcome, instruction, launch and landing |
| public/media/v2t-v4-4.mp4 | Current montage only (about 204 MB; Git LFS) |
| src/ | Character, face, mouth, wave, flight, fire, smoke, sound and landing code |
| server/local.js | Local static server |
| tools/ and scripts/ | Setup, local launch, asset checks and verification |

Older montages, voice experiments, Blender projects, AI-generation code, model weights and Cloudflare configuration are excluded from the current repository tree. The audio is already generated; no TTS warmup or GPU inference is needed. Browser WebGL hardware acceleration still displays the 3D character.

## Commands

Run these **inside aina-web**:

| Command | Purpose |
| --- | --- |
| npm run setup | Restore media, install dependencies and build |
| npm run local / npm start | Serve locally |
| npm run dev | Developer server with hot reload |
| npm run build | Check assets and rebuild |
| npm run check | Verify required assets |
| npm test | Run presentation tests |

Setup/start show a progress bar. Details appear on error; logs are in **.local/setup.log** and **.local/build.log**. Unchanged starts reuse dependencies and the build. The server binds only to **127.0.0.1** and does not read old AI/domain settings.

## Updating

Stop the server with Ctrl+C. For a ZIP installation, download the latest ZIP into a new folder and run SETUP.cmd and START.cmd in its **aina-web** folder. This keeps your old installation available.

For a Git clone, preserve custom changes, run **git pull** and **git lfs pull**, then run SETUP.cmd inside **aina-web**. Do not copy node_modules or .runtime from another PC.

## Troubleshooting

| Problem | Solution |
| --- | --- |
| Cannot find SETUP.cmd | Extract the ZIP, then open the **aina-web** subfolder. |
| npm is not recognized | Use SETUP.cmd and START.cmd; the private runtime is not added to PATH. |
| Setup or video download fails | Keep internet connected and run SETUP.cmd again. |
| Browser does not open | Wait for Ready, then open http://localhost:5173 manually. |
| Port already in use | Stop the other AINA terminal before launching another copy. |
| No sound | Click Start; unmute the browser/site and check system volume. |
| Blank model | Enable hardware acceleration/WebGL and reload. |
| Old voice/video appears | Restart AINA and reload with Ctrl+F5. |
| Build error | Run SETUP.cmd again and read the reported log. |

## Editing the presentation

Select the four WAV paths in **src/scripted-audio.js**. Text changes alone do not change recorded speech. The montage URL is in **src/main.jsx**; keep the asset checker in sync when replacing it. Animation code is in **src/Avatar.jsx**, **src/launch.js**, the smoke/fire components and **src/voice-motion.js**.

Rebuild after changing assets or source. Only commit the active recordings and montage. Git LFS handles the montage; installation can also retrieve it automatically from this repository when starting from a ZIP.
