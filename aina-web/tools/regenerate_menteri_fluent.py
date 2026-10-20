"""Fresh welcome takes with more stable articulation; preserve Hi Aina identity."""
import os
import sys
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parent / 'output/audio/yb-menteri'
OUT.mkdir(parents=True, exist_ok=True)
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['AINA_CFM_STEPS'] = '16'
sys.path.insert(0, str(ROOT / 'local-speech'))
import tts_server as engine

identity = ROOT / 'local-speech/voices/aina-dialogue4/reference.wav'
malay = ROOT / 'local-speech/generated/greeting-check.wav'
engine.model.prepare_conditionals(str(identity), exaggeration=.55)
target = engine.model.conds
engine.model.prepare_conditionals(str(malay), exaggeration=.55)
engine.model.conds.t3.speaker_emb = target.t3.speaker_emb
engine.model.conds.gen = target.gen
happy = '--happy' in sys.argv
version = 'v6' if happy else 'v5'
engine.voice_signature += ':menteri-fluent-' + version + ':' + hashlib.sha256(identity.read_bytes() + malay.read_bytes()).hexdigest()

takes = [
    ('happy', 'Selamat datang, wai bi menteri!', {'exaggeration': .60, 'cfg_weight': .50, 'temperature': .55}),
    ('hype', 'Selamat datang, wai bi menteri!', {'exaggeration': .64, 'cfg_weight': .50, 'temperature': .55}),
] if happy else [
    ('natural', 'Selamat datang, wai bi menteri!', {'exaggeration': .50, 'cfg_weight': .50, 'temperature': .55}),
    ('bright', 'Selamat datang YB Menteri!', {'exaggeration': .55, 'cfg_weight': .50, 'temperature': .60}),
]
for name, text, style in takes:
    key = 'menteri_fluent_' + name
    engine.STYLES[key] = style
    audio, elapsed = engine.generate(text, style=key)
    result = OUT / f'welcome-{name}-{version}-raw.wav'
    result.write_bytes(audio)
    print(f'Saved {result}: {elapsed:.2f}s generation', flush=True)
