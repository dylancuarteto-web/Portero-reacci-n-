import sys, math
sys.path.insert(0, '.')
from generar_decoracion import read_level, GAMEPLAY, TRIGGERS, DUDOSOS
from PIL import Image, ImageDraw, ImageFilter
o1,h1,r1,ob=read_level('nivel_decorado.gdlvl')
cols={}
for c in h1.split(',')[1].split('|'):
    if c:
        kv=c.split('_'); d=dict(zip(kv[0::2],kv[1::2])); cols[d['6']]=(int(d['1']),int(d['2']),int(d['3']),int(255*float(d.get('7',1))))
def render(x0,y0,x1,y1,out,S=3):
    W,H=int((x1-x0)*S),int((y1-y0)*S)
    base=Image.new('RGBA',(W,H),cols['1000'][:3]+(255,))
    def P(x,y): return ((x-x0)*S,(y1-y)*S)
    def rot(px,py,cx,cy,a):
        a=math.radians(-a); dx,dy=px-cx,py-cy
        return (cx+dx*math.cos(a)-dy*math.sin(a), cy+dx*math.sin(a)+dy*math.cos(a))
    def poly(pts,cx,cy,a): return [P(*rot(px,py,cx,cy,a)) for px,py in pts]
    layers={}
    order=sorted(ob,key=lambda o:(int(o.get('24',3)),int(o.get('25',0))))
    for o in order:
        i=o['1']; x=float(o['2']); y=float(o['3'])
        if not(x0-60<x<x1+60 and y0-60<y<y1+60): continue
        a=float(o.get('6',0)); sx=float(o.get('128',1)); sy=float(o.get('129',sx))
        col=cols.get(o.get('21','1004'),(255,255,255,255))
        L=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(L)
        if i=='467': d.rectangle([*P(x-15,y+15),*P(x+15,y-15)],outline=(255,215,0,60),width=1)
        elif i in('8','39'):
            h=30 if i=='8' else 14; b=y-15
            d.polygon(poly([(x-15,b),(x+15,b),(x,b+h)],x,y,a),outline=(255,215,0,255),fill=(0,0,0,255),width=2)
        elif i in('36','84','141','1332','1275'): d.ellipse([*P(x-12,y+12),*P(x+12,y-12)],outline=(255,120,220,255),width=2)
        elif i in('186','187','1734'): d.ellipse([*P(x-30,y+30),*P(x+30,y-30)],outline=(150,150,150,255),width=3)
        elif i=='211': d.rectangle([*P(x-15,y+15),*P(x+15,y-15)],fill=col)
        elif i=='3046':
            for k in range(3):
                yy=y+10-k*10; d.line([P(x-15,yy),P(x+15,yy)],fill=col,width=1)
                off=0 if k%2 else 7.5
                for xx in (x-7.5+off,x+7.5+off): d.line([P(xx,yy),P(xx,yy-10)],fill=col,width=1)
        elif i=='469': d.line(poly([(x-15,y-15),(x-15,y+15),(x+15,y+15)],x,y,a),fill=col,width=2)
        elif i=='471': d.line(poly([(x+15,y-15),(x+15,y+15)],x,y,a),fill=col,width=2)
        elif i=='1157': d.line(poly([(x+7,y-8),(x+7,y+8)],x,y,a),fill=col,width=2)
        elif i=='3034':
            h=30*sx; d.polygon(poly([(x-h/2,y-h/2),(x+h/2,y-h/2),(x,y+h/2)],x,y,a),outline=col,width=2)
        elif i in('3044','3047','3043','3045','3049'):
            h=15*sx
            if i=='3045': d.polygon(poly([(x-h/2,y-h/2),(x+h/2,y-h/2),(x,y+h/2)],x,y,a),outline=col,width=2)
            else: d.polygon(poly([(x-h/2,y-h/2),(x+h/2,y-h/2),(x,y+h/2)],x,y,a),fill=col)
        elif i=='1292': d.rectangle([*P(x-13,y+4),*P(x-3,y-4)] if a==0 else [*P(x+3,y+4),*P(x+13,y-4)],fill=col)
        elif i=='505': h=15*sx; d.rectangle([*P(x-h,y+h),*P(x+h,y-h)],fill=col[:3]+(90,))
        elif i=='884': d.line([P(x-5,y),P(x+5,y)],fill=col,width=2); d.line([P(x,y-5),P(x,y+5)],fill=col,width=2)
        elif i=='1735': r=13*sx; d.ellipse([*P(x-r,y+r),*P(x+r,y-r)],outline=col,width=4)
        elif i in('231','237'): h=12*sx; d.polygon([P(x,y+h),P(x+h*0.6,y),P(x,y-h),P(x-h*0.6,y)],fill=col)
        elif i=='3048': h=15*sx; d.rectangle([*P(x-h,y+h),*P(x+h,y-h)],outline=col,width=1)
        elif i in('2974','3042'): d.line([P(x,y-15*sy),P(x,y+15*sy)],fill=col,width=1)
        elif i=='1203': d.line(poly([(x-15,y-15),(x-15,y+15),(x+15,y+15)],x,y,a),fill=col,width=2)
        else: continue
        base=Image.alpha_composite(base,L)
    gnd=ImageDraw.Draw(base); gnd.rectangle([*P(x0,0),*P(x1,y0)],fill=cols['1001'][:3]+(255,)); gnd.line([P(x0,0),P(x1,0)],fill=(255,215,0,255),width=2)
    base.convert('RGB').save(out)
render(120,-20,600,560,sys.argv[1]+'/v2_torre.png')
render(820,-20,1500,320,sys.argv[1]+'/v2_tramo1.png',2)
render(1950,-20,2800,560,sys.argv[1]+'/v2_tramo2.png',2)
