"""Blender 4.x/5.x: open this script in Scripting, set PACKAGE_DIR if needed, Run Script.
Creates a NEW scene and saves pastel_assistant.blend next to this script.
"""
import bpy
from pathlib import Path
from mathutils import Vector
PACKAGE_DIR = ''  # Optional: absolute path to the extracted package directory.
if PACKAGE_DIR:
    folder = Path(PACKAGE_DIR).expanduser()
elif '__file__' in globals():
    folder = Path(__file__).resolve().parent
else:
    text = bpy.context.space_data.text if bpy.context.space_data else None
    if not text or not text.filepath:
        raise RuntimeError('Set PACKAGE_DIR to the extracted package folder first.')
    folder = Path(bpy.path.abspath(text.filepath)).parent
model = folder / 'pastel_assistant.glb'
if not model.is_file():
    raise FileNotFoundError(f'Extract the ZIP first. Model missing: {model}')
scene = bpy.data.scenes.new('Pastel Assistant • Flight and Talk')
bpy.context.window.scene = scene
bpy.ops.import_scene.gltf(filepath=str(model))
# Imported glTF animations become NLA tracks. Enable only the combined demo.
for obj in scene.objects:
    owners = [obj]
    if obj.type == 'MESH' and obj.data.shape_keys:
        owners.append(obj.data.shape_keys)
    for owner in owners:
        ad = owner.animation_data
        if ad:
            ad.action = None
            for track in ad.nla_tracks:
                track.mute = '04_Fly_And_Talk' not in track.name
scene.render.fps = 24
scene.frame_start = 1
scene.frame_end = 96
scene.render.engine = 'CYCLES'
scene.cycles.samples = 48
scene.render.resolution_x = 960
scene.render.resolution_y = 960
scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new('Lavender studio')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.12,.15,.23,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .4
bpy.ops.mesh.primitive_plane_add(size=200)
floor = bpy.context.object
floor.name = 'Studio floor'
floormat = bpy.data.materials.new('Matte lavender')
floormat.diffuse_color = (.16,.18,.25,1)
floormat.use_nodes = True
floormat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.16,.18,.25,1)
floormat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .8
floor.data.materials.append(floormat)
def aim(obj, target):
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(.35,-8.6,3.3))
cam=bpy.context.object
cam.name='Portrait camera'
cam.data.type='ORTHO'
cam.data.ortho_scale=4.6
scene.camera=cam
aim(cam,(0,0,1.85))
for name,pos,power,color,size in [
    ('Soft pink key',(-3,-4,6),650,(1,.65,.79),4),
    ('Cyan edge',(3,1,4),800,(.34,.87,1),3),
    ('Front fill',(2,-5,3),350,(.85,.94,1),3),
]:
    bpy.ops.object.light_add(type='AREA',location=pos)
    obj=bpy.context.object;obj.name=name;obj.data.energy=power;obj.data.color=color;obj.data.shape='DISK';obj.data.size=size;aim(obj,(0,0,2))
scene.frame_set(1)
for obj in bpy.context.selected_objects:obj.select_set(False)
root=scene.objects.get('Flight_Root')
if root:
    root.select_set(True);bpy.context.view_layer.objects.active=root
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
scene.render.filepath=str(folder/'render.png')
bpy.ops.wm.save_as_mainfile(filepath=str(folder/'pastel_assistant.blend'))
print('Ready. Space: play demo. F12: render. Saved pastel_assistant.blend.')
