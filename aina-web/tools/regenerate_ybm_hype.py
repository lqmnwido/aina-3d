"""New energetic Malay takes; use native pitch and natural playback."""
import os,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
os.environ['HF_HUB_OFFLINE']='1'
os.environ['AINA_CFM_STEPS']='10'
sys.path.insert(0,str(ROOT/'local-speech'))
import tts_server
for name,exaggeration,cfg,temperature in [('excited',.78,.35,.65),('clear',.73,.40,.62)]:
    style='ybm_hype_'+name
    tts_server.STYLES[style]={'exaggeration':exaggeration,'cfg_weight':cfg,'temperature':temperature}
    audio,seconds=tts_server.generate('Selamat datang, wai bi em!! Sila beri arahan untuk lancarkan Vituti!',style=style)
    path=ROOT.parent/'output/audio/aina-dialogue4'/f'aina-ybm-hype-{name}-raw.wav'
    path.write_bytes(audio)
    print('Generated new hype take:',name,round(seconds,2),'seconds',flush=True)
