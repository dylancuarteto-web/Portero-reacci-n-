import numpy as np, wave, sys
A=sys.argv[1]; O=sys.argv[2]; SR=44100; DUR=82.5402
def ld(n):
    w=wave.open(A+"/"+n+".wav"); return np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16)/32768.
def sv(n,x):
    w=wave.open(O+"/"+n+".wav","wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(x,-1,1)*32767).astype(np.int16).tobytes()); w.close()
# música: la fuente termina con silencio; usar 0..46.5 y empalmar con 10..46 con crossfade de 3s
m=ld("music"); a=m[:int(46.5*SR)]; b=m[int(10*SR):int(46.5*SR)]
def xf(a,b,s):
    n=int(s*SR); t=np.linspace(0,np.pi/2,n)
    return np.concatenate([a[:-n], a[-n:]*np.cos(t)+b[:n]*np.sin(t), b[n:]])
loop=xf(a,b,3.0)
while len(loop)<DUR*SR+SR: loop=xf(loop,b,3.0)
sv("music_loop",loop[:int((DUR+0.5)*SR)])
# SFX
pu=ld("powerup"); pk=ld("punch")
def cut(x,t0,d,fi=0.005,fo=0.15):
    y=x[int(t0*SR):int((t0+d)*SR)].copy(); n=len(y)
    y[:int(fi*SR)]*=np.linspace(0,1,int(fi*SR)); y[-int(fo*SR):]*=np.linspace(1,0,int(fo*SR)); return y
hits=[cut(pk,o-0.03,0.5) for o in (0.71,1.29,1.78,2.7,3.28,4.0,5.58,6.25)]
power=cut(pu,0.22,2.2,0.01,0.6)
out=np.zeros(int((DUR+0.5)*SR))
def put(y,t,g):
    i=int(t*SR); out[i:i+len(y)]+=y[:len(out)-i]*g
# (tiempo, tipo, ganancia)
for t,k,g in [(20.08,0,.40),(26.74,2,.34),(28.1,4,.30),(29.5,1,.34),(31.2,3,.30),(32.7,5,.30),
              (43.19,0,.40),(49.0,1,.32),(50.6,3,.32),(51.7,6,.36),(54.6,0,.40),(66.0,7,.36)]:
    put(hits[k],t,g)
put(power,41.0,.30); put(power,0.0,.20)
sv("sfx",out)
print("ok")
