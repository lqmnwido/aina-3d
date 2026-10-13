"""Render QA poses, final still, or full reference-length animation in Blender."""
import bpy, sys, json, time, subprocess, shutil
from pathlib import Path
out=Path(__file__).resolve().parent
s=bpy.context.scene
p=bpy.context.preferences.addons['cycles'].preferences
p.compute_device_type='OPTIX';p.get_devices()
for d in p.devices:d.use=d.type=='OPTIX'
s.cycles.device='GPU';s.render.use_persistent_data=True
s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGB'
mode=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'qa'
if mode=='qa':
    s.render.resolution_percentage=50;s.cycles.samples=40
    for f in [9,24,31,67,107]:
        s.frame_set(f);s.render.filepath=str(out/f'qa-{f:03d}.png');bpy.ops.render.render(write_still=True)
elif mode=='still':
    s.frame_set(1);s.render.resolution_x=2688;s.render.resolution_y=1792;s.render.resolution_percentage=100;s.cycles.samples=128
    s.render.filepath=str(out/'AINA_portrait.png');bpy.ops.render.render(write_still=True)
elif mode=='animation':
    folder=out/'frames';folder.mkdir(exist_ok=True)
    s.render.resolution_percentage=100;s.cycles.samples=64;s.cycles.adaptive_threshold=.035;s.cycles.adaptive_min_samples=8
    for f in range(s.frame_start,s.frame_end+1):
        path=folder/f'aina_{f:04d}.png'
        if path.exists():continue
        t=time.time();s.frame_set(f);s.render.filepath=str(path);bpy.ops.render.render(write_still=True)
        print(f'AINA_FRAME {f}/122 {time.time()-t:.2f}s',flush=True)
    print('ANIMATION COMPLETE',flush=True)
    ffmpeg=shutil.which('ffmpeg')
    if not ffmpeg:raise RuntimeError('FFmpeg is needed to encode the completed PNG sequence')
    subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-framerate','24','-start_number','1','-i',str(folder/'aina_%04d.png'),'-frames:v','122','-vf','scale=in_range=pc:out_range=tv:out_color_matrix=bt709','-c:v','libx264','-preset','slow','-crf','16','-pix_fmt','yuv420p','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-movflags','+faststart','-an',str(out/'AINA_animation.mp4')],check=True)
    print('MP4 ENCODED',flush=True)
    s.frame_set(1);s.render.resolution_x=2688;s.render.resolution_y=1792;s.cycles.samples=128;s.cycles.adaptive_threshold=.02
    s.render.filepath=str(out/'AINA_portrait.png');bpy.ops.render.render(write_still=True)
    print('ALL DELIVERABLE RENDERS COMPLETE',flush=True)
