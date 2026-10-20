"""Use the approved Malay Hi Aina recording for both identity and pronunciation."""
import os
import sys
import hashlib
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parent / 'output/audio/yb-menteri'
OUT.mkdir(parents=True, exist_ok=True)
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['AINA_CFM_STEPS'] = '24'
sys.path.insert(0, str(ROOT / 'local-speech'))
import tts_server as engine

reference = ROOT / 'public/audio/aina-greeting-approved.wav'
engine.model.prepare_conditionals(str(reference), exaggeration=.5)
engine.voice_signature += ':clear-malay-v7:' + hashlib.sha256(reference.read_bytes()).hexdigest()
phonetic = '--phonetic' in sys.argv
if phonetic:
    identity = ROOT / 'local-speech/voices/aina-dialogue4/reference.wav'
    malay = ROOT / 'local-speech/generated/greeting-check.wav'
    engine.model.prepare_conditionals(str(identity), exaggeration=.5)
    target = engine.model.conds
    engine.model.prepare_conditionals(str(malay), exaggeration=.5)
    engine.model.conds.t3.speaker_emb = target.t3.speaker_emb
    engine.model.conds.gen = target.gen
    engine.voice_signature += ':original-identity-phonetics:' + hashlib.sha256(identity.read_bytes()+malay.read_bytes()).hexdigest()
engine.STYLES['clear_malay_v7'] = {'exaggeration': .5, 'cfg_weight': .35 if phonetic else .6, 'temperature': .55}
takes = [
    ('instruction-phonetic', 'Sila beri arahan untuk lancarkan vi tu ti!'),
    ('instruction-hyphen', 'Sila beri arahan untuk lancarkan vi-tu-ti!'),
    ('welcome-flow', 'Selamat datang, wai bi menteri!'),
] if phonetic else [
    ('welcome-phonetic', 'Selamat datang, wai bi menteri!'),
    ('welcome-letters', 'Selamat datang, YB Menteri!'),
    ('instruction-word', 'Sila beri arahan untuk lancarkan Vituti!'),
    ('instruction-letters', 'Sila beri arahan untuk lancarkan V2T!'),
]
for name, text in takes:
    try:
        audio, elapsed = engine.generate(text, style='clear_malay_v7')
        result = OUT / f'{name}-v7-raw.wav'
        result.write_bytes(audio)
        print(f'Saved {result}: {elapsed:.2f}s generation', flush=True)
    except engine.SpeechTimeout as error:
        print(f'Rejected {name}: {error}', flush=True)
