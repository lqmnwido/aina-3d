"""New continuous Malay takes with natural prosody, no pitch/tempo processing."""
import os,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
os.environ.setdefault('HF_HUB_OFFLINE','1')
os.environ['AINA_CFM_STEPS']='10'
sys.path.insert(0,str(ROOT/'local-speech'))
import tts_server
tts_server.STYLES['kidnatural']={'exaggeration':.55,'cfg_weight':.30,'temperature':.68}
tts_server.STYLES['kidnatural2']={'exaggeration':.50,'cfg_weight':.35,'temperature':.65}
for name,spoken,style in [
    ('flow','Selamat datang, wai biem! Sila beri arahan untuk lancarkan Vituti.','kidnatural'),
    ('clear','Selamat datang, wai bi em! Sila beri arahan untuk lancarkan Vituti.','kidnatural2'),
]:
    audio,seconds=tts_server.generate(spoken,style=style)
    path=ROOT.parent/'output/audio/aina-dialogue4'/f'aina-ybm-natural-{name}-raw.wav'
    path.write_bytes(audio)
    print('Generated native take:',name,round(seconds,2),'seconds',flush=True)
