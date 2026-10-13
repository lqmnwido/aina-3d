"""Reproduce the approved Hi Aina voice recipe, then generate the new welcome."""
import os,sys,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
os.environ['HF_HUB_OFFLINE']='1'
os.environ['AINA_CFM_STEPS']='10'
sys.path.insert(0,str(ROOT/'local-speech'))
import tts_server as engine

# Use the same original identity and Malay conditioning as preview_dialogue4.py
# --hybrid, which produced the user-approved Hi Aina recording. Avoid cloning
# an already generated synthetic clip again, which can change its timbre.
identity=ROOT/'local-speech/voices/aina-dialogue4/reference.wav'
malay=ROOT/'local-speech/generated/greeting-check.wav'
engine.model.prepare_conditionals(str(identity),exaggeration=.55)
target=engine.model.conds
engine.model.prepare_conditionals(str(malay),exaggeration=.55)
engine.model.conds.t3.speaker_emb=target.t3.speaker_emb
engine.model.conds.gen=target.gen
engine.voice_signature+=':original-hi-recipe:'+hashlib.sha256(identity.read_bytes()+malay.read_bytes()).hexdigest()
for name,emotion in [('matched',.55),('happy',.65)]:
    style='ybm_original_hi_'+name
    engine.STYLES[style]={'exaggeration':emotion,'cfg_weight':.35,'temperature':.65}
    audio,seconds=engine.generate('Selamat datang, wai bi em! Sila beri arahan untuk lancarkan Vituti!',style=style)
    path=ROOT.parent/'output/audio/aina-dialogue4'/f'aina-ybm-hi-tone-{name}-raw.wav'
    path.write_bytes(audio)
    print('Generated from original Hi Aina recipe:',name,round(seconds,2),'seconds',flush=True)
