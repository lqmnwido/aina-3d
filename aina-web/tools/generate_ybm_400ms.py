"""Fresh two-part Malay welcome; playback supplies the requested 400 ms delay."""
import os,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
os.environ.setdefault('HF_HUB_OFFLINE','1')
sys.path.insert(0,str(ROOT/'local-speech'))
import tts_server
tts_server.STYLES['welcome400']={'exaggeration':.60,'cfg_weight':.40,'temperature':.60}
for name,text in [('context','Selamat datang, wai bi em! Sila beri arahan untuk lancarkan Vituti!')]:
    audio,seconds=tts_server.generate(text,style='welcome400')
    path=ROOT.parent/'output/audio/aina-dialogue4'/f'aina-ybm-400-{name}-raw.wav'
    path.write_bytes(audio)
    print('New recording:',name,'generation:',round(seconds,2),flush=True)
