"""One-off offline pronunciation check; does not start any ASR service."""
import os,sys
os.environ['HF_HUB_OFFLINE']='1'
from pathlib import Path
import torch,soundfile as sf
import numpy as np
from scipy.signal import resample_poly
from qwen_asr import Qwen3ASRModel
root=Path(__file__).resolve().parents[1]
torch.set_num_threads(2)
model=Qwen3ASRModel.from_pretrained(str(root/'local-speech/models/qwen3-asr-0.6b'),dtype=torch.float16,device_map='cuda:0',attn_implementation='sdpa',max_inference_batch_size=1,max_new_tokens=128)
if '--prepared-400' in sys.argv:
    parts=[]
    for name in ['welcome','instruction']:
        wav,rate=sf.read(root/'public/audio'/f'aina-ybm-{name}-400-r2.wav',dtype='float32')
        parts.append(resample_poly(wav,16000,rate))
    combined=np.concatenate([parts[0],np.zeros(6400,dtype='float32'),parts[1]])
    with torch.inference_mode():result=model.transcribe(audio=(combined,16000),language='Malay')
    print('Complete prepared welcome: '+result[0].text,flush=True)
    sys.exit(0)
for name in (['context','instruction'] if '--new-400' in sys.argv else ['fluent','natural','previous']):
    if '--prepared-400' in sys.argv:file=root/'public/audio'/f'aina-ybm-{name}-400-r2.wav'
    elif '--new-400' in sys.argv:file=root.parent/'output/audio/aina-dialogue4'/f'aina-ybm-400-{name}-raw.wav'
    else:file=root.parent/'output/audio/aina-dialogue4'/f'aina-ybm-happy-{name}-raw.wav' if name!='previous' else root/'public/audio/aina-ybm-greeting.wav'
    wav,rate=sf.read(file,dtype='float32')
    with torch.inference_mode():result=model.transcribe(audio=(resample_poly(wav,16000,rate),16000),language='Malay')
    print(name+': '+result[0].text,flush=True)
