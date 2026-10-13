"""Check the saved Blender deliverable and evaluated animation poses."""
import bpy, json, math
from pathlib import Path
s=bpy.context.scene
out=Path(__file__).resolve().parent
assert s.render.fps==24 and s.frame_start==1 and s.frame_end==122
assert (s.render.resolution_x,s.render.resolution_y)==(1620,1080)
assert s.camera and s.render.engine=='CYCLES'
required=['CTRL • whole character','CTRL • body sway','01 • pearl body','02 • rounded face panel','05 • transparent bubble shell','Flipper.L','Flipper.R','Eye.L','Eye.R','Mouth • crescent smile']
for name in required:assert name in s.objects,name
records=[]
for frame in [1,9,31,67,73,107,122]:
    s.frame_set(frame);deps=bpy.context.evaluated_depsgraph_get()
    arm=s.objects['Flipper.L'].evaluated_get(deps);mesh=arm.to_mesh()
    assert len(mesh.vertices)>100
    assert all(math.isfinite(c) for v in mesh.vertices for c in v.co)
    records.append(dict(frame=frame,arm_vertices=len(mesh.vertices),arm_faces=len(mesh.polygons),blink_left=s.objects['Eye.L'].data.shape_keys.key_blocks['Blink'].value))
    arm.to_mesh_clear()
packed=[im.name for im in bpy.data.images if im.packed_file]
assert packed
report=dict(blender=bpy.app.version_string,scene=s.name,objects=len(s.objects),meshes=sum(o.type=='MESH' for o in s.objects),materials=len(bpy.data.materials),fps=24,frames=122,seconds=122/24,resolution=[1620,1080],packed_images=packed,evaluated_poses=records,render_engine='CYCLES',scope='Scene structure, packed reference, finite evaluated geometry, animation range and pose checks. Not a certification of exact reference matching.')
(out/'scene_validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2),flush=True)
