import sys; sys.path.insert(0, sys.argv[3])
import numpy as np, wave
from scenes import SFX_ALL as SFX
A=sys.argv[1]; O=sys.argv[2]; SR=44100; DUR=82.5402
def ld(n):
    w=wave.open(A+"/"+n+".wav"); return np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16)/32768.
def sv(n,x):
    w=wave.open(O+"/"+n+".wav","wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(x,-1,1)*32767).astype(np.int16).tobytes()); w.close()
pu=ld("powerup"); pk=ld("punch")
def cut(x,t0,d,fi=0.005,fo=0.15):
    y=x[int(t0*SR):int((t0+d)*SR)].copy()
    y[:int(fi*SR)]*=np.linspace(0,1,int(fi*SR)); y[-int(fo*SR):]*=np.linspace(1,0,int(fo*SR)); return y
hits=[cut(pk,o-0.03,0.5) for o in (0.71,1.29,1.78,2.7,3.28,4.0,5.58,6.25)]
power=cut(pu,0.22,2.2,0.01,0.6)
out=np.zeros(int((DUR+0.5)*SR))
def put(y,t,g):
    i=int(t*SR); n=min(len(y),len(out)-i); out[i:i+n]+=y[:n]*g
for t,k,g in SFX:
    if k=="power": put(power,t,g)
    elif k=="big": put(hits[0],t,g); put(hits[6],t+0.04,g*0.8); put(hits[2],t+0.12,g*0.6)
    else: put(hits[k],t,g)
sv("sfx",out); print("sfx ok", len(SFX))
