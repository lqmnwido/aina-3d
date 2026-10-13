"""Validate final image/video deliverables and make a QA contact sheet."""
from pathlib import Path
from PIL import Image
import json, subprocess, shutil, hashlib
out=Path(__file__).resolve().parent
frames=[out/'frames'/f'aina_{f:04d}.png' for f in range(1,123)]
for path in frames:
    with Image.open(path) as im:
        assert im.size==(1620,1080),(path,im.size)
        im.verify()
with Image.open(out/'AINA_portrait.png') as im:
    assert im.size==(2688,1792),im.size
    im.verify()
ffprobe=shutil.which('ffprobe');ffmpeg=shutil.which('ffmpeg')
video=out/'AINA_animation.mp4'
meta=json.loads(subprocess.check_output([ffprobe,'-v','error','-show_streams','-show_format','-of','json',str(video)]))
streams=meta['streams'];assert len(streams)==1 and streams[0]['codec_type']=='video'
v=streams[0]
assert (v['width'],v['height'])==(1620,1080)
assert v['r_frame_rate']=='24/1' and int(v['nb_frames'])==122
assert abs(float(meta['format']['duration'])-122/24)<.002
subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-i',str(video),'-f','null','-'],check=True)
subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-i',str(video),'-vf',r'select=not(mod(n\,6)),scale=324:216,tile=5x4','-frames:v','1',str(out/'animation-contact.jpg')],check=True)
files={}
for name in ['AINA_reference.blend','AINA_portrait.png','AINA_animation.mp4']:
    p=out/name
    with p.open('rb') as f:digest=hashlib.file_digest(f,'sha256').hexdigest()
    files[name]={'bytes':p.stat().st_size,'sha256':digest}
report={'frames_verified':122,'resolution':[1620,1080],'fps':24,'duration_seconds':float(meta['format']['duration']),'audio_streams':0,'codec':v['codec_name'],'decoded_without_errors':True,'portrait_resolution':[2688,1792],'files':files}
(out/'output_validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
