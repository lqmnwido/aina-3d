"""Reference-driven AINA reconstruction. Run with Blender 5.2 in background.
All visible character parts are editable 3D geometry, not a reference-image plane.
"""
import bpy, math, json, sys, os
from pathlib import Path
from mathutils import Vector
from math import sin, cos, pi, sqrt

OUT = Path(__file__).resolve().parent
OUT.mkdir(exist_ok=True)
REF = Path(os.environ.get('AINA_REFERENCE_IMAGE', str(OUT / 'reference.png')))
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.name = 'AINA | reference wave • 122 frames'

def collection(name):
    c=bpy.data.collections.new(name); scene.collection.children.link(c); return c
CHAR=collection('01 • AINA — editable character')
STUDIO=collection('02 • Studio and reflection lights')
REFS=collection('03 • Reference — viewport only')
def move(obj, coll=CHAR):
    for c in list(obj.users_collection): c.objects.unlink(obj)
    coll.objects.link(obj)
    return obj
def empty(name, loc=(0,0,0), parent=None):
    o=bpy.data.objects.new(name,None); CHAR.objects.link(o); o.location=loc; o.parent=parent
    o.empty_display_size=.16; return o
ROOT=empty('CTRL • whole character')
BODY=empty('CTRL • body sway',(0,0,1.70),ROOT)
def parent_keep(o,p=BODY):
    loc=o.location.copy();o.parent=p;o.location=loc-p.location
    return o
def mat(name, color, metal=0, rough=.2, coat=.7, emission=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    p.inputs['Coat Weight'].default_value=coat;p.inputs['Coat Roughness'].default_value=.055
    if emission: p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
    return m
def gradient(m, stops):
    n=m.node_tree.nodes;l=m.node_tree.links;p=n.get('Principled BSDF')
    tex=n.new('ShaderNodeTexCoord');sep=n.new('ShaderNodeSeparateXYZ');r=n.new('ShaderNodeValToRGB')
    for i,(pos,c) in enumerate(stops):
        e=r.color_ramp.elements[i] if i<2 else r.color_ramp.elements.new(pos)
        e.position=pos;e.color=(*c,1)
    r.color_ramp.interpolation='EASE';l.new(tex.outputs['Generated'],sep.inputs[0]);l.new(sep.outputs['Z'],r.inputs[0]);l.new(r.outputs[0],p.inputs['Base Color'])
    return m
PEARL=gradient(mat('Pearl enamel | ice blue / pink iridescence',(.52,.79,.85),.30,.18),[(0,(.32,.48,.63)),(.35,(.32,.69,.76)),(.7,(.57,.78,.90)),(1,(.70,.87,.96))])
FACE=gradient(mat('Face | polished rose opal',(.76,.43,.56),.16,.10,1),[(0,(.28,.48,.61)),(.22,(.55,.26,.40)),(.6,(.76,.27,.41)),(1,(.82,.49,.61))])
FOOT=gradient(mat('Limb | opalescent enamel',(.48,.73,.83),.36,.23,.5),[(0,(.44,.025,.26)),(.15,(.16,.25,.43)),(.65,(.27,.59,.73)),(1,(.62,.77,.90))])
BLACK=gradient(mat('Eyes | midnight optical glass',(.001,.002,.008),.75,.065,.85),[(0,(.001,.003,.025)),(.4,(.0003,.0005,.003)),(1,(.0003,.0004,.002))])
nt=BLACK.node_tree;n=nt.nodes;l=nt.links;tex=n.new('ShaderNodeTexCoord');sep=n.new('ShaderNodeSeparateXYZ');l.new(tex.outputs['Generated'],sep.inputs[0])
coat=n.new('ShaderNodeValToRGB');coat.color_ramp.elements[0].position=.25;coat.color_ramp.elements[0].color=(.02,.02,.02,1);coat.color_ramp.elements[1].position=.70;coat.color_ramp.elements[1].color=(.9,.9,.9,1)
l.new(sep.outputs['Z'],coat.inputs[0]);l.new(coat.outputs[0],n.get('Principled BSDF').inputs['Coat Weight'])
RIM=mat('Eye rims | rose chrome',(.38,.14,.24),.80,.11)
CYAN=mat('Face seam | turquoise light',(.012,.84,1),.22,.15,.8,2.8)
PINK=mat('Bubble rim | pink pearl',(.72,.39,.61),.58,.11)
MOUTH=mat('Smile | deep ink',(.003,.0005,.003),0,.38,.18)

def smooth(o):
    for p in o.data.polygons:p.use_smooth=True
def uv(name,loc,scale,material,segments=96,rings=64,parent=BODY):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=loc)
    o=move(bpy.context.object);o.name=name;o.scale=scale;o.data.materials.append(material);smooth(o)
    if parent:parent_keep(o,parent)
    return o
def curve(name,pts,r,material,cyclic=True,parent=BODY):
    d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.resolution_u=2;d.bevel_depth=r;d.bevel_resolution=4
    s=d.splines.new('POLY');s.points.add(len(pts)-1)
    for p,co in zip(s.points,pts):p.co=(*co,1)
    s.use_cyclic_u=cyclic;o=bpy.data.objects.new(name,d);CHAR.objects.link(o);o.data.materials.append(material)
    if parent:parent_keep(o,parent)
    return o
def signed(v,p):return math.copysign(abs(v)**p,v)

# Orb proportions are measured against the supplied front view.
body=uv('01 • pearl body',(0,.10,1.77),(1.29,.88,1.285),PEARL)
RX,RZ,ZC=1.145,.853,1.866
def outline(a):return RX*signed(cos(a),.80), RZ*signed(sin(a),.80)
def face_y(x,z):
    rr=(abs(x/RX)**2.5+abs((z-ZC)/RZ)**2.5)**.8
    return -.805-.355*sqrt(max(0,1-rr))
vs=[(0,-1.16,ZC)];fs=[];N=160;R=48
for j in range(1,R+1):
    r=j/R
    for k in range(N):
        x,z=outline(k*2*pi/N);x*=r;z=ZC+z*r;vs.append((x,face_y(x,z),z))
for k in range(N):fs.append((0,1+k,1+(k+1)%N))
for j in range(R-1):
    a=1+j*N;b=a+N
    for k in range(N):kn=(k+1)%N;fs.append((a+k,b+k,b+kn,a+kn))
d=bpy.data.meshes.new('Smooth convex superellipse');d.from_pydata(vs,[],fs);d.update()
face=bpy.data.objects.new('02 • rounded face panel',d);CHAR.objects.link(face);d.materials.append(FACE);smooth(face);parent_keep(face)
sol=face.modifiers.new('Face panel thickness','SOLIDIFY');sol.thickness=.035
seam=[]
for k in range(256):
    x,z=outline(k*2*pi/256);seam.append((x,-.812,ZC+z))
curve('03 • continuous cyan face gasket',seam,.009,CYAN)
curve('04 • opal gasket surround',[(x*1.014,y+.015,ZC+(z-ZC)*1.014) for x,y,z in seam],.012,PEARL)

# Convex black eyes, separate polished rims, and shape-key eyelids.
EYES=[]
for side,x in [('L',-.607),('R',.607)]:
    z=1.80;y=face_y(x,z)-.025
    eye=uv('Eye.'+side,(x,y-.005,z),(.180,.065,.196),BLACK);eye.visible_shadow=False
    rim=curve('Eye bezel.'+side,[(x+.185*cos(t*2*pi/128),y+.002,z+.201*sin(t*2*pi/128)) for t in range(128)],.009,RIM)
    # The globe compresses into a curved crescent, matching the video's blink.
    eye.shape_key_add(name='Basis');sk=eye.shape_key_add(name='Blink')
    for v in sk.data:
        xx=v.co.x;v.co.z=v.co.z*.15-.23*(1-xx*xx)
    # Bezel also closes rather than leaving an open ring around a shut eye.
    bpy.context.view_layer.objects.active=rim;rim.select_set(True)
    bpy.ops.object.select_all(action='DESELECT');rim.select_set(True);bpy.ops.object.convert(target='MESH')
    rim=bpy.context.object;rim.shape_key_add(name='Basis');rk=rim.shape_key_add(name='Blink')
    for v in rk.data:v.co.z=z+(v.co.z-z)*.15-.045*(1-((v.co.x-x)/.19)**2)
    rim.visible_shadow=False
    EYES.extend([eye,rim])
    # A faint blue lower meniscus appears inside the black optical surface.
    pts=[]
    for k in range(65):
        a=pi*1.12+pi*.76*k/64;pts.append((x+.164*cos(a),y-.044,z+.181*sin(a)))
    accent=curve('Blue lens meniscus.'+side,pts,.006,mat('Lens blue.'+side,(.003,.015,.17),.7,.12),False)
    # follow the blink via scale, keyed below
    EYES.append(accent)

# Mouth surface follows the curvature of the face; corners taper to points.
vs=[];fs=[];top=[];bottom=[]
for k in range(65):
    u=-1+2*k/64;x=.158*u
    ztop=1.668+.072*u*u;zbot=1.574+.166*u*u
    vs.extend([(x,face_y(x,ztop)-.012,ztop),(x,face_y(x,zbot)-.012,zbot)])
    top.append(vs[-2]);bottom.append(vs[-1])
for k in range(64):a=k*2;fs.append((a,a+1,a+3,a+2))
d=bpy.data.meshes.new('Smile surface');d.from_pydata(vs,[],fs);d.materials.append(MOUTH);d.update()
mouth=bpy.data.objects.new('Mouth • crescent smile',d);CHAR.objects.link(mouth);smooth(mouth);parent_keep(mouth)
mouth.shape_key_add(name='Basis');sm=mouth.shape_key_add(name='Smile variation')
for v in sm.data:v.co.z=1.69+(v.co.z-1.69)*.78
curve('Smile edge • fine rose lip',top+list(reversed(bottom)),.0035,mat('Smile lip',(.64,.34,.43),.15,.28))

# Soft blush is a procedural radial tint on a surface conforming to the face.
blush=mat('Cheeks | soft diffused rose',(.88,.23,.40),.04,.3,.5)
nt=blush.node_tree;n=nt.nodes;l=nt.links;p=n.get('Principled BSDF');out=n.get('Material Output')
tex=n.new('ShaderNodeTexCoord');sep=n.new('ShaderNodeSeparateXYZ');l.new(tex.outputs['UV'],sep.inputs[0])
ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.05;ramp.color_ramp.elements[0].color=(.14,.14,.14,1);ramp.color_ramp.elements[1].position=.99;ramp.color_ramp.elements[1].color=(0,0,0,1);l.new(sep.outputs['X'],ramp.inputs[0])
trans=n.new('ShaderNodeBsdfTransparent');mix=n.new('ShaderNodeMixShader');l.new(ramp.outputs[0],mix.inputs[0]);l.new(trans.outputs[0],mix.inputs[1]);l.new(p.outputs[0],mix.inputs[2]);l.new(mix.outputs[0],out.inputs[0])
for side,x in [('L',-.67),('R',.67)]:
    verts=[];faces=[];uvs=[]
    for j in range(17):
        r=j/16
        for k in range(64):
            a=2*pi*k/64;xx=x+.19*r*cos(a);zz=1.58+.11*r*sin(a);verts.append((xx,face_y(xx,zz)-.008,zz));uvs.append((r,0))
    for j in range(16):
        for k in range(64):a=j*64+k;b=j*64+(k+1)%64;faces.append((a,a+64,b+64,b))
    d=bpy.data.meshes.new('Blush falloff');d.from_pydata(verts,[],faces);d.materials.append(blush);uvl=d.uv_layers.new()
    for loop in d.loops:uvl.data[loop.index].uv=uvs[loop.vertex_index]
    o=bpy.data.objects.new('Cheek.'+side,d);CHAR.objects.link(o);smooth(o);parent_keep(o)

# Shoulder pivots keep the flippers attached throughout the wave.
ARMS=[]
for side,sgn in [('L',-1),('R',1)]:
    pivot=empty('CTRL • flipper.'+side,(sgn*1.08,.04,.94),BODY)
    pivot.location-=BODY.location
    arm=uv('Flipper.'+side,(0,0,0),(.225,.25,.38),FOOT,parent=None)
    arm.parent=pivot;arm.location=(sgn*.10,0,-.19);arm.rotation_euler[1]=sgn*-.68
    ARMS.append(pivot)
for side,x in [('L',-.425),('R',.425)]:
    foot=uv('Foot.'+side,(x,.10,.36),(.274,.32,.40),FOOT,parent=ROOT)
    foot.rotation_euler[1]=-.08 if x<0 else .08

# Clear bubble: a thin optical shell with Fresnel reflections and no lens distortion.
glass=bpy.data.materials.new('Bubble | clear thin iridescent optical shell');glass.use_nodes=True
n=glass.node_tree.nodes;l=glass.node_tree.links;n.clear()
out=n.new('ShaderNodeOutputMaterial');t=n.new('ShaderNodeBsdfTransparent');p=n.new('ShaderNodeBsdfPrincipled')
p.inputs['Base Color'].default_value=(.83,.91,1,1);p.inputs['Metallic'].default_value=1;p.inputs['Roughness'].default_value=.06
p.inputs['Thin Film Thickness'].default_value=430;p.inputs['Thin Film IOR'].default_value=1.32
f=n.new('ShaderNodeFresnel');f.inputs['IOR'].default_value=1.22
weight=n.new('ShaderNodeMath');weight.operation='MULTIPLY';weight.inputs[1].default_value=.70;l.new(f.outputs[0],weight.inputs[0])
mix=n.new('ShaderNodeMixShader');l.new(weight.outputs[0],mix.inputs[0]);l.new(t.outputs[0],mix.inputs[1]);l.new(p.outputs[0],mix.inputs[2]);l.new(mix.outputs[0],out.inputs[0])
shell=uv('05 • transparent bubble shell',(0,.10,1.79),(1.44,1.50,1.40),glass,128,96)
shell.visible_shadow=False
shell.hide_set(True)  # Working solid view: keep the face visible; render remains enabled.
curve('06 • outer pearl bubble rim',[(1.435*cos(2*pi*k/256),.10,1.79+1.397*sin(2*pi*k/256)) for k in range(256)],.006,PINK)
edge=mat('Bubble | pearlescent inner edge',(.55,.84,.90),.4,.13,.8,.35)
curve('06b • inner optical rim',[(1.423*cos(2*pi*k/256),-.035,1.79+1.387*sin(2*pi*k/256)) for k in range(256)],.0045,edge)
# Internal light follows the lower spherical edge, illuminating the belly.
curve('07 • lower cyan arc',[(1.325*cos(pi+pi*k/160),-.35,1.79+1.28*sin(pi+pi*k/160)) for k in range(161)],.014,CYAN,False)

# Animated reference performance, 24 fps and the original 122-frame duration.
scene.render.fps=24;scene.frame_start=1;scene.frame_end=122
def keys(o,path,values,index=None):
    for f,v in values:
        if index is None:setattr(o,path,v)
        else:getattr(o,path)[index]=v
        o.keyframe_insert(data_path=path,index=index if index is not None else -1,frame=f)
keys(BODY,'rotation_euler',[(1,0),(14,0),(24,-.10),(32,-.17),(44,-.07),(55,-.105),(68,-.08),(80,-.035),(94,-.11),(104,-.02),(115,.015),(122,0)],1)
keys(ROOT,'location',[(1,(0,0,0)),(20,(.012,0,0)),(32,(.08,0,.005)),(52,(.035,0,.008)),(70,(.015,0,.01)),(88,(.02,0,.008)),(105,(0,0,0)),(122,(0,0,0))])
keys(ARMS[0],'rotation_euler',[(1,0),(17,0),(24,.68),(29,1.5),(34,1.32),(39,1.65),(45,1.21),(51,1.65),(57,1.0),(62,1.5),(69,1.10),(76,1.55),(82,1.13),(88,1.55),(93,.88),(99,.05),(108,0),(122,0)],1)
keys(ARMS[1],'rotation_euler',[(1,0),(22,0),(32,-.12),(52,-.06),(72,-.12),(96,-.08),(110,0),(122,0)],1)
blink=[(1,0),(4,0),(7,1),(9,1),(12,0),(97,0),(100,.1),(103,1),(105,.55),(108,0),(122,0)]
for o in EYES:
    if o.type=='MESH' and o.data.shape_keys:
        keys(o.data.shape_keys.key_blocks['Blink'],'value',blink)
    else:
        for f,v in blink:o.hide_render=v>.65;o.keyframe_insert('hide_render',frame=f)
keys(sm,'value',[(1,0),(18,0),(26,.25),(36,.05),(68,.12),(91,.08),(110,0),(122,0)])

# Replace hand-estimated body motion with measurements from every source frame.
measurements=OUT/'motion_measurements.json'
if measurements.exists():
    motion=json.loads(measurements.read_text())
    px_per_unit=810/6.30
    base_eyes=motion[0]['eyes'];bx=sum(e['x'] for e in base_eyes)/2;by=sum(e['y'] for e in base_eyes)/2
    for record in motion:
        f=record['frame'];le,re=record['eyes']
        if not le or not re:continue
        # Positive Y roll makes the right eye lower in the image.
        roll=math.atan2(re['y']-le['y'],re['x']-le['x'])
        BODY.rotation_euler[1]=roll;BODY.keyframe_insert('rotation_euler',index=1,frame=f)
        cx=(le['x']+re['x'])/2;cy=(le['y']+re['y'])/2
        BODY.location.x=(cx-bx)/px_per_unit-sin(roll)*.10
        BODY.location.z=1.70-(cy-by)/px_per_unit+.10*(1-cos(roll))
        BODY.keyframe_insert('location',frame=f)
        for eye in EYES:
            measured=le if eye.name.endswith('L') else re
            close=max(0,min(1,(43-measured['height'])/32))
            if eye.type=='MESH' and eye.data.shape_keys:
                key=eye.data.shape_keys.key_blocks['Blink'];key.value=close;key.keyframe_insert('value',frame=f)
            else:eye.hide_render=close>.60;eye.keyframe_insert('hide_render',frame=f)
    ROOT.animation_data_clear();ROOT.location=(0,0,0)
    # Place the waving flipper from its measured silhouette and principal axis.
    arm=bpy.data.objects['Flipper.L'];pivot=ARMS[0];pivot.animation_data_clear();pivot.rotation_euler=(0,0,0)
    rest=arm.location.copy();rest_angle=arm.rotation_euler[1]
    rest_scale=arm.scale.copy()
    for record in motion:
        f=record['frame'];a=record.get('arm');scene.frame_set(f)
        if a and 20<=f<=100:
            weight=min(1,(f-19)/5,(101-f)/5)
            wx=(a['x']-405)/px_per_unit+.10;wz=1.56+(270-a['y'])/px_per_unit
            roll=BODY.rotation_euler[1];dx=wx-BODY.location.x;dz=wz-BODY.location.z
            target=Vector((cos(roll)*dx-sin(roll)*dz,.04,sin(roll)*dx+cos(roll)*dz))-pivot.location
            target.y=0
            angle=math.atan2(cos(a['angle']),-sin(a['angle']))-roll
            # One smooth ellipsoid spans the observed outer tip and the shoulder.
            # Its thickness remains constant, avoiding a pinched or detached join.
            axis_vec=Vector((sin(angle),0,cos(angle)))
            distal=target-axis_vec*.31
            direction=-distal
            center=distal*.5
            connected_angle=math.atan2(direction.x,direction.z)
            arm.location=rest.lerp(center,weight)
            arm.rotation_euler[1]=rest_angle*(1-weight)+connected_angle*weight
            arm.scale=rest_scale.lerp(Vector((.225,.25,max(.31,direction.length*.5))),weight)
        else:arm.location=rest;arm.rotation_euler[1]=rest_angle;arm.scale=rest_scale
        arm.keyframe_insert('location',frame=f);arm.keyframe_insert('rotation_euler',frame=f);arm.keyframe_insert('scale',frame=f)

# Seamless grey-lavender cyclorama and large photographic strip reflections.
floor_mat=mat('Studio | matte lavender grey',(.25,.265,.315),0,.78,0)
fp=floor_mat.node_tree.nodes.get('Principled BSDF');fp.inputs['Emission Color'].default_value=(.20,.21,.28,1);fp.inputs['Emission Strength'].default_value=.45
nt=floor_mat.node_tree;gn=nt.nodes.new('ShaderNodeNewGeometry');sep=nt.nodes.new('ShaderNodeSeparateXYZ');nt.links.new(gn.outputs['Position'],sep.inputs[0])
scale=nt.nodes.new('ShaderNodeMath');scale.operation='MULTIPLY';scale.inputs[1].default_value=.2;nt.links.new(sep.outputs['Z'],scale.inputs[0])
gr=nt.nodes.new('ShaderNodeValToRGB');gr.color_ramp.elements[0].color=(.25,.265,.315,1);gr.color_ramp.elements[1].color=(.055,.06,.09,1)
nt.links.new(scale.outputs[0],gr.inputs[0]);nt.links.new(gr.outputs[0],fp.inputs['Base Color'])
bg=nt.nodes.new('ShaderNodeEmission');bg.inputs['Strength'].default_value=1
bgr=nt.nodes.new('ShaderNodeValToRGB');bgr.color_ramp.elements[0].color=(.27,.28,.36,1);bgr.color_ramp.elements[1].color=(.025,.020,.045,1)
nt.links.new(scale.outputs[0],bgr.inputs[0]);nt.links.new(bgr.outputs[0],bg.inputs[0])
blend=nt.nodes.new('ShaderNodeMapRange');blend.inputs['From Min'].default_value=1;blend.inputs['From Max'].default_value=5;nt.links.new(sep.outputs['Y'],blend.inputs['Value'])
mix=nt.nodes.new('ShaderNodeMixShader');nt.links.new(blend.outputs[0],mix.inputs[0]);nt.links.new(fp.outputs[0],mix.inputs[1]);nt.links.new(bg.outputs[0],mix.inputs[2]);nt.links.new(mix.outputs[0],nt.nodes.get('Material Output').inputs[0])
profile=[(-200,-.045),(3,-.045)]
for i in range(1,65):
    t=pi*.5*i/64;profile.append((3+3*sin(t),-.045+3*(1-cos(t))))
profile.append((6,30));verts=[(x,y,z) for y,z in profile for x in [-30,30]]
faces=[(2*i,2*i+1,2*i+3,2*i+2) for i in range(len(profile)-1)]
mesh=bpy.data.meshes.new('Continuous curved cyclorama');mesh.from_pydata(verts,[],faces);mesh.materials.append(floor_mat)
floor=bpy.data.objects.new('Seamless matte cyclorama',mesh);STUDIO.objects.link(floor);smooth(floor)
scene.world=bpy.data.worlds.new('Lavender ambient');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.30,.32,.43,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.38
def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
def area(name,loc,power,color,sx,sy,target):
    bpy.ops.object.light_add(type='AREA',location=loc);o=move(bpy.context.object,STUDIO);o.name=name
    o.data.energy=power;o.data.color=color;o.data.shape='RECTANGLE';o.data.size=sx;o.data.size_y=sy;aim(o,target);return o
area('Key • left vertical softbox',(-4.5,-2.0,3.3),420,(1,.78,.88),.65,3.0,(0,0,1.9))
key=area('Key • high right rectangular softbox',(2.5,-4.5,3.9),650,(1,.95,1),2.8,.6,(0,0,1.9));key.rotation_euler.rotate_axis('Z',-.65)
area('Edge • right vertical softbox',(3,-1.8,3.0),320,(.67,.91,1),.48,2.6,(0,0,1.8))
area('Rim • pink strip',(-3,1.3,2.9),470,(1,.31,.60),2,3,(0,0,1.7))
area('Rim • cyan high',(2,1.5,4.3),560,(.26,.92,1),2.5,2.5,(0,0,1.6))
# The translucent belly glows from within, without an external lamp reflected in it.
nt=PEARL.node_tree;n=nt.nodes;l=nt.links;p=n.get('Principled BSDF');tex=n.new('ShaderNodeTexCoord');sep=n.new('ShaderNodeSeparateXYZ');l.new(tex.outputs['Generated'],sep.inputs[0])
glow=n.new('ShaderNodeValToRGB');glow.color_ramp.elements[0].position=.03;glow.color_ramp.elements[0].color=(2,2,2,1);glow.color_ramp.elements[1].position=.23;glow.color_ramp.elements[1].color=(0,0,0,1)
l.new(sep.outputs['Z'],glow.inputs[0]);l.new(glow.outputs[0],p.inputs['Emission Strength']);p.inputs['Emission Color'].default_value=(.002,.75,.70,1)
for light in STUDIO.objects:
    if light.type=='LIGHT':
        light.data.energy*=.65
        if light.name.startswith(('Belly','Floor')):light.data.specular_factor=0
bpy.ops.object.camera_add(location=(.10,-100,5.56));cam=move(bpy.context.object,STUDIO);cam.name='CAM • reference front portrait'
cam.data.type='ORTHO';cam.data.ortho_scale=6.30;aim(cam,(.10,0,1.56));scene.camera=cam
cam.data.lens=70
scene.render.engine='CYCLES';scene.cycles.samples=96;scene.cycles.use_denoising=True
scene.cycles.max_bounces=8;scene.cycles.transparent_max_bounces=12
prefs=bpy.context.preferences.addons['cycles'].preferences
try:
    prefs.compute_device_type='OPTIX';prefs.get_devices()
    for device in prefs.devices:device.use=device.type=='OPTIX'
    scene.cycles.device='GPU'
except Exception as e:print('GPU setup:',e)
scene.render.resolution_x=1620;scene.render.resolution_y=1080;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=0
scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.color_depth='8'
# Subtle optical glow, limited to emissive cyan edges.
tree=bpy.data.node_groups.new('AINA • gentle optical bloom','CompositorNodeTree');scene.compositing_node_group=tree
tree.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor');n=tree.nodes;l=tree.links
rl=n.new('CompositorNodeRLayers');gl=n.new('CompositorNodeGlare');gl.inputs['Type'].default_value='Fog Glow';gl.inputs['Quality'].default_value='High';gl.inputs['Threshold'].default_value=2;gl.inputs['Strength'].default_value=.06
comp=n.new('NodeGroupOutput');l.new(rl.outputs['Image'],gl.inputs['Image']);l.new(gl.outputs['Image'],comp.inputs['Image'])

# Pack the still as a disabled reference empty, not as part of the rendered model.
ref=bpy.data.objects.new('REFERENCE • original still (not rendered)',None);REFS.objects.link(ref);ref.empty_display_type='IMAGE'
if REF.is_file():
    ref.data=bpy.data.images.load(str(REF));ref.data.pack()
ref.empty_display_size=6.3;ref.hide_render=True;ref.hide_viewport=True
scene['Reference clip']='chatbot-ai.mp4 | 1620 × 1080 | 24 fps | 122 frames | no audio'
scene['Reconstruction']='Editable 3D reconstruction; hidden surfaces inferred. Wave and blink keyed from reference timing.'
scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');ROOT.select_set(True);bpy.context.view_layer.objects.active=ROOT
for screen in bpy.data.screens:
    for a in screen.areas:
        if a.type=='VIEW_3D':
            a.spaces.active.region_3d.view_perspective='CAMERA';a.spaces.active.clip_end=500
            a.spaces.active.shading.color_type='MATERIAL';a.spaces.active.overlay.show_overlays=False
scene.render.filepath='//frames/aina_'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'AINA_reference.blend'))
if '--preview' in sys.argv:
    scene.render.resolution_percentage=60;scene.cycles.samples=48;scene.render.filepath=str(OUT/'preview.png');bpy.ops.render.render(write_still=True)
print('AINA scene ready:',OUT/'AINA_reference.blend')
