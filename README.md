# AINA 3D — ViTuTi launch experience

AINA is an animated React / Three.js character with a glossy glass helmet, Malay voice recordings, lip movement, wave, rocket flight, jetpack sound, exhaust trails and montage landing sequence.

## Quick start (Windows)

Install **Node.js 22.12+** and Git, then run:

```powershell
git clone https://github.com/lqmnwido/aina-3d.git
cd aina-3d
npm.cmd run setup
npm.cmd run local
```

Open **http://localhost:5173**. Click Start to hear the welcome. After the greeting, press **Space** or tap/click the screen to launch ViTuTi. Dragging the model only rotates it.

Keep the terminal open; **Ctrl+C** stops services started by the launcher. Setup is needed once per clone or after dependency changes. On macOS/Linux use `npm` instead of `npm.cmd`.

The current version is an **event presentation**, not an open-ended chatbot: ASR and LLM are disabled deliberately. Playback uses bundled WAVs immediately, so no Python, GPU, vLLM, Ollama, paid API or TTS warmup is needed.

## Included in Git

| Location | Contents |
| --- | --- |
| `aina-web/public/models/aina.glb` | Browser-ready 3D model |
| `aina-web/public/models/AINA_voice.blend` | Editable Blender model used for the web export |
| `reconstruction/AINA_reference.blend` | Original reconstructed Blender scene |
| `aina-web/public/audio/` | Current approved voices and previous prepared variants |
| `aina-web/public/media/precomp_13-current.mp4` | Current montage |
| `aina-web/src/` | Character, lip sync, flight, smoke, sound and launch interaction |
| `aina-web/server/`, `aina-web/local-speech/` | Server and optional legacy speech functions |
| `reconstruction/`, `aina-web/tools/` | Blender reconstruction/export and audio tooling |

Regular Git is sufficient: included assets are below GitHub's per-file limit, so Git LFS is not required. Old unused test videos, local model checkpoints, virtual environments and generated scratch files are excluded. Existing files on your PC are not deleted.

Third-party AI weights are **not bundled** and are not needed to run AINA. Optional speech-generation setup downloads them separately. Third-party source voice samples and local credentials are not published. Check your rights to model references, generated voice and montage before redistributing or using them publicly; this repository does not grant rights to third-party content.

## Commands

Run from the repository root (or `aina-web`):

| Command | Purpose |
| --- | --- |
| `npm run setup` | Install locked dependencies, create missing app .env, check assets and build |
| `npm run local` | Quiet progress launcher; rebuild only when source/assets changed; optional tunnel |
| `npm run dev` | Developer server with Vite hot reload |
| `npm run build` | Validate assets and generate `aina-web/dist` |
| `npm start` | Serve an existing production build, without starting a tunnel |
| `npm test` | Automated tests |
| `npm run check` | Confirm required model, montage and voice assets exist |

The launcher starts no AI workers and uses a production build to avoid development compilation during the presentation. The first install/build still needs time and internet to download npm dependencies; subsequent unchanged runs reuse the build.

## Deploy

### Local server + Cloudflare Tunnel

This preserves the existing workflow: **`npm.cmd run local` must stay running** for your public URL to work.

Follow [the tunnel setup guide](aina-web/cloudflare/README.md). Credentials and the real tunnel configuration stay private. The checked-in example can be used on another machine with its own tunnel. For the current PC, the existing private configuration continues serving **https://gimmick.kohich.site**.

### Docker

From the repository root, with Docker running:

```sh
docker compose up --build -d
docker compose logs -f
# Stop:
docker compose down
```

Open http://localhost:5173. Docker binds to localhost by default; put a reverse proxy or Cloudflare Tunnel in front for public access. Docker runs the web app only; the host tunnel is configured separately. Do not run Docker and the Node launcher on the same port simultaneously.

### Static hosting (no continuously running PC)

The current keyboard/touch flow works as a static site: build and deploy **all of `aina-web/dist`**, including models, audio and media. For Cloudflare Pages:

- Build command: `npm run setup`
- Output directory: `aina-web/dist`
- Node version: 22
- Repository root: leave at the top level

This is a different deployment from the local Cloudflare Tunnel: static hosting does **not** require `npm run local`. Serve at the domain root. The user must click Start because browsers restrict automatic audio.

## Edit the model, voice or montage

See [app details](aina-web/README.md), [optional voice generation](aina-web/local-speech/README.md), and [Blender notes](reconstruction/README.md).

Change the montage by replacing `aina-web/public/media/precomp_13-current.mp4`, then build again. Current voice mappings are in `aina-web/src/scripted-audio.js`. The welcome is two clips separated by a **400 ms application delay**, with a 1.06 playback rate; launch and landing retain their own timing.

## Troubleshooting

- Missing assets: clone/download the complete repository and run `npm run check`.
- Dependency error: check Node version, then rerun `npm run setup`.
- Blank/3D failure: use a current browser with hardware acceleration/WebGL enabled.
- No sound: click Start, check browser/site volume; prerecorded voices need no speech server.
- Port in use: close the other AINA process or set `PORT` in `aina-web/.env`.
- Cloudflare 1033: the tunnel is disconnected or its DNS points at the wrong tunnel. Check tunnel credentials/config; normal local use does not require Cloudflare.
- Launcher details appear only on error; logs live in `aina-web/local-speech/logs/`. Never commit those logs or your .env.

GitHub Actions runs clean installation, asset verification, tests and production build on pushes.
