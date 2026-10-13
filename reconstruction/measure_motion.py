"""Measure visible eye centroids and closures from the supplied reference clip."""
from PIL import Image
from pathlib import Path
import json, math
folder=Path(__file__).resolve().parent
data=[]
for path in sorted((folder/'reference-frames').glob('*.png')):
    im=Image.open(path).convert('RGB');pix=im.load();eyes=[]
    for lo,hi in [(265,375),(415,510)]:
        points=set((x,y) for y in range(205,290) for x in range(lo,hi) if max(pix[x,y])<65)
        components=[]
        while points:
            seed=points.pop();stack=[seed];comp=[seed]
            while stack:
                x,y=stack.pop()
                for q in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
                    if q in points:points.remove(q);stack.append(q);comp.append(q)
            if len(comp)>15:components.append(comp)
        if not components:eyes.append(None);continue
        c=max(components,key=len);xs=[p[0] for p in c];ys=[p[1] for p in c]
        eyes.append(dict(x=sum(xs)/len(c),y=sum(ys)/len(c),width=max(xs)-min(xs)+1,height=max(ys)-min(ys)+1,area=len(c)))
    arm=None
    if all(eyes):
        cx=sum(e['x'] for e in eyes)/2;cy=sum(e['y'] for e in eyes)/2+3
        points=set((x,y) for y in range(250,416) for x in range(135,290)
                   if ((x-cx)/185)**2+((y-cy)/180)**2>1.09
                   and max(pix[x,y])>190 and max(pix[x,y])-min(pix[x,y])>12)
        comps=[]
        while points:
            seed=points.pop();stack=[seed];c=[seed]
            while stack:
                x,y=stack.pop()
                for q in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
                    if q in points:points.remove(q);stack.append(q);c.append(q)
            if len(c)>40:comps.append(c)
        if comps:
            c=max(comps,key=len);ax=sum(p[0] for p in c)/len(c);ay=sum(p[1] for p in c)/len(c)
            xx=sum((p[0]-ax)**2 for p in c)/len(c);yy=sum((p[1]-ay)**2 for p in c)/len(c);xy=sum((p[0]-ax)*(p[1]-ay) for p in c)/len(c)
            angle=.5*math.atan2(2*xy,xx-yy)
            arm=dict(x=ax,y=ay,angle=angle,area=len(c),minx=min(p[0] for p in c),maxx=max(p[0] for p in c),miny=min(p[1] for p in c),maxy=max(p[1] for p in c))
    data.append(dict(frame=int(path.stem),eyes=eyes,arm=arm))
(folder/'motion_measurements.json').write_text(json.dumps(data,indent=2))
for d in data[::6]:print(d)
