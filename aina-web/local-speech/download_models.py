"""Download public speech weights into this project's model folder."""
import sys
from pathlib import Path
from huggingface_hub import snapshot_download
root=Path(__file__).resolve().parent/'models';root.mkdir(exist_ok=True)
kind=sys.argv[1]
if kind=='asr':
    snapshot_download('Qwen/Qwen3-ASR-0.6B',local_dir=root/'qwen3-asr-0.6b',allow_patterns=['*.json','*.safetensors','*.txt','*.jinja'])
elif kind=='tts':
    snapshot_download('ResembleAI/chatterbox',local_dir=root/'chatterbox-malay',allow_patterns=['ve.pt','t3_mtl23ls_v2.safetensors','s3gen.pt','grapheme_mtl_merged_expanded_v1.json','conds.pt','Cangjie5_TC.json'])
else:raise ValueError('Expected asr or tts')
print(f'{kind.upper()} MODEL DOWNLOAD COMPLETE',flush=True)
