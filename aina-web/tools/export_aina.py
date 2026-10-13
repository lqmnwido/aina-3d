"""Export a separate web asset from the approved native Blender scene.
Run: blender -b ../reconstruction/AINA_reference.blend --python tools/export_aina.py
The source .blend is never saved or modified.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector

out = Path(__file__).resolve().parents[1] / 'public' / 'models'
out.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
scene.frame_set(1)
char = bpy.data.collections['01 • AINA — editable character']
objects = list(char.objects)
for obj in objects:
    obj.animation_data_clear()
    if obj.type == 'MESH' and obj.data.shape_keys:
        obj.data.shape_keys.animation_data_clear()
        for k in obj.data.shape_keys.key_blocks:
            k.value = 0
    obj.hide_set(False)
    obj.hide_render = False

# Convert the original contour curves to actual GLB meshes.
for obj in list(objects):
    if obj.type == 'CURVE':
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.convert(target='MESH')
objects = list(char.objects)

mouth = bpy.data.objects['Mouth • crescent smile']
# Keys use the face's original convex surface, keeping the mouth on the face.
def face_y(x, z):
    rr = (abs(x/1.145)**2.5 + abs((z-1.866)/.853)**2.5)**.8
    return -.805-.355*math.sqrt(max(0, 1-rr))
for name in ['MouthOpen', 'MouthRound', 'MouthWide']:
    key = mouth.shape_key_add(name=name)
    for i, v in enumerate(key.data):
        u = -1+2*(i//2)/64
        if name == 'MouthOpen':
            x = .173*u
            z = 1.685+.055*u*u if i%2 == 0 else 1.425+.315*u*u
        elif name == 'MouthRound':
            x = .115*u
            z = 1.60+(.15 if i%2 == 0 else -.15)*math.sqrt(max(0, 1-u*u))
        else:
            x = .215*u
            z = 1.68+.06*u*u if i%2 == 0 else 1.52+.22*u*u
        v.co = (x, face_y(x,z)-.020, z)
mouth.name = 'Mouth'
lip = bpy.data.objects.get('Smile edge • fine rose lip')
if lip:
    bpy.data.objects.remove(lip, do_unlink=True)  # static lip would cross an open mouth

# glTF cannot serialize Cycles shader graphs. Bake the original vertical colors
# into vertex colors and use portable PBR materials; bubble optics are restored
# in Three.js with MeshPhysicalMaterial.
material_map = {}
for obj in list(char.objects):
    if obj.type != 'MESH':
        continue
    if obj.name.startswith('Cheek.'):
        # Original radial alpha shader is handled by a soft, subdued web blush.
        color = (.55,.16,.27,1)
    else:
        color = None
    old = obj.data.materials[0] if obj.data.materials else None
    if not old:
        continue
    ramp = next((n.color_ramp for n in old.node_tree.nodes if n.type == 'VALTORGB'),None)
    positions = [v.co.z for v in obj.data.vertices]
    lo, hi = min(positions), max(positions)
    attr = obj.data.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='CORNER')
    for loop in obj.data.loops:
        z = (obj.data.vertices[loop.vertex_index].co.z-lo)/max(1e-6,hi-lo)
        attr.data[loop.index].color = color or (ramp.evaluate(z) if ramp else old.diffuse_color)
    if old.name not in material_map:
        m = bpy.data.materials.new('Web '+old.name)
        m.use_nodes = True
        p = m.node_tree.nodes.get('Principled BSDF')
        p.inputs['Base Color'].default_value = (1,1,1,1)
        p.inputs['Roughness'].default_value = .18
        p.inputs['Metallic'].default_value = .25
        p.inputs['Coat Weight'].default_value = .9
        p.inputs['Coat Roughness'].default_value = .08
        vc = m.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Color'
        m.node_tree.links.new(vc.outputs['Color'],p.inputs['Base Color'])
        if 'Eyes' in old.name:
            p.inputs['Metallic'].default_value = .65
            p.inputs['Roughness'].default_value = .08
        if 'Smile' in old.name:
            p.inputs['Metallic'].default_value = 0
            p.inputs['Roughness'].default_value = .65
        if 'turquoise' in old.name:
            p.inputs['Emission Color'].default_value = (.01,.8,1,1)
            p.inputs['Emission Strength'].default_value = 1.8
        if 'Bubble | clear' in old.name:
            p.inputs['Base Color'].default_value = (.8,.9,1,.12)
            p.inputs['Alpha'].default_value = .12
            m.surface_render_method = 'DITHERED'
        if 'Cheeks' in old.name:
            p.inputs['Alpha'].default_value = .16
            m.surface_render_method = 'DITHERED'
        material_map[old.name]=m
    obj.data.materials.clear();obj.data.materials.append(material_map[old.name])

bpy.ops.object.select_all(action='DESELECT')
for obj in char.objects: obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'aina.glb'),export_format='GLB',use_selection=True,export_animations=False,export_morph=True,export_morph_normal=True,export_yup=True)
print('AINA_WEB_EXPORT', json.dumps({'file':str(out/'aina.glb'),'bytes':(out/'aina.glb').stat().st_size,'mouth_keys':[k.name for k in mouth.data.shape_keys.key_blocks]}))
