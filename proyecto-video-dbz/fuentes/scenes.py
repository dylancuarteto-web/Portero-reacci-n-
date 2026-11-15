from chars import *

U = "/root/.claude/uploads/a355c1f4-5b7d-5a47-acf1-051f08711812/"
IMGS = {k: skia.Image.open(U + v) for k, v in
        {1: "c58cf9f2-image.jpg", 2: "cdd88960-image.jpg", 3: "a241bb78-image.jpg", 4: "d3678618-image.jpg"}.items()}
DUR = 73.404
GY = GROUND
SC = 1.32
VEG, GOG, BUU, ZAM = Char("vegito"), Char("gogeta"), Char("buu"), Char("zamasu")
BLUE, GOLD, PINK, WHITE = (80, 190, 255), (255, 214, 70), (250, 120, 220), (235, 240, 255)

# ------------------------------------------------------------------ sound + flash cues
# (time, kind, gain)   kind: hit index 0..7, "power", "big"
SFX = [(0.0, "power", .22),
       (10.25, 0, .36), (11.85, 1, .26), (12.2, 3, .26), (12.55, 5, .28), (13.25, 2, .32), (17.1, "power", .26),
       (20.08, 0, .30), (21.6, 1, .22), (21.95, 3, .20), (22.3, 5, .22), (22.65, 1, .20), (23.0, 3, .22),
       (24.0, 5, .18), (24.35, 1, .18), (24.7, 3, .18), (25.05, 5, .20), (26.74, 2, .38), (28.1, 4, .30),
       (31.0, 1, .22), (31.25, 3, .20), (31.5, 5, .22), (32.7, 0, .40),
       (35.2, 6, .30), (37.6, "power", .26), (38.7, 1, .40),
       (41.0, "power", .30), (41.9, 0, .36),
       (43.19, 0, .30), (45.8, 2, .38), (47.4, 5, .34), (49.0, 1, .30), (49.6, 3, .28), (50.2, 4, .30), (50.8, 6, .30), (51.7, "big", .42),
       (55.9, 0, .34), (61.1, "power", .28), (61.9, 0, .34),
       (63.75, 7, .26), (67.4, "big", .48)]
FLASH = [9.54, 20.08, 33.84, 41.9, 43.19, 53.54, 61.9, 63.75, 67.4]
SHAKE = [(10.25, 10), (13.25, 8), (17.1, 14), (20.08, 8), (21.6, 4), (22.3, 4), (23.0, 4), (26.74, 14), (28.1, 8), (31.0, 5), (31.5, 5), (32.7, 18), (37.6, 16), (38.7, 14),
         (41.0, 10), (41.9, 18), (45.8, 14), (47.4, 10), (49.0, 8), (49.6, 8), (50.2, 8), (50.8, 8), (51.7, 24), (55.9, 12),
         (61.9, 20), (67.4, 30)]


def shake_at(t):
    dx = dy = 0
    for st, a in SHAKE:
        d = t - st
        if 0 <= d < 0.35:
            k = (1 - d / 0.35) * a
            dx += math.sin(d * 140) * k
            dy += math.cos(d * 170) * k
    # long rumble during power-ups / standoff
    if 41.0 <= t < 41.9 or 61.1 <= t < 61.9:
        dx += math.sin(t * 90) * 5; dy += math.cos(t * 110) * 5
    if 51.7 <= t < 53.4:
        dx += math.sin(t * 80) * 4; dy += math.cos(t * 95) * 4
    if 67.4 <= t < 71.5:
        dx += math.sin(t * 70) * 3; dy += math.cos(t * 85) * 3
    return dx, dy


# ------------------------------------------------------------------ proof picture-in-picture
PROOF = [(0.4, 20.08, 3, "MANGA · VEGITO BLUE"), (20.08, 41.0, 2, "MANGA · VEGITO vs BUU"),
         (41.0, 53.54, 4, "MANGA · VEGITO vs ZAMASU"), (53.54, 67.6, 1, "VEGITO vs GOGETA")]


def pip(c, t):
    for t0, t1, k, lab in PROOF:
        if t0 <= t < t1:
            break
    else:
        return
    img = IMGS[k]
    w = 330
    h = w * img.height() / img.width()
    u = ease((t - t0) / 0.35)
    out = 1 - ease((t - (t1 - 0.25)) / 0.25) if t1 < 90 else 1
    s = (0.4 + 0.6 * u) * out
    if s <= 0.01:
        return
    cx, cy = W - 36 - w / 2, H - 70 - h / 2
    c.save()
    c.translate(cx, cy)
    c.rotate(3 + math.sin(t * 1.3) * 1.2)
    c.scale(s, s)
    r = skia.Rect.MakeXYWH(-w / 2, -h / 2, w, h)
    c.drawRoundRect(r.makeOutset(14, 14).makeOffset(10, 14), 18, 18, P((0, 0, 0), blur=10, a=110))
    c.drawRoundRect(r.makeOutset(14, 14), 18, 18, P((255, 255, 255)))
    c.drawRoundRect(r.makeOutset(14, 14), 18, 18, P((255, 206, 40), 6))
    c.save(); c.clipRRect(skia.RRect.MakeRectXY(r, 8, 8), True)
    c.drawImageRect(img, r, skia.SamplingOptions(skia.FilterMode.kLinear, skia.MipmapMode.kLinear))
    c.restore()
    c.drawRoundRect(r, 8, 8, P(OUTC, 4))
    c.restore()
    # source tag bottom-left
    a = int(255 * u * out)
    f = skia.Font(TF, 30)
    tw = f.measureText(lab)
    rr = skia.Rect.MakeXYWH(40, H - 130, tw + 50, 62)
    c.drawRoundRect(rr, 31, 31, P((20, 16, 40), a=int(a * 0.85)))
    c.drawRoundRect(rr, 31, 31, P((255, 206, 40), 4, a=a))
    c.drawString(lab, 65, H - 88, f, P((255, 255, 255), a=a))


# ------------------------------------------------------------------ helpers
def ghost(c, ch, kfs, t, x_of, view="side", face=1, n=3, dt=0.05, col=(255, 255, 255)):
    for i in range(n, 0, -1):
        tt = t - i * dt
        p = track(kfs, tt)
        ch.draw(c, p["x"], GY, p.get("sc", SC), p, tt, face=face, air=p.get("air", 0), alpha=0.18 + 0.08 * (n - i), shadow=False)


def dust(c, x, y, t01, s=1.0):
    if not 0 <= t01 <= 1:
        return
    for i in range(7):
        ang = math.pi + i * math.pi / 6
        r = 60 + 220 * ease(t01) * s
        px, py = x + math.cos(ang) * r, y + math.sin(ang) * r * 0.25
        rad = (40 + 30 * t01) * s
        c.drawCircle(px, py, rad, P((236, 214, 180), a=int(220 * (1 - t01))))
        c.drawCircle(px, py, rad, P(OUTC, 3, a=int(200 * (1 - t01))))


def label(c, s, x, y, t01, col=(255, 214, 60)):
    if t01 <= 0:
        return
    k = 0.5 + 0.5 * ease(t01 * 2)
    c.save(); c.translate(x, y); c.scale(k, k)
    text(c, s, 0, 0, 64, col, 12, skew=-0.12)
    c.restore()


def side(ch, kfs, t, c, face=1, view="side", aura_col=None, aura_k=0):
    p = track(kfs, t)
    sc = p.get("sc", SC)
    if aura_col and aura_k > 0:
        aura(c, p["x"], GY, sc, t, aura_col, aura_k, p.get("air", 0))
    ch.draw(c, p["x"], GY, sc, p, t, face=face, air=p.get("air", 0), alpha=p.get("alpha", 1.0))
    return p


# ================================================================== SCENES
def s1(c, t):  # 0 - 9.54 intro: Vegito Blue front, dragon balls orbiting
    bg_sky(c, t)
    air = 160 + math.sin(t * 2.2) * 22
    kf = [(0, {"p": "fpower", "expr": "shout", "form": "blue"}), (1.6, {"p": "fpower", "expr": "shout", "form": "blue"}),
          (2.4, {"p": "fcross", "expr": "smirk", "form": "blue"}), (9.6, {"p": "fcross", "expr": "smirk", "form": "blue"})]
    p = ftrack(kf, t)
    balls = []
    for i in range(7):
        ang = t * 0.9 + i * 2 * math.pi / 7
        balls.append((math.sin(ang), 540 + math.cos(ang) * 400, 1010 - air * 0.4 + math.sin(ang) * 110, i + 1))
    glow = 1.0 + (0.5 if 5.2 <= t < 9.0 else 0) * (0.5 + 0.5 * math.sin(t * 8))
    for d, x, y, n in sorted(balls):
        if d < 0:
            dragonball(c, x, y, 38 + 6 * d, n, t)
    k = 1.25 if t < 2.2 else 0.85
    aura(c, 540, GY, 1.42, t, BLUE, k * (0.6 + 0.4 * min(1, t / 0.8)), air)
    if t < 2.2:
        for i in range(3):
            lightning(c, 540 + (i - 1) * 160, GY - air - 700, 540 + (i - 1) * 90, GY - air - 120, t, seed=i)
    VEG.draw(c, 540, GY, 1.42, p, t, air=air, view="front")
    for d, x, y, n in sorted(balls):
        if d >= 0:
            dragonball(c, x, y, 38 + 6 * d, n, t, glow=True)
    if 3.43 <= t < 9.4:
        label(c, "VEGITO", 540, 600 + 0 * t, (t - 3.43) / 0.4, (120, 220, 255))


def s2(c, t):  # 9.54 - 20.08  lands, shadow-boxing, rivals silhouettes
    bg_waste(c, t)
    # landing (front view) 9.54-11.4, then side view
    if t < 11.4:
        air = 900 * (1 - ease((t - 9.54) / 0.71)) if t < 10.25 else 0
        kf = [(9.54, {"p": "fpower", "expr": "shout", "form": "blue"}), (10.25, {"p": "fpower", "crouch": 60, "expr": "shout", "form": "blue"}),
              (10.8, {"p": "fstand", "expr": "smirk", "form": "blue"})]
        p = ftrack(kf, t)
        aura(c, 540, GY, 1.4, t, BLUE, 0.7, air)
        if t < 10.25:
            for i in range(10):
                x = 540 + (i - 5) * 50
                c.drawLine(x, GY - air - 900, x, GY - air - 300, P((255, 255, 255), 6, a=120))
        VEG.draw(c, 540, GY, 1.4, p, t, air=air, view="front")
        dust(c, 540, GY, (t - 10.25) / 0.7, 1.3)
        ring(c, 540, GY, (t - 10.25) / 0.6, (255, 255, 255), 520)
        return
    combo = [(11.4, {"p": "idle", "x": 540, "expr": "smirk", "form": "blue"}),
             (11.75, {"p": "punch", "x": 560, "expr": "shout"}), (12.0, {"p": "punch2", "x": 575}),
             (12.25, {"p": "punch", "x": 590}), (12.5, {"p": "punch2", "x": 600}), (12.8, {"p": "idle", "x": 590}),
             (13.25, {"p": "kick", "x": 600}), (13.8, {"p": "idle", "x": 560}), (14.4, {"p": "cross", "x": 540, "expr": "smirk"}),
             (16.6, {"p": "cross", "x": 540}), (17.1, {"p": "power", "x": 540, "expr": "shout"}),
             (18.6, {"p": "power", "x": 540}), (19.2, {"p": "cross", "x": 540, "expr": "smirk"}), (20.1, {"p": "cross", "x": 540})]
    # rivals silhouettes 15.2 -> blown away at 17.1
    if 15.0 <= t < 19.0:
        a = ease((t - 15.0) / 0.5)
        off = 0 if t < 17.1 else ease((t - 17.1) / 0.8) * 600
        fade = 1 if t < 17.1 else max(0, 1 - (t - 17.1) / 0.9)
        BUU.silhouette(c, 200 - off, GY, 1.05, track([(0, {"p": "idle"})], t), t, (60, 30, 80), face=1, a=int(220 * a * fade))
        ZAM.silhouette(c, 880 + off, GY, 1.05, track([(0, {"p": "raise"})], t), t, (60, 30, 80), face=-1, a=int(220 * a * fade))
        if t < 17.1:
            text(c, "?", 200, GY - 640, 120, (255, 255, 255), 12)
            text(c, "?", 880, GY - 640, 120, (255, 255, 255), 12)
    ak = 1.3 if 17.1 <= t < 18.6 else 0.55
    side(VEG, combo, t, c, aura_col=BLUE, aura_k=ak)
    if 11.75 <= t < 12.8:
        speedlines(c, t, (255, 255, 255), 90, cx=600, cy=900)
    burst(c, 760, 860, 70, (t - 11.85) / 0.3, word=None)
    burst(c, 780, 900, 70, (t - 12.55) / 0.3, word=None)
    burst(c, 820, 1000, 110, (t - 13.25) / 0.45, word="¡ZAS!")
    ring(c, 540, GY, (t - 17.1) / 0.8, (190, 240, 255), 700)
    sparks(c, 540, GY - 300, (t - 17.1) / 0.8, (190, 240, 255), 20, R=500)


FLY = dict(ft1=26, ft2=-74, bt1=-14, bt2=-62)
AIRB = 300


def fly(kfs):
    out = []
    for tm, d in kfs:
        d = dict(d)
        if d.get("p", "idle") not in ("kick", "hurt", "dash", "legblock"):
            for k, v in FLY.items():
                d.setdefault(k, v)
        d.setdefault("air", AIRB)
        out.append((tm, d))
    return out


BUU_FIGHT_V = fly([
    (20.08, {"p": "idle", "x": 300, "expr": "smirk", "form": "gold"}), (21.3, {"p": "legblock", "x": 310}),
    (21.6, {"p": "legblock", "x": 290}), (21.8, {"p": "legblock", "x": 305}), (21.95, {"p": "legblock", "x": 288}), (22.15, {"p": "legblock", "x": 305}),
    (22.3, {"p": "legblock", "x": 288}), (22.5, {"p": "legblock", "x": 305}), (22.65, {"p": "legblock", "x": 288}), (22.85, {"p": "legblock", "x": 305}),
    (23.0, {"p": "legblock", "x": 288}), (23.4, {"p": "legblock", "x": 300, "expr": "smirk"}),
    (24.0, {"p": "legblock", "x": 292}), (24.2, {"p": "legblock", "x": 300}), (24.35, {"p": "legblock", "x": 292}), (24.55, {"p": "legblock", "x": 300}),
    (24.7, {"p": "legblock", "x": 292}), (24.9, {"p": "legblock", "x": 300}), (25.05, {"p": "legblock", "x": 292}),
    (25.4, {"p": "taunt", "x": 300}), (26.3, {"p": "taunt", "x": 300}), (26.6, {"p": "legblock", "x": 305}),
    (26.74, {"p": "legblock", "x": 300}), (27.4, {"p": "legblock", "x": 300}),
    (27.8, {"p": "dash", "x": 400, "air": AIRB}), (28.1, {"p": "punch", "x": 430, "expr": "grin"}),
    (28.6, {"p": "idle", "x": 310, "expr": "smirk"}), (29.38, {"p": "taunt", "x": 310, "expr": "smirk"}),
    (30.8, {"p": "cross", "x": 310}), (31.0, {"p": "cross", "x": 296}), (31.15, {"p": "cross", "x": 306}),
    (31.25, {"p": "cross", "x": 296}), (31.4, {"p": "cross", "x": 306}), (31.5, {"p": "cross", "x": 296}), (31.9, {"p": "cross", "x": 310}),
    (32.4, {"p": "idle", "x": 380}), (32.7, {"p": "kick", "x": 460, "expr": "shout", "air": AIRB}), (33.3, {"p": "idle", "x": 400, "expr": "smirk"}),
    (33.9, {"p": "idle", "x": 330})])
BUU_FIGHT_B = fly([
    (20.08, {"p": "idle", "x": 800, "expr": "angry"}), (21.0, {"p": "raise", "x": 780}),
    (21.4, {"p": "dash", "x": 660, "air": AIRB}), (21.6, {"p": "punch", "x": 630, "expr": "shout"}), (21.8, {"p": "idle", "x": 640}),
    (21.95, {"p": "punch2", "x": 630}), (22.15, {"p": "idle", "x": 640}), (22.3, {"p": "punch", "x": 630}), (22.5, {"p": "idle", "x": 640}),
    (22.65, {"p": "punch2", "x": 630}), (22.85, {"p": "idle", "x": 640}), (23.0, {"p": "punch", "x": 630}), (23.4, {"p": "idle", "x": 660, "expr": "angry"}),
    (24.0, {"p": "punch", "x": 630, "expr": "shout"}), (24.2, {"p": "idle", "x": 640}), (24.35, {"p": "punch2", "x": 630}), (24.55, {"p": "idle", "x": 640}),
    (24.7, {"p": "punch", "x": 630}), (24.9, {"p": "idle", "x": 640}), (25.05, {"p": "punch2", "x": 630}),
    (25.4, {"p": "idle", "x": 680, "expr": "angry"}), (26.3, {"p": "raise", "x": 700}), (26.74, {"p": "slash", "x": 620, "expr": "shout"}),
    (27.4, {"p": "slash", "x": 620}), (27.8, {"p": "idle", "x": 660, "expr": "angry"}), (28.1, {"p": "hurt", "x": 700, "expr": "hurt", "air": AIRB}),
    (28.6, {"p": "idle", "x": 690, "expr": "angry"}), (30.6, {"p": "idle", "x": 700}), (30.9, {"p": "dash", "x": 660, "air": AIRB}),
    (31.0, {"p": "punch", "x": 630, "expr": "shout"}), (31.15, {"p": "idle", "x": 640}), (31.25, {"p": "punch2", "x": 630}),
    (31.4, {"p": "idle", "x": 640}), (31.5, {"p": "punch", "x": 630}), (31.9, {"p": "idle", "x": 680, "expr": "angry"}),
    (32.4, {"p": "idle", "x": 680}), (32.7, {"p": "hurt", "x": 760, "expr": "hurt", "air": AIRB}), (33.3, {"p": "hurt", "x": 1350, "air": AIRB + 250}),
    (33.9, {"p": "hurt", "x": 1350, "air": AIRB + 250})])
B_HITS = [21.6, 21.95, 22.3, 22.65, 23.0, 24.0, 24.35, 24.7, 25.05, 31.0, 31.25, 31.5]


def wind(c, t):
    lin(c, skia.Rect.MakeWH(W, H), [(120, 176, 246), (190, 222, 255), (150, 196, 250)], 0, H)
    rnd = random.Random(77)
    for i in range(90):
        y = rnd.uniform(-20, H + 20)
        L = rnd.uniform(250, 1000)
        th = rnd.choice([3, 4, 6, 8, 12, 18, 26])
        sp = rnd.uniform(2200, 4200)
        col = rnd.choice([(255, 255, 255), (220, 238, 255), (176, 214, 255), (140, 190, 250)])
        a = rnd.randint(110, 230)
        span = W + L + 300
        x = (rnd.uniform(0, span) - t * sp) % span - L
        if th >= 18:
            c.drawLine(x, y, x + L, y, P(col, th * 2, blur=10, a=a // 2))
        c.drawLine(x, y, x + L, y, P(col, th, a=a))


def s3(c, t):  # 20.08 - 33.84 aerial fight vs Buuhan, wind background
    wind(c, t)
    bob = math.sin(t * 2.4) * 16
    pb = track(BUU_FIGHT_B, t)
    pb["air"] += bob * 0.8
    aura(c, pb["x"], GY, SC, t, PINK, 0.35, pb["air"])
    BUU.draw(c, pb["x"], GY, SC, pb, t, face=-1, air=pb["air"])
    if 25.3 <= t < 26.4 or 29.38 <= t < 30.9 or 23.3 <= t < 24.0:
        steam(c, BUU.headpos[0] - 20, BUU.headpos[1] - 70, t)
    if 29.6 <= t < 30.9:
        text(c, "¡GRRR!", pb["x"] + 20, BUU.top - 20, 66, (255, 90, 90), 12)
    p = track(BUU_FIGHT_V, t)
    p["air"] += bob
    if 25.4 <= t < 26.3 or 29.38 <= t < 30.8:
        p["fa2"] += math.sin(t * 16) * 30
    aura(c, p["x"], GY, SC, t, GOLD, 0.5, p["air"])
    if 27.7 <= t < 28.2 or 32.4 <= t < 32.8:
        ghost(c, VEG, BUU_FIGHT_V, t, None)
    VEG.draw(c, p["x"], GY, SC, p, t, air=p["air"])
    if 24.0 <= t < 25.3 or 29.38 <= t < 30.9:
        text(c, "¡JE!", p["x"] + 30, VEG.top - 10, 64, (255, 255, 255), 10)
    for ht in B_HITS:
        burst(c, BUU.hand[0], BUU.hand[1], 60, (t - ht) / 0.25)
        sparks(c, BUU.hand[0], BUU.hand[1], (t - ht) / 0.3, R=140, seed=int(ht * 10))
    burst(c, BUU.hand[0], BUU.hand[1], 110, (t - 26.74) / 0.45, word="¡PAF!")
    sparks(c, BUU.hand[0], BUU.hand[1], (t - 26.74) / 0.5, R=300)
    if 27.0 <= t < 27.8:
        text(c, "?!", pb["x"], BUU.top - 20, 90, (255, 255, 255), 12)
    burst(c, BUU.headpos[0] - 30, BUU.headpos[1], 80, (t - 28.1) / 0.4, word="¡TOC!")
    if 32.7 <= t < 33.6:
        burst(c, 760, GY - AIRB - 260, 130, (t - 32.7) / 0.5, word="¡PUM!")
        speedlines(c, t, (255, 255, 255), 100, cx=760, cy=GY - AIRB - 260)


def s4(c, t):  # 33.84 - 41.0 candy
    bg_waste(c, t)
    bk = [(33.84, {"p": "idle", "x": 1240, "expr": "angry", "air": 200}), (34.3, {"p": "idle", "x": 830, "air": 0}),
          (34.6, {"p": "point", "x": 830, "expr": "grin"}), (35.4, {"p": "laugh", "x": 830, "expr": "grin"}),
          (37.4, {"p": "laugh", "x": 830}), (37.6, {"p": "hurt", "x": 840, "expr": "hurt"}), (38.0, {"p": "idle", "x": 840, "expr": "angry"}),
          (38.5, {"p": "idle", "x": 830}), (38.7, {"p": "hurt", "x": 940, "expr": "hurt"}), (39.4, {"p": "idle", "x": 900, "expr": "angry"}),
          (41.1, {"p": "idle", "x": 900})]
    vk = [(33.84, {"p": "cross", "x": 295, "expr": "smirk", "form": "gold"}), (35.2, {"p": "hurt", "x": 295, "expr": "hurt"}),
          (37.6, {"p": "power", "x": 295, "expr": "shout"}), (38.3, {"p": "dash", "x": 485}), (38.7, {"p": "punch", "x": 565, "expr": "shout"}),
          (39.4, {"p": "cross", "x": 485, "expr": "smirk"}), (41.1, {"p": "cross", "x": 485})]
    pb = side(BUU, bk, t, c, face=-1)
    if 34.6 <= t < 35.3:
        beam(c, BUU.hand[0], BUU.hand[1], 330, 980, t)
    if 35.3 <= t < 37.6:
        u = t - 35.3
        bounce = abs(math.sin(u * 5)) * 120 * max(0, 1 - u / 1.5)
        sh = 1.0 if t < 36.73 else 1.0 + 0.05 * math.sin(t * 60)
        cy = GY - 60 - bounce
        if t >= 36.73:
            c.drawCircle(330, cy, 160 * (t - 36.73) / 0.9 + 60, P(GOLD, blur=40, a=int(200 * min(1, (t - 36.73) / 0.9))))
        jx = math.sin(t * 70) * 6 if t >= 36.73 else 0
        candy(c, 300 + jx, cy - 30, 1.4 * sh, t)
        if 35.5 <= t < 37.4:
            text(c, "¡JA JA JA!", 760, GY - 690, 64, (255, 120, 200), 12)
        if t >= 36.73:
            text(c, "!", 330, cy - 120, 110, (255, 230, 80), 12)
    else:
        p = track(vk, t)
        if t >= 37.6:
            aura(c, p["x"], GY, SC, t, GOLD, 1.1 if t < 38.3 else 0.5)
        VEG.draw(c, p["x"], GY, SC, p, t, air=p.get("air", 0))
    if 37.6 <= t < 38.2:
        u = (t - 37.6) / 0.6
        c.drawCircle(330, GY - 300, 500 * ease(u), P((255, 250, 210), a=int(255 * (1 - u))))
    burst(c, 760, 860, 120, (t - 38.7) / 0.45, word="¡PAF!")


def s5(c, t):  # 41.0 - 43.19 power-up gold -> blue (front)
    bg_dark(c, t)
    blue = t >= 41.9
    grow = 1.0 if not blue else 0.75 + 0.25 * ease((t - 41.9) / 0.5)
    p = ftrack([(41.0, {"p": "fpower", "expr": "shout", "form": "gold"})], t)
    p["form"] = "blue" if blue else "gold"
    p["grow"] = grow
    aura(c, 540, GY, 1.45, t, BLUE if blue else GOLD, 1.3 + 0.1 * math.sin(t * 20))
    for i in range(4):
        lightning(c, 540 + (i - 1.5) * 200, GY - 1100, 540 + (i - 1.5) * 60, GY - 200, t, BLUE if blue else (255, 240, 150), seed=i * 7)
    VEG.draw(c, 540, GY, 1.45, p, t, view="front")
    sparks(c, 540, GY - 400, (t - 41.9) / 0.8, (190, 240, 255), 24, R=700)
    ring(c, 540, GY, (t - 41.9) / 0.8, (190, 240, 255), 800)


Z_V = [(43.19, {"p": "idle", "x": 285, "expr": "angry", "form": "blue"}), (44.43, {"p": "idle", "x": 285}),
       (45.4, {"p": "dash", "x": 405}), (45.8, {"p": "punch", "x": 415, "expr": "shout"}), (46.5, {"p": "idle", "x": 295, "expr": "angry"}),
       (47.2, {"p": "idle", "x": 295}), (47.4, {"p": "block", "x": 285}), (47.9, {"p": "idle", "x": 305}),
       (48.8, {"p": "idle", "x": 385}), (49.0, {"p": "punch", "x": 395, "expr": "shout"}), (49.3, {"p": "block", "x": 385}),
       (49.6, {"p": "punch2", "x": 395}), (49.9, {"p": "block", "x": 375}), (50.2, {"p": "kick", "x": 385}), (50.5, {"p": "block", "x": 365}),
       (50.8, {"p": "punch", "x": 385}), (51.2, {"p": "idle", "x": 305}), (51.7, {"p": "punch", "x": 365, "expr": "shout"}),
       (53.6, {"p": "punch", "x": 365})]
Z_Z = [(43.19, {"p": "raise", "x": 840, "expr": "grin", "blade": True, "alpha": 0.0}), (44.0, {"p": "raise", "x": 830, "alpha": 1.0}),
       (45.4, {"p": "idle", "x": 830}), (45.8, {"p": "block", "x": 730, "expr": "angry"}), (46.5, {"p": "idle", "x": 830}),
       (47.0, {"p": "raise", "x": 720, "expr": "grin"}), (47.4, {"p": "slash", "x": 640}), (47.9, {"p": "idle", "x": 760}),
       (48.8, {"p": "idle", "x": 700}), (49.0, {"p": "block", "x": 700, "expr": "angry"}), (49.3, {"p": "slash", "x": 680, "expr": "grin"}),
       (49.6, {"p": "block", "x": 700}), (49.9, {"p": "slash", "x": 690}), (50.2, {"p": "hurt", "x": 720, "expr": "hurt"}),
       (50.5, {"p": "slash", "x": 690, "expr": "shout"}), (50.8, {"p": "block", "x": 700}), (51.2, {"p": "raise", "x": 780}),
       (51.7, {"p": "slash", "x": 730, "expr": "shout"}), (53.6, {"p": "slash", "x": 730})]


def s6(c, t):  # 43.19 - 53.54 Zamasu
    bg_dark(c, t)
    pz = track(Z_Z, t)
    if t < 44.0:
        c.drawCircle(pz["x"], GY - 330, 300 * (1 - (t - 43.19) / 0.8) + 40, P((255, 220, 120), blur=60, a=int(200 * (1 - (t - 43.19) / 0.8))))
    aura(c, pz["x"], GY, SC, t, PINK, 0.45)
    if 45.3 <= t < 45.8 or 48.8 <= t < 51.2:
        ghost(c, VEG, Z_V, t, None)
    p = track(Z_V, t)
    aura(c, p["x"], GY, SC, t, BLUE, 0.6 if t < 51.7 else 1.2)
    ZAM.draw(c, pz["x"], GY, SC, pz, t, face=-1, alpha=pz.get("alpha", 1.0))
    VEG.draw(c, p["x"], GY, SC, p, t)
    for ht, x, y in ((45.8, 560, 860), (47.4, 470, 820), (49.0, 560, 850), (49.6, 560, 900), (50.2, 600, 880), (50.8, 560, 860)):
        sparks(c, x, y, (t - ht) / 0.4, (255, 220, 255), 14, seed=int(ht * 10), R=200)
        burst(c, x, y, 70, (t - ht) / 0.3, col=(255, 200, 250))
    if t >= 51.7:
        u = (t - 51.7)
        cx, cy = 550, 860
        c.drawCircle(cx, cy, 120 + 20 * math.sin(t * 30), P((255, 255, 255), blur=30, a=220))
        ring(c, cx, cy + 300, (u % 0.6) / 0.6, (255, 200, 255), 700)
        for i in range(3):
            lightning(c, cx, cy, cx + math.cos(t * 3 + i * 2.1) * 360, cy + math.sin(t * 3 + i * 2.1) * 360, t, (255, 180, 255), seed=i + 30)
        speedlines(c, t, (255, 220, 255), 90, cx=cx, cy=cy)


def s7(c, t):  # 53.54 - 63.75 Vegito & Gogeta front, base -> blue
    bg_split(c, t)
    # Vegito
    vx = 540 if t < 55.0 else lerp(540, 300, ease((t - 55.0) / 0.6))
    vk = [(53.54, {"p": "fcross", "expr": "smirk", "form": "base"}), (58.9, {"p": "fcross", "expr": "smirk", "form": "base"}),
          (59.5, {"p": "fflex", "expr": "grin", "form": "base"}), (60.7, {"p": "fflex", "form": "base"}),
          (61.1, {"p": "fpower", "expr": "shout", "form": "base"}), (63.4, {"p": "fpower", "form": "base"}), (63.8, {"p": "fcross", "expr": "smirk", "form": "base"})]
    gk = [(53.54, {"p": "fstand", "expr": "smirk", "form": "base"}), (56.2, {"p": "fstand", "expr": "smirk", "form": "base"}),
          (58.4, {"p": "fstand", "form": "base"}), (58.9, {"p": "fcross", "expr": "smirk", "form": "base"}),
          (59.5, {"p": "fflex", "expr": "grin", "form": "base"}), (60.7, {"p": "fflex", "form": "base"}),
          (61.1, {"p": "fpower", "expr": "shout", "form": "base"}), (63.4, {"p": "fpower", "form": "base"}), (63.8, {"p": "fcross", "expr": "smirk", "form": "base"})]
    pv, pg = ftrack(vk, t), ftrack(gk, t)
    if t >= 61.9:
        g = 0.7 + 0.3 * ease((t - 61.9) / 0.5)
        for p in (pv, pg):
            p["form"] = "blue"; p["grow"] = g
    sc = 1.15
    blue = t >= 61.9
    if t >= 61.1:
        k = 1.25 if t < 63.4 else 0.8
        aura(c, vx, GY, sc, t, BLUE if blue else WHITE, k)
    VEG.draw(c, vx, GY, sc, pv, t, view="front")
    if t >= 55.27:
        u = (t - 55.27) / 0.65
        gair = 900 * (1 - ease(u)) if u < 1 else 0
        if t >= 61.1:
            aura(c, 780, GY, sc, t, BLUE if blue else WHITE, 1.25 if t < 63.4 else 0.8, gair)
        GOG.draw(c, 780, GY, sc, pg, t, air=gair, view="front")
        dust(c, 780, GY, (t - 55.92) / 0.7, 1.1)
        ring(c, 780, GY, (t - 55.92) / 0.6, (255, 255, 255), 420)
    if t >= 61.1 and t < 61.9:
        for i in range(2):
            lightning(c, 300 + i * 480, 300, 300 + i * 480, GY - 500, t, (255, 255, 255), seed=i + 50)
    if blue:
        sparks(c, 300, GY - 400, (t - 61.9) / 0.8, (190, 240, 255), 18, R=500, seed=4)
        sparks(c, 780, GY - 400, (t - 61.9) / 0.8, (190, 240, 255), 18, R=500, seed=8)
    # name labels
    if t >= 55.6:
        label(c, "VEGITO", 300, 560, (t - 55.6) / 0.4, (120, 220, 255))
    if t >= 57.6:
        label(c, "GOGETA", 780, 560, (t - 57.6) / 0.4, (255, 214, 60))
    # yellow divider like the comparison image
    if t >= 56.0:
        a = int(255 * ease((t - 56.0) / 0.4))
        c.drawLine(540, 480, 540, GY + 200, P((255, 230, 40), 26, blur=10, a=a // 2))
        c.drawLine(540, 480, 540, GY + 200, P((255, 236, 60), 10, a=a))


def cross_setup():
    """solve the cross-counter: Vegito low (bent legs) punching up, Gogeta upright punching down."""
    pv = dict(POSES["punch"]); pv.update(lean=24, head=-12, ft1=22, ft2=-46, bt1=-52, bt2=-26, fa2=-4, reach=1.4, expr="shout", form="blue")
    pg = dict(POSES["punch"]); pg.update(lean=8, head=-2, ft1=12, ft2=-6, bt1=-36, bt2=-4, fa2=-4, reach=1.4, expr="shout", form="blue")
    sc = SC

    def world(ch, p):
        J = ch.joints(p); d = ch.foot_depth(p)
        hand = (J["farm"][2][0] * sc, (J["farm"][2][1] - d) * sc)
        head = (J["hc"][0] * sc, (J["hc"][1] - d) * sc)
        return hand, head
    best = None
    for a_v in range(70, 140, 2):
        for a_g in range(60, 130, 2):
            pv["fa1"], pg["fa1"] = a_v, a_g
            hv, headv = world(VEG, pv)
            hg, headg = world(GOG, pg)
            # Vegito hand must hit Gogeta head, Gogeta hand must hit Vegito head (mirrored x)
            e1 = abs(hv[1] - headg[1])
            e2 = abs(hg[1] - headv[1])
            sep1 = hv[0] + headg[0] - 20 * sc
            sep2 = hg[0] + headv[0] - 20 * sc
            err = e1 + e2 + abs(sep1 - sep2)
            if best is None or err < best[0]:
                best = (err, a_v, a_g, (sep1 + sep2) / 2)
    _, a_v, a_g, sep = best
    pv["fa1"], pg["fa1"] = a_v, a_g
    return pv, pg, sep


CROSS_V, CROSS_G, CROSS_SEP = cross_setup()


def cam_s8(t):
    if t < 66.16:
        return 1.0 + 0.2 * ease((t - 63.75) / 2.4), 540, 900
    if t < 67.4:
        return 1.2 + 0.1 * ease((t - 66.16) / 1.2), 540, 900
    if t < 68.2:
        return lerp(1.3, 1.55, ease((t - 67.4) / 0.5)), 540, 840
    return 1.55 + 0.08 * (t - 68.2) / 5, 540, 840


def s8(c, t):  # 63.75 - 73.4 face off, zoom, cross-counter
    z, cx, cy = cam_s8(t)
    c.save()
    c.translate(cx, cy); c.scale(z, z); c.translate(-cx, -cy)
    bg_split(c, t)
    xa, xb = 540 - CROSS_SEP / 2, 540 + CROSS_SEP / 2
    if t < 66.8:
        vk = [(63.75, {"p": "idle", "x": 300, "expr": "angry", "form": "blue"}), (66.16, {"p": "idle", "x": 300}), (66.8, {"p": "dash", "x": 330})]
        gk = [(63.75, {"p": "idle", "x": 800, "expr": "angry", "form": "blue"}), (66.16, {"p": "idle", "x": 800}), (66.8, {"p": "dash", "x": 750})]
        pv, pg = track(vk, t), track(gk, t)
        aura(c, pv["x"], GY, SC, t, BLUE, 0.7)
        aura(c, pg["x"], GY, SC, t, BLUE, 0.7)
        GOG.draw(c, pg["x"], GY, SC, pg, t, face=-1)
        VEG.draw(c, pv["x"], GY, SC, pv, t)
        if t < 66.16:
            for i in range(2):
                lightning(c, 420, 760 + i * 60, 660, 760 + i * 60, t, (180, 230, 255), seed=60 + i)
    else:
        u = ease((t - 66.8) / 0.6)
        pv = {k: lerp(v, CROSS_V[k], u) if isinstance(v, (int, float)) else v for k, v in POSES["dash"].items()}
        pg = dict(pv)
        pv.update({k: v for k, v in CROSS_V.items() if not isinstance(v, (int, float))})
        pg = {k: lerp(v, CROSS_G[k], u) if isinstance(v, (int, float)) else v for k, v in POSES["dash"].items()}
        pg.update({k: v for k, v in CROSS_G.items() if not isinstance(v, (int, float))})
        vx = lerp(330, xa, u); gx = lerp(750, xb, u)
        aura(c, vx, GY, SC, t, BLUE, 1.2 if t >= 67.4 else 0.7)
        aura(c, gx, GY, SC, t, BLUE, 1.2 if t >= 67.4 else 0.7)
        if t < 67.4:
            ghost(c, VEG, [(66.8, {"p": "dash", "x": 330, "form": "blue"}), (67.4, {"p": "punch", "x": xa})], t, None)
        GOG.draw(c, gx, GY, SC, pg, t, face=-1)
        VEG.draw(c, vx, GY, SC, pv, t)
        if t >= 67.4:
            hx, hy = VEG.hand
            burst(c, hx, hy, 60, ((t - 67.4) % 1.2) / 1.2 if t < 71.0 else 1.1, col=(200, 240, 255))
            gx2, gy2 = GOG.hand
            burst(c, gx2, gy2, 60, ((t - 67.6) % 1.2) / 1.2 if 67.6 <= t < 71.0 else 1.1, col=(200, 240, 255), rot=10)
            ring(c, 540, 860, ((t - 67.4) % 0.9) / 0.9, (200, 240, 255), 600)
    c.restore()
    if t >= 67.4:
        speedlines(c, t, (255, 255, 255), 110, cx=540, cy=880)
        u = (t - 67.4) / 0.25
        if u < 1:
            c.drawRect(skia.Rect.MakeWH(W, H), P((255, 255, 255), a=int(230 * (1 - u))))
    ranking(c, t)
    if t >= 71.98:
        k = ease((t - 71.98) / 0.35)
        c.save(); c.translate(330, 1520); c.scale(k * 0.8, k * 0.8)
        bub = smooth([(-260, -70), (260, -70), (280, 40), (40, 60), (-20, 120), (-30, 60), (-280, 40)])
        fo(c, bub, (255, 255, 255), 8)
        text(c, "¡COMENTA!", 0, 18, 70, (226, 36, 46), 0)
        c.restore()


# ================================================================== RECAP (inserted narration, 9.14 s)
INS, DINS = 53.17, 9.136122448979592
TOTAL = DUR + DINS
# (relative time, attacker, defence)
REC_EV = [(1.7, "B", "block"), (2.0, "Z", "legblock"), (2.3, "B", "legblock"), (2.6, "Z", "block"), (2.9, "B", "block"),
          (3.2, "Z", "legblock"), (3.5, "B", "block"), (3.8, "Z", "block"),
          (4.6, "B", "up"), (5.2, "Z", "down"), (5.8, "B", "up"), (6.4, "Z", "down"), (6.9, "B", "up"), (7.4, "Z", "down")]
REC_SFX = [(INS + 0.0, "power", .18)] + [(INS + te, (1, 3, 5, 2)[i % 4], .18 if d in ("up", "down") else .24) for i, (te, a, d) in enumerate(REC_EV)] + [(INS + 7.8, "big", .34), (INS + 8.05, "power", .22)]


def rec_kfs():
    v = [(1.4, {"p": "idle", "x": 540, "expr": "smirk", "form": "blue"})]
    b = [(1.0, {"p": "dash", "x": -300, "expr": "angry"}), (1.45, {"p": "idle", "x": 110})]
    z = [(1.0, {"p": "dash", "x": 1400, "expr": "grin", "blade": True}), (1.45, {"p": "idle", "x": 970})]
    for i, (te, who, d) in enumerate(REC_EV):
        if d == "up":
            dv = {"p": "dodge", "air": AIRB + 170, "x": 560 if who == "B" else 520}
        elif d == "down":
            dv = {"p": "dodge", "air": AIRB - 120, "x": 520 if who == "Z" else 560}
        else:
            dv = {"p": d}
        v += [(te - 0.1, {"p": "idle", "x": 540}), (te, dict(dv)), (te + 0.18, dict(dv))]
        if who == "B":
            pose = "punch" if i % 2 == 0 else "punch2"
            b += [(te - 0.22, {"p": "idle", "x": 130}), (te - 0.04, {"p": "dash", "x": 210}), (te, {"p": pose, "x": 235, "expr": "shout"}),
                  (te + 0.2, {"p": "idle", "x": 190, "expr": "angry"})]
        else:
            z += [(te - 0.22, {"p": "raise", "x": 950}), (te - 0.04, {"p": "dash", "x": 870}), (te, {"p": "slash", "x": 845, "expr": "shout"}),
                  (te + 0.2, {"p": "idle", "x": 890, "expr": "grin"})]
    v += [(7.6, {"p": "idle", "x": 540}), (7.8, {"p": "power", "x": 540, "expr": "shout"}), (8.1, {"p": "cross", "x": 540, "expr": "smirk"}), (9.3, {"p": "cross", "x": 540})]
    b += [(7.75, {"p": "idle", "x": 180, "expr": "angry"}), (7.85, {"p": "hurt", "x": 170, "expr": "hurt"}), (8.4, {"p": "hurt", "x": -500, "air": AIRB + 300})]
    z += [(7.75, {"p": "idle", "x": 900}), (7.85, {"p": "hurt", "x": 910, "expr": "hurt"}), (8.4, {"p": "hurt", "x": 1600, "air": AIRB + 300})]
    return fly(v), fly(b), fly(z)


REC_V, REC_B, REC_Z = rec_kfs()


def counter(c, tt):
    if not (0.4 <= tt < 8.0):
        return
    n = sum(1 for te, _, _ in REC_EV if te <= tt)
    last = max([te for te, _, _ in REC_EV if te <= tt], default=-9)
    pop = 1 + 0.25 * max(0, 1 - (tt - last) / 0.2)
    k = ease((tt - 0.4) / 0.35) * (1 - ease((tt - 7.75) / 0.25))
    c.save(); c.translate(540, 520); c.scale(k, k)
    r = skia.Rect.MakeXYWH(-330, -70, 660, 140)
    c.drawRoundRect(r, 34, 34, P((18, 14, 36), a=220)); c.drawRoundRect(r, 34, 34, P((255, 206, 40), 6))
    text(c, "GOLPES BLOQUEADOS", -60, 16, 44, (255, 255, 255), 0)
    c.save(); c.translate(230, 0); c.scale(pop, pop)
    text(c, str(n), 0, 30, 96, (255, 214, 60), 10)
    c.restore(); c.restore()


def zero_on_back(c, x, py, sc, k, t):
    """giant golden zero carried on the back. py = pelvis y (Vegito faces right, back is on the left)."""
    if k <= 0:
        return
    c.save()
    c.translate(x - 150 * sc, py - 80 * sc)
    c.rotate(-14 + math.sin(t * 3) * 2)
    c.scale(k, k)
    text(c, "0", 0, 125, 380, (255, 214, 60), 24, skew=-0.06)
    c.restore()


def straps(c, x, py, sc, k):
    if k <= 0:
        return
    for (ax, ay), (bx, by) in (((-95, -112), (52, -84)), ((-90, -44), (46, -24))):
        p0 = (x + ax * sc, py + ay * sc); p1 = (x + bx * sc, py + by * sc)
        c.drawLine(*p0, *p1, P(OUTC, 22 * k))
        c.drawLine(*p0, *p1, P((150, 92, 40), 13 * k))


def recap(c, tt):
    wind(c, tt + 200)
    if tt < 1.45:
        air = 260 + math.sin(tt * 2.4) * 16
        p = ftrack([(0, {"p": "fcross", "expr": "smirk", "form": "blue"})], tt)
        aura(c, 540, GY, 1.35, tt, BLUE, 0.7, air)
        VEG.draw(c, 540, GY, 1.35, p, tt, air=air, view="front")
    else:
        bob = math.sin(tt * 2.4) * 14
        pb, pz = track(REC_B, tt), track(REC_Z, tt)
        pb["air"] += bob * 0.7; pz["air"] -= bob * 0.7
        aura(c, pb["x"], GY, SC, tt, PINK, 0.3, pb["air"])
        BUU.draw(c, pb["x"], GY, SC, pb, tt, face=1, air=pb["air"])
        aura(c, pz["x"], GY, SC, tt, PINK, 0.3, pz["air"])
        ZAM.draw(c, pz["x"], GY, SC, pz, tt, face=-1, air=pz["air"])
        p = track(REC_V, tt)
        p["air"] += bob
        # face the current / next attacker
        nxt = min(REC_EV, key=lambda e: abs(e[0] - tt))
        face = -1 if nxt[1] == "B" else 1
        if tt >= 7.6:
            face = 1
        if any(abs(tt - te) < 0.25 for te, _, d in REC_EV if d in ("up", "down")):
            ghost(c, VEG, REC_V, tt, None, face=face)
        aura(c, 540, GY, SC, tt, BLUE, 1.4 if 7.8 <= tt < 8.3 else 0.55, p["air"])
        if tt >= 8.05:
            pelvis_y = GY - VEG.foot_depth(p) * SC - p["air"]
            zero_on_back(c, 540, pelvis_y, SC, ease((tt - 8.05) / 0.35) * (1 + 0.12 * max(0, 1 - (tt - 8.05) / 0.3)), tt)
        VEG.draw(c, 540, GY, SC, p, tt, face=face, air=p["air"])
        if tt >= 8.05:
            straps(c, 540, pelvis_y, SC, ease((tt - 8.05) / 0.35))
        if tt >= 8.05:
            text(c, "GOLPES RECIBIDOS", 540, GY - p["air"] + 120, 58, (255, 255, 255), 12)
        for te, who, d in REC_EV:
            u = (tt - te) / 0.3
            hx, hy = (BUU.hand if who == "B" else ZAM.hand)
            if d in ("up", "down"):
                if 0 <= u < 1.6:
                    c.save(); c.translate(hx, hy - 40); s_ = 0.6 + 0.4 * ease(u * 2); c.scale(s_, s_)
                    text(c, "¡FALLÓ!", 0, 0, 54, (255, 80, 80), 10, skew=-0.12)
                    c.restore()
            else:
                burst(c, hx, hy, 55, u)
                sparks(c, hx, hy, u, R=130, seed=int(te * 10))
        ring(c, 540, GY - AIRB, (tt - 7.8) / 0.7, (190, 240, 255), 900)
        sparks(c, 540, GY - AIRB - 250, (tt - 7.8) / 0.7, (190, 240, 255), 26, R=700)
    counter(c, tt)


def pip_recap(c, tt):
    img = IMGS[3]
    w = 330; h = w * img.height() / img.width()
    u = ease(tt / 0.35)
    cx, cy = W - 36 - w / 2, H - 70 - h / 2
    c.save(); c.translate(cx, cy); c.rotate(3 + math.sin(tt * 1.3) * 1.2); c.scale(0.4 + 0.6 * u, 0.4 + 0.6 * u)
    r = skia.Rect.MakeXYWH(-w / 2, -h / 2, w, h)
    c.drawRoundRect(r.makeOutset(14, 14).makeOffset(10, 14), 18, 18, P((0, 0, 0), blur=10, a=110))
    c.drawRoundRect(r.makeOutset(14, 14), 18, 18, P((255, 255, 255)))
    c.drawRoundRect(r.makeOutset(14, 14), 18, 18, P((255, 206, 40), 6))
    c.save(); c.clipRRect(skia.RRect.MakeRectXY(r, 8, 8), True)
    c.drawImageRect(img, r, skia.SamplingOptions(skia.FilterMode.kLinear, skia.MipmapMode.kLinear))
    c.restore(); c.drawRoundRect(r, 8, 8, P(OUTC, 4)); c.restore()


# ================================================================== RANKING (question at the end)
def mini_head(c, ch, x, y, s, t):
    c.save(); c.translate(x, y); c.scale(s, s)
    ch.head_front(c, {"form": "blue", "expr": "smirk", "grow": 1.0}, t)
    c.restore()


def crown(c, x, y, s):
    c.save(); c.translate(x, y); c.scale(s, s)
    pth = poly([(-50, 30), (-56, -24), (-26, 4), (0, -36), (26, 4), (56, -24), (50, 30)])
    fo(c, pth, (255, 210, 50), 5)
    for px in (-56, 0, 56):
        circ(c, px, -30 if px else -42, 9, (255, 90, 90), 3)
    c.restore()


def ranking(c, t):
    t0, t1 = 67.73, 71.75
    if not (t0 <= t < t1 + 0.3):
        return
    k = ease((t - t0) / 0.35) * (1 - ease((t - t1) / 0.3))
    px, py, pw, ph = 70, 1150, 940, 520
    off = (1 - k) * 700
    c.save(); c.translate(0, off)
    r = skia.Rect.MakeXYWH(px, py, pw, ph)
    c.drawRoundRect(r.makeOffset(10, 14), 40, 40, P((0, 0, 0), blur=12, a=120))
    c.drawRoundRect(r, 40, 40, P((20, 16, 44), a=235)); c.drawRoundRect(r, 40, 40, P((255, 206, 40), 7))
    text(c, "RANKING DE FUSIONES", 540, py + 82, 56, (255, 214, 60), 10)
    rows = [py + 200, py + 390]
    # rank badges + crown fixed in place
    for i, ry in enumerate(rows):
        col = (255, 206, 40) if i == 0 else (200, 206, 220)
        circ(c, px + 100, ry, 62, col, 6)
        text(c, "#%d" % (i + 1), px + 100, ry + 22, 58, (30, 24, 50), 0)
        c.drawRoundRect(skia.Rect.MakeXYWH(px + 185, ry - 78, pw - 230, 156), 30, 30, P((255, 255, 255), a=28))
    crown(c, px + 100, rows[0] - 92, 0.8)
    # swap animation on "o crees que Gogeta está por encima"
    u = ease((t - 69.62) / 0.7)
    vy = lerp(rows[0], rows[1], u); gy = lerp(rows[1], rows[0], u)
    arc = math.sin(u * math.pi) * 120
    for ch, nm, yy, dx, colr in ((VEG, "VEGITO", vy, arc, (120, 220, 255)), (GOG, "GOGETA", gy, -arc, (255, 214, 60))):
        c.save(); c.translate(dx, 0)
        c.save(); c.clipRect(skia.Rect.MakeXYWH(px + 185, yy - 78, 200, 156)); mini_head(c, ch, px + 290, yy + 38, 0.72, t); c.restore()
        text(c, nm, px + 600, yy + 26, 80, colr, 12, skew=-0.1)
        c.restore()
    if t >= 70.3:
        a = ease((t - 70.3) / 0.3)
        c.save(); c.translate(px + pw - 70, rows[0]); c.scale(a, a)
        text(c, "▲", 0, 22, 70, (90, 230, 120), 8)
        c.restore()
        c.save(); c.translate(px + pw - 70, rows[1]); c.scale(a, a)
        text(c, "▼", 0, 22, 70, (255, 80, 80), 8)
        c.restore()
    c.restore()


SCENES = [(0, s1), (9.54, s2), (20.08, s3), (33.84, s4), (41.0, s5), (43.19, s6), (53.54, s7), (63.75, s8)]


def render(c, t):
    if INS <= t < INS + DINS:
        tt = t - INS
        recap(c, tt)
        pip_recap(c, tt)
        for ft in (0.0, DINS):
            u = (tt - ft) / 0.22
            if 0 <= u < 1:
                c.drawRect(skia.Rect.MakeWH(W, H), P((255, 255, 255), a=int(200 * (1 - u))))
        u = (tt - 7.8) / 0.25
        if 0 <= u < 1:
            c.drawRect(skia.Rect.MakeWH(W, H), P((255, 255, 255), a=int(200 * (1 - u))))
        return
    to = t if t < INS else t - DINS
    fn = [f for t0, f in SCENES if to >= t0][-1]
    dx, dy = shake_at(to)
    c.save()
    if dx or dy:
        c.translate(dx, dy)
        c.scale(1.03, 1.03); c.translate(-W * 0.015, -H * 0.015)
    fn(c, to)
    c.restore()
    pip(c, to)
    for ft in FLASH:
        u = (to - ft) / 0.22
        if 0 <= u < 1:
            c.drawRect(skia.Rect.MakeWH(W, H), P((255, 255, 255), a=int(200 * (1 - u))))
    if t < 0.35:
        c.drawRect(skia.Rect.MakeWH(W, H), P((0, 0, 0), a=int(255 * (1 - t / 0.35))))
    if t > TOTAL - 0.5:
        c.drawRect(skia.Rect.MakeWH(W, H), P((0, 0, 0), a=int(255 * min(1, (t - (TOTAL - 0.5)) / 0.5))))


# all sound cues in final (shifted) time
SFX_ALL = [(t + (DINS if t >= INS else 0), k, g) for t, k, g in SFX] + REC_SFX
