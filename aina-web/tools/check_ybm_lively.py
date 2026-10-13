"""Offline check of the new expressive take and its sentence boundary."""
import os,sys
os.environ['HF_HUB_OFFLINE']='1'
from pathlib import Path
import numpy as np,torch,soundfile as sf
from scipy.signal import resample_poly
from qwen_asr import Qwen3ASRModel
root=Path(__file__).resolve().parents[1]
torch.set_num_threads(2)
model=Qwen3ASRModel.from_pretrained(str(root/'local-speech/models/qwen3-asr-0.6b'),dtype=torch.float16,device_map='cuda:0',attn_implementation='sdpa',max_inference_batch_size=1,max_new_tokens=128)
group='hi-tone' if '--hi-tone' in sys.argv else 'hype' if '--hype' in sys.argv else 'lively'
for name in (['happy','matched'] if group=='hi-tone' else ['clear'] if '--clear-boundary' in sys.argv else ['excited','clear'] if group=='hype' else ['cheery','bright']):
    wav,rate=sf.read(root.parent/'output/audio/aina-dialogue4'/f'aina-ybm-{group}-{name}-raw.wav',dtype='float32')
    checks=[('full',wav)]
    if name in ['cheery','excited','happy'] or '--clear-boundary' in sys.argv:
        for cut in ([2.15,2.30,2.45] if '--clear-boundary' in sys.argv else [2.30,2.45,2.60]):
            checks.append((f'prefix-{cut}',wav[:round(cut*rate)]))
            checks.append((f'suffix-{cut}',wav[round(cut*rate):]))
    for label,audio in checks:
        padded=np.concatenate([np.zeros(round(.2*rate),dtype='float32'),audio,np.zeros(round(.5*rate),dtype='float32')])
        with torch.inference_mode():result=model.transcribe(audio=(resample_poly(padded,16000,rate),16000),language='Malay')
        print(name+' '+label+': '+result[0].text,flush=True)
