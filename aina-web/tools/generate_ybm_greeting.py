"""Generate a fluent full welcome once with the existing approved voice."""
import sys,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'local-speech'))
os.environ.setdefault('HF_HUB_OFFLINE','1')
os.environ.setdefault('TOKENIZERS_PARALLELISM','false')
import tts_server
tts_server.STYLES['welcome']={'exaggeration':.6,'cfg_weight':.65,'temperature':.6}
for name,spoken,style in [
    ('fluent','Selamat datang, YBM! Sila beri arahan untuk lancarkan Vituti!','welcome'),
    ('natural','Selamat datang, wai bi em! Sila beri arahan untuk lancarkan Vituti!','neutral'),
]:
    audio,seconds=tts_server.generate(spoken,style=style)
    output=ROOT.parent/'output/audio/aina-dialogue4'/f'aina-ybm-happy-{name}-raw.wav'
    output.write_bytes(audio)
    print('Generated:',name,'seconds:',round(seconds,2),flush=True)
