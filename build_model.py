"""Rebuild the editable GLB. Requires Python 3 and numpy; no Blender required."""
import json, struct, math
from pathlib import Path
import numpy as np
OUT=Path(__file__).resolve().parent
G={'asset':{'version':'2.0','generator':'Pastel assistant procedural reconstruction'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'name':'Flight_Root','children':[]}],'meshes':[],'materials':[],'accessors':[],'bufferViews':[],'animations':[],'extensionsUsed':['KHR_materials_transmission','KHR_materials_ior','KHR_materials_clearcoat']}
B=bytearray(); geometry=[]
def acc(a,typ):
 a=np.ascontiguousarray(a,dtype=np.uint32 if typ=='SCALAR_INDEX' else np.float32)
 while len(B)%4:B.append(0)
 start=len(B); B.extend(a.tobytes()); v=len(G['bufferViews']); G['bufferViews'].append({'buffer':0,'byteOffset':start,'byteLength':a.nbytes})
 t='SCALAR' if typ=='SCALAR_INDEX' else typ
 d={'bufferView':v,'componentType':5125 if typ=='SCALAR_INDEX' else 5126,'count':len(a),'type':t}
 if t=='VEC3':d.update(min=a.min(axis=0).tolist(),max=a.max(axis=0).tolist())
 if t=='SCALAR' and typ!='SCALAR_INDEX':d.update(min=[float(a.min())],max=[float(a.max())])
 G['accessors'].append(d);return len(G['accessors'])-1

def mat(name,col,metal=0,rough=.25,emission=None,glass=False):
 m={'name':name,'pbrMetallicRoughness':{'baseColorFactor':[*col, .13 if glass else 1],'metallicFactor':metal,'roughnessFactor':rough},'doubleSided':True,'extensions':{'KHR_materials_clearcoat':{'clearcoatFactor':1,'clearcoatRoughnessFactor':.12}}}
 if emission:m['emissiveFactor']=emission
 if glass:m.update(alphaMode='BLEND');m['extensions'].update(KHR_materials_transmission={'transmissionFactor':.92},KHR_materials_ior={'ior':1.18})
 G['materials'].append(m);return len(G['materials'])-1
pearl=mat('Pearl • ice blue',(.57,.87,.96),.35,.2)
pink=mat('Face • rose opal',(.96,.63,.76),.13,.22)
eye=mat('Eyes • midnight glass',(.008,.012,.04),.25,.1)
cyan=mat('Trim • luminous aqua',(.16,.95,1),.35,.18,[.1,.65,.75])
rose=mat('Blush • soft rose',(.93,.34,.57),.1,.35)
white=mat('Catchlights',(.95,1,1),0,.1,[.5,.6,.6])
glass=mat('Bubble • transparent iridescent approximation',(.79,.92,1),0,.08,glass=True)
mouthmat=mat('Mouth • dark plum',(.032,.005,.025),0,.42)

def conv(p):
 p=np.asarray(p);return np.stack([p[:,0],p[:,2],-p[:,1]],axis=1)
def mesh(name,p,f,material,norm=None,targets=None,names=None):
 p=np.asarray(p,dtype=float);f=np.asarray(f,dtype=np.uint32)
 if norm is None:
  norm=np.zeros_like(p); cross=np.cross(p[f[:,1]]-p[f[:,0]],p[f[:,2]]-p[f[:,0]])
  for i in range(3):np.add.at(norm,f[:,i],cross)
  norm/=np.maximum(np.linalg.norm(norm,axis=1,keepdims=True),1e-8)
 prim={'attributes':{'POSITION':acc(conv(p),'VEC3'),'NORMAL':acc(conv(norm),'VEC3')},'indices':acc(f.ravel(),'SCALAR_INDEX'),'material':material}
 md={'name':name,'primitives':[prim]}
 if targets:
  prim['targets']=[{'POSITION':acc(conv(t-p),'VEC3')} for t in targets];md.update(weights=[0]*len(targets),extras={'targetNames':names})
 G['meshes'].append(md);node=len(G['nodes']);G['nodes'].append({'name':name,'mesh':len(G['meshes'])-1});G['nodes'][0]['children'].append(node)
 geometry.append((name,p,f,material,norm));return node

def sphere(name,c,s,material,tilt=0):
 p=[];n=[];f=[];nr=24;ns=48
 R=np.array([[math.cos(tilt),0,math.sin(tilt)],[0,1,0],[-math.sin(tilt),0,math.cos(tilt)]])
 for i in range(nr+1):
  th=np.pi*i/nr
  for j in range(ns+1):
   ph=2*np.pi*j/ns;u=np.array([np.sin(th)*np.cos(ph),np.sin(th)*np.sin(ph),np.cos(th)])
   p.append(R@(u*s)+c);nn=R@(u/np.array(s));n.append(nn/np.linalg.norm(nn))
 for i in range(nr):
  for j in range(ns):
   a=i*(ns+1)+j;b=a+ns+1;f.extend([[a,b,a+1],[a+1,b,b+1]])
 return mesh(name,p,f,material,n)

def ring(name,rx,rz,y,zc,r,material):
 p=[];f=[]
 for i in range(128):
  a=2*np.pi*i/128
  for j in range(10):
   b=2*np.pi*j/10;p.append(((rx+r*np.cos(b))*np.cos(a),y+r*np.sin(b),zc+(rz+r*np.cos(b))*np.sin(a)))
 for i in range(128):
  for j in range(10):
   a=i*10+j;b=((i+1)%128)*10+j;c=((i+1)%128)*10+(j+1)%10;d=i*10+(j+1)%10;f.extend([[a,b,c],[a,c,d]])
 return mesh(name,p,f,material)
sphere('Body', [0,0,1.85],[1.18,.82,1.22],pearl)
sphere('Face', [0,-.74,2.03],[1.015,.38,.865],pink)
ring('Face neon seam',1.018,.87,-.80,2.03,.018,cyan)
sphere('Arm.L',[-1.15,0,.97],[.24,.29,.49],pearl,.85)
sphere('Arm.R',[1.15,0,.97],[.24,.29,.49],pearl,-.85)
sphere('Foot.L',[-.42,.04,.43],[.27,.32,.51],pearl,-.12)
sphere('Foot.R',[.42,.04,.43],[.27,.32,.51],pearl,.12)
eye_nodes=[]
for side,x in [('L',-.46),('R',.46)]:
 eye_nodes.append(sphere('Eye.'+side,[x,-1.081,2.07],[.155,.092,.19],eye))
 sphere('Eye shine.'+side,[x-.044,-1.166,2.145],[.039,.018,.045],white)
 sphere('Cheek.'+side,[x*1.1,-1.038,1.83],[.14,.023,.06],rose)
# A filled, curved smile; three morph targets move the same vertices.
def mouth(kind):
 pts=[]
 for j in range(65):
  a=2*np.pi*j/64;u=np.cos(a);v=np.sin(a)
  if kind==0:x=.145*u;z=1.87+.065*u*u+(.009 if v>0 else .062)*v
  elif kind==1:x=.153*u;z=1.855+.035*u*u+.135*v
  elif kind==2:x=.105*u;z=1.855+.14*v
  else:x=.21*u;z=1.865+.03*u*u+.072*v
  y=-.74-.38*np.sqrt(max(.05,1-(x/1.015)**2-((z-2.03)/.865)**2))-.012
  pts.append([x,y,z])
 pts.insert(0,np.mean(pts[:-1],axis=0));return np.array(pts)
f=[[0,j+1,j+2] for j in range(64)]
mnode=mesh('Mouth',mouth(0),f,mouthmat,np.tile([0,-1,0],(66,1)),[mouth(1),mouth(2),mouth(3)],['MouthOpen','MouthRound','MouthWide'])
ring('Bubble rim',1.32,1.4,0,1.92,.014,pink)
sphere('Bubble shell',[0,0,1.92],[1.33,1.26,1.4],glass)
# 4 second seamless loops, 24 FPS. Last key repeats the start pose.
times=np.arange(97,dtype=float)/24

def animation(name,flight=False,talk=False):
 sam=[];channels=[]
 def channel(node,path,values,typ):
  i=len(sam);sam.append({'input':acc(times,'SCALAR'),'output':acc(values,typ),'interpolation':'LINEAR'});channels.append({'sampler':i,'target':{'node':node,'path':path}})
 t=times;phase=2*np.pi*t/4
 if flight:
  channel(0,'translation',np.array([.20*np.sin(phase),.26+.14*np.sin(2*phase),.09*np.sin(phase)]).T,'VEC3')
  a=.065*np.sin(phase);channel(0,'rotation',np.array([a*0,a*0,np.sin(a/2),np.cos(a/2)]).T,'VEC4')
 else:channel(0,'translation',np.array([t*0,.04*np.sin(2*phase),t*0]).T,'VEC3')
 if talk:
  active=(np.sin(phase*2) > -.55).astype(float);amount=(.5+.5*np.sin(phase*13))*.85*active
  vals=np.array([amount,amount*(.5+.5*np.sin(phase*3))*.25,amount*(.5+.5*np.cos(phase*5))*.25]).T;vals[-1]=vals[0]
  channel(mnode,'weights',vals.ravel(),'SCALAR')
 else:channel(mnode,'weights',np.zeros(len(t)*3),'SCALAR')
 G['animations'].append({'name':name,'samplers':sam,'channels':channels})
animation('01_Idle');animation('02_Talk_Demo',talk=True);animation('03_Fly',flight=True);animation('04_Fly_And_Talk',True,True)
G['buffers']=[{'byteLength':len(B)}]
j=json.dumps(G,separators=(',',':')).encode();j+=b' '*((-len(j))%4);B+=b'\0'*((-len(B))%4)
(OUT/'pastel_assistant.glb').write_bytes(struct.pack('<4sII',b'glTF',2,12+8+len(j)+8+len(B))+struct.pack('<I4s',len(j),b'JSON')+j+struct.pack('<I4s',len(B),b'BIN\0')+B)
print('GLB written:',OUT/'pastel_assistant.glb', 'nodes',len(G['nodes']),'animations',len(G['animations']))
