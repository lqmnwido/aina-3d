# Speech functions (optional / legacy)

**Normal AINA presentation needs none of this.** `npm run local` plays the bundled WAVs and does not load ASR, LLM, TTS checkpoints or GPU workers.

The checked-in code retains earlier Qwen3-ASR 0.6B / vLLM streaming, vLLM chat and Chatterbox generation experiments. They are not enabled in the current keyboard/touch presentation and are not supported by the default launcher as a conversational setup.

## Generate an additional voice clip locally

Use Python **3.12** in a separate environment. Example Windows commands from `aina-web`:

```powershell
py -3.12 -m venv local-speech/.venv-tts
local-speech/.venv-tts/Scripts/python.exe -m pip install -r local-speech/requirements-tts.txt
local-speech/.venv-tts/Scripts/python.exe local-speech/download_models.py tts
local-speech/.venv-tts/Scripts/python.exe tools/generate_voice.py --text "Selamat datang!" --output public/audio/new-voice.wav --style excited
```

The downloader retrieves the public ResembleAI/chatterbox checkpoints (several GB). Check upstream license and hardware compatibility. The generator uses CUDA when available and CPU otherwise; CPU is slower. Install a CUDA-compatible PyTorch build if your PyTorch install cannot see your GPU.

**Malay support is experimental**: this code registers `ms` for the multilingual model, but that does not make Malay a natively guaranteed upstream language. Review the pronunciation and complete recording before mapping it into the presentation.

`active_voice.json` points at the included approved synthetic greeting, not an outside-PC path. You may replace reference/conditioning paths with a recording you have permission to use. Exact historic timbre cannot be guaranteed from a synthetic reference; original private third-party source samples are deliberately excluded. Existing bundled approved WAVs are unchanged.

The generator does not rewrite the current voice mapping. After listening, update `src/scripted-audio.js` deliberately and rebuild. Long speech can time out; use short segments. No generation or warmup is required for shipped lines.

## Earlier tools

Historical regenerate/preview scripts preserve past experiments and may refer to private original references or scratch files under output/. They are not the portable entry point; use `tools/generate_voice.py` instead.

ASR/chat scripts and requirements are included for reference. They require their own environments, model downloads and (for vLLM) compatible Linux/WSL GPU setup. Do not expect installing TTS to start them. No AI checkpoints, Python environments, generated caches, logs or credentials are checked into Git.
