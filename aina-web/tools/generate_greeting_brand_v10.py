"""Whole-phrase takes with brand-containing Malay reference conditioning."""
import os
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT.parent/'output/audio/yb-menteri'
os.environ['HF_HUB_OFFLINE']='1'
os.environ['AINA_CFM_STEPS']='24'
sys.path.insert(0,str(ROOT/'local-speech'))
import tts_server as engine
engine.voice_pitch=0
engine.voice_signature+=':whole-phrase-brand-v10'
engine.STYLES['brand_v10']={'exaggeration':.5,'cfg_weight':.5,'temperature':.55}
for reference,takes in [
    ('local-speech/generated/greeting-check.wav',[('welcome','Selamat datang, wai bi menteri!')]),
    ('public/audio/vituti-launch-dbd50ca0283a.wav',[
        ('instruction','Sila beri arahan untuk lancarkan Vituti!'),
        ('instruction-alt','Sila beri arahan untuk lancarkan Vituti.'),
    ]),
]:
    engine.model.prepare_conditionals(str(ROOT/'local-speech/voices/aina-dialogue4/reference.wav'),exaggeration=.5)
    identity=engine.model.conds
    engine.model.prepare_conditionals(str(ROOT/reference),exaggeration=.5)
    engine.model.conds.t3.speaker_emb=identity.t3.speaker_emb
    engine.model.conds.gen=identity.gen
    for name,text in takes:
        try:
            audio,seconds=engine.generate(text,style='brand_v10')
            target=OUT/f'{name}-v10-raw.wav'
            target.write_bytes(audio)
            print(f'Saved {target}: {seconds:.2f}s',flush=True)
        except engine.SpeechTimeout as error:
            print(f'Rejected {name}: {error}',flush=True)
