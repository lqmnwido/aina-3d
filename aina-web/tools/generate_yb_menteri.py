"""Generate the YB Menteri welcome using the approved Hi Aina conditioning."""
import os
import sys
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parent / 'output/audio/yb-menteri'
OUT.mkdir(parents=True, exist_ok=True)
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['AINA_CFM_STEPS'] = '10'
sys.path.insert(0, str(ROOT / 'local-speech'))
import tts_server as engine

identity = ROOT / 'local-speech/voices/aina-dialogue4/reference.wav'
malay = ROOT / 'local-speech/generated/greeting-check.wav'
engine.model.prepare_conditionals(str(identity), exaggeration=.55)
target = engine.model.conds
engine.model.prepare_conditionals(str(malay), exaggeration=.55)
engine.model.conds.t3.speaker_emb = target.t3.speaker_emb
engine.model.conds.gen = target.gen
engine.voice_signature += ':yb-menteri-hi-tone-v1:' + hashlib.sha256(identity.read_bytes() + malay.read_bytes()).hexdigest()
engine.STYLES['yb_menteri_happy'] = {'exaggeration': .68, 'cfg_weight': .35, 'temperature': .65}
for name, text in [
    ('welcome', 'Selamat datang, wai bi Menteri!'),
    ('instruction', 'Sila beri arahan untuk lancarkan Vituti!'),
]:
    audio, elapsed = engine.generate(text, style='yb_menteri_happy')
    result = OUT / f'{name}-raw.wav'
    result.write_bytes(audio)
    print(f'Saved {result}: {elapsed:.2f}s generation', flush=True)
