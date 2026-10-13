"""Check preview pronunciation through the real local ASR, without mic changes."""
import json, sys, urllib.request, urllib.error
from pathlib import Path
import soundfile as sf
import numpy as np
from scipy.signal import resample_poly

folder = Path(__file__).resolve().parents[2] / 'output/audio/aina-dialogue4'
checks = []
for path in sorted(folder.glob('*-hybrid.wav' if '--hybrid' in sys.argv else '*.wav')):
    wav, rate = sf.read(path, dtype='float32')
    pcm = (np.clip(resample_poly(wav, 16000, rate), -1, 1) * 32767).astype('<i2').tobytes()
    req = urllib.request.Request('http://127.0.0.1:8765/transcribe', data=pcm,
                                 headers={'Content-Type': 'application/octet-stream'})
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            result = json.load(response)
        print(json.dumps({'file': path.name, **result}, ensure_ascii=False), flush=True)
        checks.append({'file': path.name, **result})
    except urllib.error.HTTPError as error:
        print(json.dumps({'file': path.name, 'status': error.code,
                          'error': error.read().decode('utf-8')}), flush=True)
        checks.append({'file': path.name, 'status': error.code})
(folder / ('asr-hybrid-checks.json' if '--hybrid' in sys.argv else 'asr-checks.json')).write_text(
    json.dumps(checks, indent=2, ensure_ascii=False), encoding='utf-8')
