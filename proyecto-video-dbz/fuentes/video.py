import numpy as np, subprocess, sys, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
U="/root/.claude/uploads/a355c1f4-5b7d-5a47-acf1-051f08711812/"
IM={1:"c58cf9f2-image.jpg",2:"cdd88960-image.jpg",3:"a241bb78-image.jpg",4:"d3678618-image.jpg"}
W,H,FPS,DUR=1080,1920,30,73.404
FX,FY,FW,FH=0,430,1080,1380   # caja del primer plano
AR=FW/FH
imgs={k:Image.open(U+v).convert("RGB") for k,v in IM.items()}
# (t0,t1,img,[(t,cx,cy,w)...],etiqueta)
SH=[
(0,9.5,3,[(0,360,520,720),(9.5,330,360,470)],"VEGITO"),
(9.5,20.0,1,[(9.5,190,330,420),(20,200,390,330)],"VEGITO"),
(20.0,33.5,2,[(20,360,330,600),(26.7,360,540,520),(33.5,350,700,600)],"DRAGON BALL Z · VEGITO vs MAJIN BUU"),
(33.5,41.0,2,[(33.5,350,700,600),(41,380,760,470)],"DRAGON BALL Z · VEGITO vs MAJIN BUU"),
(41.0,43.2,3,[(41,360,520,700),(43.2,330,330,420)],"DRAGON BALL SUPER"),
(43.2,54.5,4,[(43.2,360,260,620),(47.7,470,520,520),(52,330,860,560),(54.5,350,900,500)],"DRAGON BALL SUPER · VEGITO vs ZAMASU FUSIONADO"),
(54.5,66.0,1,[(54.5,360,403,621),(58.4,540,380,400),(60.75,200,380,400),(66,360,403,560)],"VEGITO  vs  GOGETA"),
(66.0,73.5,1,[(66,360,403,560),(73.5,360,403,621)],"VEGITO  vs  GOGETA"),
]
HITS=[20.08,26.74,28.1,29.5,31.2,32.7,43.19,49.0,50.6,51.7,54.6,66.0]
FLASH=[20.08,41.0,43.19,54.5,66.0]
def ease(u): u=min(max(u,0),1); return u*u*(3-2*u)
def cam(kfs,t):
    if t<=kfs[0][0]: return kfs[0][1:]
    for a,b in zip(kfs,kfs[1:]):
        if a[0]<=t<=b[0]:
            u=ease((t-a[0])/(b[0]-a[0])); return tuple(a[i]+(b[i]-a[i])*u for i in (1,2,3))
    return kfs[-1][1:]
bgs={}
def bg(k):
    if k not in bgs:
        im=imgs[k]; s=max(W/im.width,H/im.height)
        b=im.resize((int(im.width*s)+1,int(im.height*s)+1),Image.BICUBIC)
        x=(b.width-W)//2;y=(b.height-H)//2; b=b.crop((x,y,x+W,y+H)).filter(ImageFilter.GaussianBlur(35))
        a=np.asarray(b).astype(np.float32)*0.38
        yy=np.linspace(-1,1,H)[:,None,None]; xx=np.linspace(-1,1,W)[None,:,None]
        a*= (1-0.35*(xx**2+yy**2)); bgs[k]=a.astype(np.uint8)
    return bgs[k]
fnt=ImageFont.truetype("/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf",31)
tags={}
def tag(txt):
    if txt not in tags:
        im=Image.new("RGBA",(W,110),(0,0,0,0)); d=ImageDraw.Draw(im)
        tw=d.textlength(txt,font=fnt); x0=(W-tw)/2-30
        d.rounded_rectangle((x0,15,x0+tw+60,85),radius=35,fill=(0,0,0,170),outline=(255,215,0,255),width=3)
        d.text((W/2,50),txt,font=fnt,fill=(255,255,255,255),anchor="mm"); tags[txt]=im
    return tags[txt]
def frame(n):
    t=n/FPS
    sh=next((s for s in SH if s[0]<=t<s[1]),SH[-1]); t0,t1,k,kf,lab=sh
    f=bg(k).copy()
    cx,cy,w=cam(kf,t); h=w/AR; im=imgs[k]
    # mantener ventana dentro de la imagen
    w=min(w,im.width,im.height*AR); h=w/AR
    cx=min(max(cx,w/2),im.width-w/2); cy=min(max(cy,h/2),im.height-h/2)
    # temblor en golpes
    dx=dy=0
    for ht in HITS:
        d=t-ht
        if 0<=d<0.22:
            a=(1-d/0.22)*16; dx=int(math.sin(d*160)*a); dy=int(math.cos(d*190)*a)
    fg=im.resize((FW,FH),Image.BICUBIC,box=(cx-w/2,cy-h/2,cx+w/2,cy+h/2))
    # sombra + primer plano (con temblor)
    sh_=f.astype(np.float32); y0=max(FY-6+dy,0); y1=min(FY+FH+6+dy,H); sh_[y0:y1]*=0.35; f=sh_.astype(np.uint8)
    fi=Image.fromarray(f); fi.paste(fg,(FX+dx,FY+dy))
    T=tag(lab); fi.paste(T,(0,FY+FH+25),T); f=np.asarray(fi)
    # destello
    for ft in FLASH:
        d=t-ft
        if 0<=d<0.18:
            a=(1-d/0.18)*0.75; f=(f*(1-a)+255*a).astype(np.uint8)
    # fundido inicial/final
    if t<0.4: f=(f*(t/0.4)).astype(np.uint8)
    if t>DUR-0.6: f=(f*max((DUR-t)/0.6,0)).astype(np.uint8)
    return f
if __name__=="__main__":
    out=sys.argv[1]; S=sys.argv[2]; N=int(DUR*FPS); lim=int(sys.argv[3]) if len(sys.argv)>3 else N
    cmd=["ffmpeg","-v","error","-y","-f","rawvideo","-pix_fmt","rgb24","-s",f"{W}x{H}","-r",str(FPS),"-i","-",
         "-i",S+"/out/wav/mix.wav","-vf",f"ass={S}/out/subs.ass:fontsdir=/usr/share/fonts/opentype/inter",
         "-c:v","libx264","-preset","medium","-crf","18","-pix_fmt","yuv420p","-c:a","aac","-b:a","192k","-t",str(DUR),"-movflags","+faststart",out]
    p=subprocess.Popen(cmd,stdin=subprocess.PIPE)
    for n in range(min(N,lim)):
        p.stdin.write(frame(n).tobytes())
    p.stdin.close(); p.wait()
