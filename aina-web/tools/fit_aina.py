"""Fitted 360-degree voice avatar. Run with AINA_reference.blend loaded.
The original .blend is preserved. Outputs a new GLB and AINA_voice.blend.
"""
import bpy, math, json
from pathlib import Path
from math import sin, cos, pi, sqrt
out=Path(__file__).resolve().parents[1]/'public'/'models';out.mkdir(parents=True,exist_ok=True)
s=bpy.context.scene;s.frame_set(1);char=bpy.data.collections['01 • AINA — editable character'];ctrl=bpy.data.objects['CTRL • body sway']
for o in list(char.objects):
    o.animation_data_clear();o.hide_set(False);o.hide_render=False
    if o.type=='MESH' and o.data.shape_keys:
        o.data.shape_keys.animation_data_clear()
        for k in o.data.shape_keys.key_blocks:k.value=0
def face_y(x,z):return .10-.88*sqrt(max(.015,1-(x/1.29)**2-((z-1.77)/1.285)**2))-.022
def mat(name,color,rough=.3):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1)
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough
    return m
facemat=bpy.data.objects['02 • rounded face panel'].data.materials[0]
ink=mat('Mouth interior',(.012,.001,.004),.85);lipmat=mat('Lips',(.53,.21,.30));teethmat=mat('Teeth',(.88,.82,.74));tonguemat=mat('Tongue',(.58,.065,.14),.5)
poses={'Basis':(.165,.033,1.629,.047),'MouthOpen':(.177,.120,1.603,0),'MouthRound':(.093,.119,1.610,0),'MouthWide':(.209,.062,1.633,.008),'MouthClosed':(.155,.0018,1.638,.008),'MouthFV':(.159,.035,1.639,0)}
def edge(t,pose):
    rx,rz,cz,smile=pose;return rx*cos(t),cz+rz*sin(t)+smile*cos(t)**2
def mesh(name,verts,faces,material):
    d=bpy.data.meshes.new(name);d.from_pydata(verts,[],[tuple(reversed(f)) for f in faces]);d.update();d.materials.append(material)
    o=bpy.data.objects.new(name,d);char.objects.link(o);o.parent=ctrl;o.location=(0,0,-1.70)
    for p in d.polygons:p.use_smooth=True
    return o
def keyed(name,coords,faces,material):
    o=mesh(name,coords(poses['Basis']),faces,material)
    for name,pose in poses.items():
        k=o.shape_key_add(name=name)
        for v,co in zip(k.data,coords(pose)):v.co=co
    return o
def signed(v,p):return math.copysign(abs(v)**p,v)
N=128;R=40
def outer(t):return 1.145*signed(cos(t),.80),1.866+.853*signed(sin(t),.80)
def panel_coords(pose):
    vs=[]
    for j in range(R+1):
        r=j/R
        for i in range(N):
            t=i*2*pi/N;ix,iz=edge(t,poses['Basis']);ox,oz=outer(t);px,pz=edge(t,pose);f=(1-r)**5
            x=ix*(1-r)+ox*r+(px-ix)*f;z=iz*(1-r)+oz*r+(pz-iz)*f;vs.append((x,face_y(x,z),z))
    return vs
fs=[]
for j in range(R):
    for i in range(N):a=j*N+i;b=j*N+(i+1)%N;fs.append((a,b,b+N,a+N))
for name in ['02 • rounded face panel','Mouth • crescent smile','Smile edge • fine rose lip','03 • continuous cyan face gasket','04 • opal gasket surround']:
    o=bpy.data.objects.get(name)
    if o:bpy.data.objects.remove(o,do_unlink=True)
face=keyed('Face • fitted skin with mouth aperture',panel_coords,fs,facemat)
mod=face.modifiers.new('Fitted skin thickness','SOLIDIFY');mod.thickness=.008
# Body clearance behind the oral bowl is entirely hidden by the fitted skin.
body=bpy.data.objects['01 • pearl body'];verts=[tuple(v.co) for v in body.data.vertices];keep=[]
for p in body.data.polygons:
    pts=[body.matrix_world @ body.data.vertices[i].co for i in p.vertices];c=sum(pts,pts[0]*0)/len(pts)
    if c.y<0 and abs(c.x)<.29 and abs(c.z-1.625)<.22:continue
    keep.append(tuple(p.vertices))
oldmat=body.data.materials[0];d=bpy.data.meshes.new('Hull with oral clearance');d.from_pydata(verts,[],keep);d.materials.append(oldmat);d.update();body.data=d
for p in d.polygons:p.use_smooth=True
def cavity(pose):
    rx,rz,cz,smile=pose;vs=[]
    for j in range(6):
        r=1-j/5
        for i in range(N):
            x,z=edge(i*2*pi/N,pose);x*=r;z=cz+(z-cz)*r;vs.append((x,face_y(x,z)+.008+.105*(1-r*r),z))
    return vs
cf=[]
for j in range(5):
    for i in range(N):a=j*N+i;b=j*N+(i+1)%N;cf.append((a,a+N,b+N,b))
keyed('Mouth • recessed oral cavity',cavity,cf,ink)
K=10
def lips(pose):
    vs=[]
    for i in range(N):
        t=i*2*pi/N;x,z=edge(t,pose)
        for j in range(K):
            a=j*2*pi/K;xx=x+cos(t)*.010*cos(a);zz=z+sin(t)*.010*cos(a);vs.append((xx,face_y(xx,zz)-.007-.011*sin(a),zz))
    return vs
lf=[]
for i in range(N):
    for j in range(K):a=i*K+j;b=i*K+(j+1)%K;c=((i+1)%N)*K+(j+1)%K;d=((i+1)%N)*K+j;lf.append((a,b,c,d))
keyed('Mouth • dimensional lips',lips,lf,lipmat)
def teeth(pose):
    rx,rz,cz,_=pose;h=max(0,rz-.014)*.28;vs=[]
    for j in range(2):
        for i in range(33):
            u=-1+2*i/32;x=rx*.76*u;z=cz+rz*sqrt(max(0,1-(x/rx)**2))-.014-j*h;vs.append((x,face_y(x,z)+.034,z))
    return vs
keyed('Mouth • upper teeth',teeth,[(i,i+1,i+34,i+33) for i in range(32)],teethmat)
def tongue(pose):
    rx,rz,cz,_=pose;vs=[]
    for j in range(5):
        r=j/4
        for i in range(48):
            t=i*2*pi/48;x=rx*.53*r*cos(t);z=cz-rz*.55+max(0,rz-.016)*.24*r*sin(t);vs.append((x,face_y(x,z)+.040+.014*r*r,z))
    return vs
tg=[]
for j in range(4):
    for i in range(48):a=j*48+i;b=j*48+(i+1)%48;tg.append((a,b,b+48,a+48))
keyed('Mouth • tongue',tongue,tg,tonguemat)
# Seam wraps the actual hull, no detached flat face frame.
d=bpy.data.curves.new('Fitted cyan gasket','CURVE');d.dimensions='3D';d.bevel_depth=.008;d.bevel_resolution=4
line=d.splines.new('POLY');line.points.add(255)
for i,p in enumerate(line.points):x,z=outer(2*pi*i/256);p.co=(x,face_y(x,z)-.006,z,1)
line.use_cyclic_u=True;o=bpy.data.objects.new('Face • fitted luminous seam',d);char.objects.link(o);d.materials.append(bpy.data.materials['Face seam | turquoise light']);o.parent=ctrl;o.location=(0,0,-1.7)
for side,x in [('L',-.607),('R',.607)]:
    eye=bpy.data.objects['Eye.'+side];eye.location.y=face_y(x,1.8)-.018
    for name in ['Eye bezel.'+side,'Blue lens meniscus.'+side,'Cheek.'+side]:
        o=bpy.data.objects[name]
        if o.type=='CURVE':
            bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');o=bpy.context.object
        blocks=o.data.shape_keys.key_blocks if o.data.shape_keys else [None]
        for block in blocks:
            data=block.data if block else o.data.vertices
            for v in data:v.co.y=face_y(v.co.x,v.co.z)-(.023 if 'bezel' in name else .043 if 'meniscus' in name else .009)
    pivot=bpy.data.objects['CTRL • flipper.'+side];pivot.location.x=(-1 if side=='L' else 1)*1.025;pivot.location.z=1.05-1.70
bpy.data.objects['05 • transparent bubble shell'].scale.y=1.025
for o in list(char.objects):
    if o.type=='CURVE':
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
materials={}
for o in list(char.objects):
    if o.type!='MESH' or not o.data.materials:continue
    old=o.data.materials[0];ramp=next((n.color_ramp for n in old.node_tree.nodes if n.type=='VALTORGB'),None);zs=[v.co.z for v in o.data.vertices];lo,hi=min(zs),max(zs)
    attr=o.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
    for loop in o.data.loops:
        z=(o.data.vertices[loop.vertex_index].co.z-lo)/max(1e-6,hi-lo);attr.data[loop.index].color=ramp.evaluate(z) if ramp else old.diffuse_color
    if old.name not in materials:
        m=mat('Web '+old.name,(1,1,1),.28);p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Metallic'].default_value=.25;p.inputs['Coat Weight'].default_value=.8
        vc=m.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Color';m.node_tree.links.new(vc.outputs['Color'],p.inputs['Base Color'])
        if 'Eyes' in old.name:p.inputs['Roughness'].default_value=.1;p.inputs['Metallic'].default_value=.5
        if old.name.startswith(('Mouth','Lips','Teeth','Tongue')):p.inputs['Metallic'].default_value=0;p.inputs['Roughness'].default_value=.65 if old.name.startswith('Mouth') else .35
        if 'turquoise' in old.name:p.inputs['Emission Color'].default_value=(.01,.8,1,1);p.inputs['Emission Strength'].default_value=1.5
        if 'Bubble | clear' in old.name:p.inputs['Alpha'].default_value=.11;m.surface_render_method='DITHERED'
        if 'Cheeks' in old.name:p.inputs['Alpha'].default_value=.11;m.surface_render_method='DITHERED'
        materials[old.name]=m
    o.data.materials.clear();o.data.materials.append(materials[old.name])
bpy.ops.object.select_all(action='DESELECT')
for o in char.objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'aina.glb'),export_format='GLB',use_selection=True,export_animations=False,export_morph=True,export_morph_normal=True,export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'AINA_voice.blend'))
print('AINA_FITTED_EXPORT',json.dumps({'bytes':(out/'aina.glb').stat().st_size,'poses':list(poses),'face_clearance':.022}))
