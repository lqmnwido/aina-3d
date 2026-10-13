"""Run in Blender after setup_blender.py. Set AUDIO_PATH to a PCM WAV voice file.
Bakes volume-driven mouth opening; not phoneme-accurate lip sync.
"""
import bpy, wave, math
from array import array
from pathlib import Path
AUDIO_PATH = ''  # e.g. C:/voices/speech.wav or /home/me/speech.wav
START_FRAME = 1
GAIN = 3.5
NOISE_FLOOR = .015
if not AUDIO_PATH or not Path(AUDIO_PATH).is_file():
    raise ValueError('Set AUDIO_PATH to a PCM WAV recording (16-bit recommended).')
with wave.open(AUDIO_PATH,'rb') as w:
    if w.getsampwidth()!=2 or w.getcomptype()!='NONE':
        raise ValueError('Use 16-bit PCM WAV. Convert with ffmpeg -i speech.mp3 -ac 1 -ar 24000 -c:a pcm_s16le speech.wav')
    channels=w.getnchannels();rate=w.getframerate();raw=array('h',w.readframes(w.getnframes()))
import sys
if sys.byteorder!='little':raw.byteswap()
samples=[sum(raw[i:i+channels])/(32768*channels) for i in range(0,len(raw),channels)]
obj=bpy.context.scene.objects.get('Mouth')
if not obj or not obj.data.shape_keys:
    raise RuntimeError('Mouth mesh not found. Run setup_blender.py first.')
keys=obj.data.shape_keys
keys.animation_data_clear()
for k in keys.key_blocks:
    if k.name!='Basis':k.value=0
key=keys.key_blocks['MouthOpen'];fps=bpy.context.scene.render.fps/bpy.context.scene.render.fps_base
previous=0
for i in range(math.ceil(len(samples)/rate*fps)):
    chunk=samples[int(i*rate/fps):int((i+1)*rate/fps)]
    rms=math.sqrt(sum(x*x for x in chunk)/max(1,len(chunk)))
    target=min(1,max(0,(rms-NOISE_FLOOR)*GAIN))
    value=.65*target+.35*previous;previous=value
    key.value=value;key.keyframe_insert('value',frame=START_FRAME+i)
end=START_FRAME+math.ceil(len(samples)/rate*fps)
key.value=0;key.keyframe_insert('value',frame=end)
scene=bpy.context.scene;scene.frame_end=max(scene.frame_end,end)
editor=scene.sequence_editor_create()
strips=getattr(editor,'strips',None)
if strips is None:strips=editor.sequences
channel=max([s.channel for s in strips]+[0])+1
strips.new_sound('Voice recording',AUDIO_PATH,channel=channel,frame_start=START_FRAME)
# Repeat the enabled flight loop for the full recording.
root=scene.objects.get('Flight_Root')
if root and root.animation_data:
    for track in root.animation_data.nla_tracks:
        if not track.mute:
            for strip in track.strips:
                strip.repeat=max(1,math.ceil((end-strip.frame_start)/max(1,strip.action_frame_end-strip.action_frame_start)))
scene.frame_set(START_FRAME)
print('Audio and mouth keys added. Play timeline; save the .blend to retain changes.')
