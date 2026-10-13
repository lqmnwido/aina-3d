"""Portable optional offline generator; does not change the application's mapping."""
import argparse
import os
import sys
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--text', required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--style', choices=['neutral', 'launch', 'excited', 'annoyed'], default='neutral')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
os.environ.setdefault('HF_HUB_OFFLINE', '1')
sys.path.insert(0, str(root / 'local-speech'))
# Upstream does not officially guarantee Malay; register the experimental tag
# in-process rather than silently patching the user's installed package.
import chatterbox.mtl_tts as multilingual
multilingual.SUPPORTED_LANGUAGES.setdefault('ms', 'Malay (experimental)')
import tts_server

audio, elapsed = tts_server.generate(args.text, style=args.style)
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_bytes(audio)
print(f'Saved {args.output.resolve()} ({elapsed:.2f}s generation). Listen before use.')
