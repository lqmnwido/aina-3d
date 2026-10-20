"""Full-phrase retakes with the previously stable Malay conditioning."""
import os
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT.parent/'output/audio/yb-menteri'
os.environ['HF_HUB_OFFLINE']='1'
os.environ['AINA_CFM_STEPS']='24'
sys.path.insert(0,str(ROOT/'local-speech'))
import tts_server as engine
engine.model.prepare_conditionals(str(ROOT/'local-speech/voices/aina-dialogue4/reference.wav'),exaggeration=.55)
identity=engine.model.conds
engine.model.prepare_conditionals(str(ROOT/'local-speech/generated/greeting-check.wav'),exaggeration=.55)
engine.model.conds.t3.speaker_emb=identity.t3.speaker_emb
engine.model.conds.gen=identity.gen
engine.voice_pitch=0
engine.voice_signature+=':full-phrase-malay-v9'
engine.STYLES['natural_v9']={'exaggeration':.55,'cfg_weight':.5,'temperature':.55}
for name,text in [
    ('welcome','Selamat datang, wai bi menteri!'),
    ('instruction','Sila beri arahan untuk lancarkan Vituti!'),
    ('instruction-alt','Sila beri arahan untuk lancarkan vi tu ti!'),
    ('welcome-alt','Selamat datang, wai bi Menteri.'),
]:
    try:
        audio,seconds=engine.generate(text,style='natural_v9')
        target=OUT/f'{name}-v9-raw.wav'
        target.write_bytes(audio)
        print(f'Saved {target}: {seconds:.2f}s',flush=True)
    except engine.SpeechTimeout as error:
        print(f'Rejected {name}: {error}',flush=True)
