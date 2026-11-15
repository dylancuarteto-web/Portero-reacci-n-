import json,re
C=[(0.12,3.25,"¿Sabías que la fusión extraordinaria entre Goku y Vegeta,"),
(3.43,4.79,"conocida como Vegito,"),
(5.20,8.91,"tiene una de las curiosidades más impresionantes de todo Dragon Ball?"),
(9.54,11.27,"Y es que, dentro del manga canon,"),
(11.60,14.57,"Vegito tiene un historial de combate bastante peculiar:"),
(15.20,19.36,"ninguno de sus rivales ha conseguido demostrar una superioridad clara sobre él."),
(20.08,21.41,"Cuando se enfrenta a Majin Buu,"),
(21.73,26.12,"la diferencia de poder es tan grande que convierte la batalla en un auténtico juego."),
(26.74,29.08,"Vegito esquiva sus ataques,"),
(29.38,33.21,"lo provoca y demuestra una confianza impresionante durante todo el enfrentamiento."),
(33.84,36.40,"Incluso cuando Buu consigue convertirlo en un caramelo,"),
(36.73,40.25,"Vegito sigue siendo capaz de luchar y mantener el control de la situación."),
(41.02,42.52,"Pero su historia no termina ahí."),
(43.19,44.16,"En Dragon Ball Super,"),
(44.43,47.68,"Vegito vuelve a aparecer para enfrentarse a Zamasu fusionado."),
(48.31,48.76,"Esta vez,"),
(48.91,52.80,"el combate es mucho más exigente y su rival consigue plantarle cara."),
(53.54,54.72,"Ahora viene lo interesante:"),
(55.27,58.39,"esta es una hazaña que muchos fans comparan con Gogeta,"),
(58.73,60.75,"la otra gran fusión de Goku y Vegeta,"),
(61.09,63.41,"quien también ha demostrado un poder extraordinario,"),
(63.75,65.41,"aunque sus combates son diferentes."),
(66.16,66.44,"Y tú,"),
(66.72,67.22,"¿qué opinas?"),
(67.73,69.39,"¿Vegito es más fuerte que Gogeta"),
(69.60,71.42,"o crees que Gogeta está por encima?"),
(71.98,73.20,"¡Te leo en los comentarios!")]
INS, D = 53.17, 9.136122448979592
ADD = [(0.07, 1.34, "Además de esta hazaña,"), (1.51, 4.12, "Vegito no recibió ningún golpe en el canon,"),
       (4.46, 8.78, "siendo este que esquivó varios ataques de sus oponentes como Buu o Zamasu.")]
C = [x for x in C if x[0] < INS] + [(a + INS, b + INS, t) for a, b, t in ADD] + [(a + D, b + D, t) for a, b, t in C if a >= INS]
W=[]
for a,b,t in C:
    ws=t.split(); wt=[len(re.sub(r'\W','',w))+1.5 for w in ws]; tot=sum(wt); x=a
    for w,k in zip(ws,wt):
        d=(b-a)*k/tot; W.append((w,round(x,3),round(x+d,3))); x+=d
json.dump(W,open("words.json","w"),ensure_ascii=False)
# ASS
def ts(t):
    h=int(t//3600);m=int(t%3600//60);s=t%60
    return f"{h}:{m:02d}:{s:05.2f}"
ev=[]; i=0
while i<len(W):
    # chunk up to 3 words / 24 chars, break after punctuation
    ch=[W[i]]; i+=1
    while i<len(W) and len(ch)<3 and sum(len(x[0])+1 for x in ch)+len(W[i][0])<=19 and not re.search(r'[,.:?!]$',ch[-1][0]):
        ch.append(W[i]); i+=1
    ev.append(ch)
hdr="""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Default,Inter ExtraBold,80,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,7,3,5,40,40,0,1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
"""
L=[]
for ch in ev:
    for k,(w,a,b) in enumerate(ch):
        end = ch[k+1][1] if k+1<len(ch) else b
        txt=" ".join((r"{\c&H00D7FF&\fscx118\fscy118}"+x[0].upper()+r"{\c&HFFFFFF&\fscx100\fscy100}") if j==k else x[0].upper() for j,x in enumerate(ch))
        L.append(f"Dialogue: 0,{ts(a)},{ts(end)},Default,,0,0,0,,{{\\pos(540,300)}}{txt}")
open("subs.ass","w").write(hdr+"\n".join(L)+"\n")
print(len(W),"palabras",len(L),"eventos")
