"""Generate isolated Malay previews; never overwrite the active voice or cache."""
import json, sys, time
from pathlib import Path
import librosa
import numpy as np
import soundfile as sf
import torch

ROOT = Path(__file__).resolve().parent
DEST = ROOT.parents[1] / 'output/audio/aina-dialogue4'
DEST.mkdir(parents=True, exist_ok=True)
source = ROOT / 'voices/aina-dialogue4/source-dialogue4.mp3'
audio, rate = librosa.load(source, sr=24000, mono=True)
trimmed, bounds = librosa.effects.trim(audio, top_db=35)
reference = trimmed[:rate * 12]
ref_path = ROOT / 'voices/aina-dialogue4/reference.wav'
sf.write(ref_path, reference, rate, subtype='PCM_16')
print(json.dumps({'source_seconds': len(audio)/rate, 'reference_seconds': len(reference)/rate,
                  'trim_start_seconds': int(bounds[0])/rate}), flush=True)

# Reuse the installed GPU optimizations, in a separate process while the
# active TTS worker is stopped. The worker's files and conditionals stay intact.
import tts_server as engine
engine.model.prepare_conditionals(str(ref_path), exaggeration=.55)
hybrid = '--hybrid' in sys.argv
if hybrid:
    # Preserve target speaker identity and decoder reference, but use an
    # existing Malay utterance for the speech-token prompt. Experimental:
    # recognition checks and human listening are required before deployment.
    target = engine.model.conds
    malay_reference = ROOT / 'generated/greeting-check.wav'
    if not malay_reference.exists():
        raise RuntimeError('Missing preserved Malay conditioning sample')
    engine.model.prepare_conditionals(str(malay_reference), exaggeration=.55)
    engine.model.conds.t3.speaker_emb = target.t3.speaker_emb
    engine.model.conds.gen = target.gen
samples = [
    ('greeting', 'Hi, Saya Aina! Apa yang saya boleh bantu?', .55),
    ('launch', 'Okay, jom!', .65),
    ('thanks', 'Sama-sama, saya seronok untuk membantu anda!', .65),
]
report = {'reference': str(ref_path), 'permission': 'User confirmed permission in this conversation',
          'source_url': 'https://haikyo.co.jp/audio/12765_4-B.mp3',
          'model': 'Installed local Malay Chatterbox checkpoint', 'language': 'ms',
          'cfg_weight': .35 if hybrid else 0, 'pitch_shift_semitones': 0,
          'conditioning': 'Malay speech prompt with target speaker identity' if hybrid else 'Japanese reference',
          'samples': []}
for name, text, emotion in samples:
    began = time.perf_counter()
    torch.manual_seed(42)
    with torch.inference_mode():
        # CFG=0 is the upstream recommendation for cross-language references
        # to reduce accent transfer. Similarity still requires listening review.
        result = engine.model.generate(text.replace('Aina','Ai-na'), language_id='ms',
                                      exaggeration=emotion, cfg_weight=report['cfg_weight'], temperature=.65)
    wav = result.squeeze().float().cpu().numpy()
    if not np.isfinite(wav).all() or len(wav) == 0:
        raise RuntimeError('Invalid generated audio')
    peak = float(np.max(np.abs(wav)))
    if peak > .95:
        wav *= .95 / peak
    path = DEST / f'aina-{name}-malay{"-hybrid" if hybrid else ""}.wav'
    sf.write(path, wav, engine.model.sr, subtype='PCM_16')
    item = {'name': name, 'text': text, 'path': str(path),
            'seconds': len(wav)/engine.model.sr, 'generation_seconds': time.perf_counter()-began,
            'rms': float(np.sqrt(np.mean(wav**2))), 'peak': float(np.max(np.abs(wav)))}
    report['samples'].append(item)
    print(json.dumps(item, ensure_ascii=False), flush=True)
    torch.cuda.empty_cache()
(DEST / ('preview-hybrid-details.json' if hybrid else 'preview-details.json')).write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
print('PREVIEW_COMPLETE', flush=True)
