"""Generate complete Malay phrases without word-level splicing or speed effects."""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parent / 'output/audio/yb-menteri'
OUT.mkdir(parents=True, exist_ok=True)
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['AINA_CFM_STEPS'] = '24'
sys.path.insert(0, str(ROOT / 'local-speech'))
import tts_server as engine

engine.model.prepare_conditionals(str(ROOT / 'local-speech/voices/aina-dialogue4/reference.wav'), exaggeration=.6)
identity = engine.model.conds
engine.model.prepare_conditionals(str(ROOT / 'public/audio/aina-greeting-approved.wav'), exaggeration=.6)
engine.model.conds.t3.speaker_emb = identity.t3.speaker_emb
engine.model.conds.gen = identity.gen
engine.voice_pitch = 0
engine.voice_signature += ':happy-fluent-v8'
engine.STYLES['happy_v8'] = {'exaggeration': .6, 'cfg_weight': .5, 'temperature': .6}
for name, text in [
    ('welcome', 'Selamat datang YB Menteri!'),
    ('instruction', 'Sila beri arahan untuk lancarkan Vituti!'),
    ('welcome-alt', 'Selamat datang, YB Menteri!'),
    ('instruction-alt', 'Sila beri arahan untuk lancarkan vituti.'),
]:
    try:
        audio, seconds = engine.generate(text, style='happy_v8')
        target = OUT / f'{name}-v8-raw.wav'
        target.write_bytes(audio)
        print(f'Saved {target}: {seconds:.2f}s', flush=True)
    except engine.SpeechTimeout as error:
        print(f'Rejected {name}: {error}', flush=True)
