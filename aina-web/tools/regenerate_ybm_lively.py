"""Expressive native Malay welcome, without pitch or tempo effects."""
import os,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
os.environ['HF_HUB_OFFLINE']='1'
os.environ['AINA_CFM_STEPS']='10'
sys.path.insert(0,str(ROOT/'local-speech'))
import tts_server
for name,exaggeration,cfg,temperature in [('cheery',.68,.25,.70),('bright',.65,.30,.72)]:
    style='ybm_lively_'+name
    tts_server.STYLES[style]={'exaggeration':exaggeration,'cfg_weight':cfg,'temperature':temperature}
    audio,seconds=tts_server.generate('Selamat datang, wai bi em! Sila beri arahan untuk lancarkan Vituti!',style=style)
    path=ROOT.parent/'output/audio/aina-dialogue4'/f'aina-ybm-lively-{name}-raw.wav'
    path.write_bytes(audio)
    print('Generated expressive take:',name,round(seconds,2),'seconds',flush=True)
