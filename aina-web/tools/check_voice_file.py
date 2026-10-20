"""One-off offline pronunciation check of a supplied audio file."""
import os
import sys
from pathlib import Path
os.environ['HF_HUB_OFFLINE'] = '1'
import torch
import soundfile as sf
import numpy as np
from scipy.signal import resample_poly
from qwen_asr import Qwen3ASRModel
root = Path(__file__).resolve().parents[1]
torch.set_num_threads(2)
model = Qwen3ASRModel.from_pretrained(str(root / 'local-speech/models/qwen3-asr-0.6b'), dtype=torch.float16, device_map='cuda:0', attn_implementation='sdpa', max_inference_batch_size=1, max_new_tokens=128)
for name in sys.argv[1:]:
    audio, rate = sf.read(name, dtype='float32')
    checks=[('full',audio)]
    if os.getenv('AINA_CHECK_BRAND')=='1':
        if 'landing' in name:
            checks=[(f'brand-prefix-{end}',audio[:round(rate*end)]) for end in [.8,.98,1.1]]
        else:
            checks=[(f'instruction-prefix-{end}',audio[:round(rate*end)]) for end in [2.26,2.29,2.32]]
    if os.getenv('AINA_CHECK_INTRO')=='1':
        checks.extend([('intro-before-1.05',audio[:round(rate*1.05)]),('after-1.03',audio[round(rate*1.03):])])
    for label,part in checks:
        padded=np.concatenate([np.zeros(round(.2*rate),dtype='float32'),part,np.zeros(round(.5*rate),dtype='float32')])
        with torch.inference_mode():
            result = model.transcribe(audio=(resample_poly(padded, 16000, rate), 16000), language='Malay')
        print(f'{name} {label}: {result[0].text}', flush=True)
