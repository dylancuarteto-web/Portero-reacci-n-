import skia, math, random
import numpy as np

W, H = 1080, 1920
FONT = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"
TF = skia.Typeface.MakeFromFile(FONT)


def C(r, g, b, a=255):
    return skia.Color(int(max(0, min(255, r))), int(max(0, min(255, g))), int(max(0, min(255, b))), int(max(0, min(255, a))))


def shade(col, k):
    return tuple(min(255, v * k) for v in col[:3])


OUTC = (24, 18, 38)
OW = 5.0


def P(col, stroke=None, blur=None, a=255, shader=None):
    p = skia.Paint(AntiAlias=True, Color=C(*col[:3], a))
    if stroke is not None:
        p.setStyle(skia.Paint.kStroke_Style)
        p.setStrokeWidth(stroke)
        p.setStrokeCap(skia.Paint.kRound_Cap)
        p.setStrokeJoin(skia.Paint.kRound_Join)
    if blur:
        p.setMaskFilter(skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, blur))
    if shader is not None:
        p.setShader(shader)
    return p


def poly(pts, closed=True):
    p = skia.Path()
    p.moveTo(*pts[0])
    for q in pts[1:]:
        p.lineTo(*q)
    if closed:
        p.close()
    return p


def smooth(pts):
    n = len(pts)
    mids = [((pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2) for i in range(n)]
    p = skia.Path()
    p.moveTo(*mids[-1])
    for i in range(n):
        p.quadTo(pts[i][0], pts[i][1], mids[i][0], mids[i][1])
    p.close()
    return p


def fo(c, path, col, ow=OW, a=255):
    c.drawPath(path, P(col, a=a))
    c.drawPath(path, P(OUTC, ow, a=a))


def seg(c, pts, w, col, ow=OW):
    path = poly(pts, closed=False)
    c.drawPath(path, P(OUTC, w + 2 * ow))
    c.drawPath(path, P(col, w))


def circ(c, x, y, r, col, ow=OW):
    c.drawCircle(x, y, r, P(col))
    c.drawCircle(x, y, r, P(OUTC, ow))


def lerp(a, b, u):
    return a + (b - a) * u


def ease(u):
    u = max(0.0, min(1.0, u))
    return u * u * (3 - 2 * u)


def text(c, s, x, y, size, col, outline=10, align="c", skew=0, outc=OUTC):
    f = skia.Font(TF, size)
    w = f.measureText(s)
    if align == "c":
        x -= w / 2
    c.save()
    if skew:
        c.translate(x + w / 2, y)
        c.skew(skew, 0)
        c.translate(-(x + w / 2), -y)
    if outline:
        c.drawString(s, x, y, f, P(outc, outline))
    c.drawString(s, x, y, f, P(col))
    c.restore()


# ---------------------------------------------------------------- poses
LT, NECK, HR, LU, LF, LTH, LSH = 120, 26, 46, 70, 66, 86, 86
POSES = {
    "idle": dict(lean=6, head=-4, fa1=40, fa2=85, ba1=25, ba2=100, ft1=22, ft2=-18, bt1=-18, bt2=-12),
    "stand": dict(lean=0, head=-4, fa1=12, fa2=12, ba1=-8, ba2=14, ft1=10, ft2=-4, bt1=-10, bt2=-2),
    "cross": dict(lean=-3, head=-8, fa1=18, fa2=-112, ba1=30, ba2=62, ft1=12, ft2=-2, bt1=-12, bt2=0),
    "punch": dict(lean=18, head=0, fa1=92, fa2=-2, ba1=8, ba2=120, ft1=30, ft2=-10, bt1=-35, bt2=-6),
    "punch2": dict(lean=20, head=0, fa1=20, fa2=110, ba1=94, ba2=-2, ft1=32, ft2=-12, bt1=-34, bt2=-6),
    "kick": dict(lean=-16, head=-4, fa1=60, fa2=80, ba1=-40, ba2=50, ft1=102, ft2=-4, bt1=-10, bt2=0),
    "dodge": dict(lean=-26, head=-10, fa1=30, fa2=40, ba1=-30, ba2=30, ft1=34, ft2=-40, bt1=-22, bt2=-34),
    "taunt": dict(lean=-5, head=-8, fa1=75, fa2=75, ba1=12, ba2=-60, ft1=12, ft2=-2, bt1=-12, bt2=0),
    "power": dict(lean=4, head=8, fa1=16, fa2=12, ba1=-16, ba2=-12, ft1=30, ft2=-16, bt1=-30, bt2=-10),
    "hurt": dict(lean=-32, head=-22, fa1=125, fa2=40, ba1=155, ba2=30, ft1=50, ft2=-50, bt1=18, bt2=-60),
    "dash": dict(lean=55, head=-30, fa1=75, fa2=60, ba1=20, ba2=90, ft1=-12, ft2=-40, bt1=-34, bt2=-28),
    "legblock": dict(lean=-6, head=-4, fa1=50, fa2=95, ba1=30, ba2=100, ft1=112, ft2=-96, bt1=-16, bt2=-52),
    "lowpunch": dict(lean=24, head=6, fa1=66, fa2=-2, ba1=8, ba2=120, ft1=30, ft2=-10, bt1=-35, bt2=-6),
    "lowpunch2": dict(lean=26, head=6, fa1=20, fa2=110, ba1=68, ba2=-2, ft1=32, ft2=-12, bt1=-34, bt2=-6),
    "block": dict(lean=6, head=4, fa1=48, fa2=125, ba1=30, ba2=100, ft1=26, ft2=-20, bt1=-24, bt2=-12),
    "raise": dict(lean=-6, head=-6, fa1=160, fa2=15, ba1=20, ba2=100, ft1=24, ft2=-14, bt1=-20, bt2=-10),
    "slash": dict(lean=22, head=4, fa1=70, fa2=-5, ba1=-10, ba2=60, ft1=36, ft2=-14, bt1=-34, bt2=-8),
    "laugh": dict(lean=-14, head=-18, fa1=40, fa2=100, ba1=30, ba2=100, ft1=16, ft2=-6, bt1=-16, bt2=-4),
    "point": dict(lean=4, head=-2, fa1=95, fa2=0, ba1=10, ba2=-60, ft1=18, ft2=-6, bt1=-18, bt2=-4),
    "flex": dict(lean=0, head=-6, fa1=95, fa2=100, ba1=-95, ba2=-100, ft1=16, ft2=-6, bt1=-16, bt2=-4),
}


INHERIT = ("form", "expr", "blade", "x", "sc", "alpha")


def inherit(kfs):
    acc, seq = {}, []
    for tm, d in kfs:
        nd = dict(acc); nd.update(d)
        acc = {k: nd[k] for k in INHERIT if k in nd}
        seq.append((tm, nd))
    return seq


def interp(kfs, t, base):
    kfs = inherit(kfs)

    def full(d):
        out = dict(base(d))
        out.update({k: v for k, v in d.items() if k != "p"})
        return out
    if t <= kfs[0][0]:
        return full(kfs[0][1])
    for (ta, da), (tb, db) in zip(kfs, kfs[1:]):
        if ta <= t < tb:
            A, B = full(da), full(db)
            u = ease((t - ta) / (tb - ta))
            o = {}
            for k in set(A) | set(B):
                va, vb = A.get(k, B.get(k)), B.get(k, A.get(k))
                if isinstance(va, (int, float)) and isinstance(vb, (int, float)) and not isinstance(va, bool):
                    o[k] = lerp(va, vb, u)
                else:
                    o[k] = va
            return o
    return full(kfs[-1][1])


def track(kfs, t):
    return interp(kfs, t, lambda d: dict(POSES[d.get("p", "idle")], air=0, alpha=1.0))


def d2(a):
    r = math.radians(a)
    return math.sin(r), math.cos(r)


# ---------------------------------------------------------------- character
STYLES = {
    "vegito": dict(skin=(252, 206, 168), top=(38, 72, 178), under=(246, 142, 40), pants=(34, 58, 160), sash=(90, 140, 220),
                   glove=(246, 246, 252), boot=(246, 246, 252), toe=(232, 182, 44), hair="blue", earring=True, eye=(40, 170, 220)),
    "gogeta": dict(skin=(250, 210, 176), top=(30, 34, 60), under=(30, 34, 60), trim=(206, 196, 70), pants=(244, 244, 248), sash=(60, 96, 200),
                   glove=(30, 30, 40), boot=(40, 40, 60), toe=(200, 40, 40), hair="blue", earring=False, eye=(40, 170, 220), wrist=(40, 40, 60)),
    "buu": dict(skin=(246, 152, 188), top=(246, 142, 40), under=(38, 72, 178), pants=(246, 246, 250), sash=(38, 72, 178),
                glove=(246, 152, 188), boot=(240, 200, 60), toe=(40, 40, 60), hair=None, earring=False, eye=(200, 30, 40), wrist=(30, 30, 40)),
    "zamasu": dict(skin=(128, 196, 112), top=(40, 38, 52), under=(40, 38, 52), pants=(56, 52, 70), sash=(196, 36, 52),
                   glove=(128, 196, 112), boot=(30, 30, 40), toe=(30, 30, 40), hair="white", earring=True, eye=(170, 170, 190)),
}


class Char:
    def __init__(self, kind):
        self.kind = kind
        self.st = dict(STYLES[kind])
        self.fat = kind == "buu"

    def joints(self, p):
        sx, sy = d2(p["lean"])
        sh = (sx * LT, -sy * LT)
        hx, hy = d2(p["lean"] + p["head"])
        hc = (sh[0] + hx * (NECK + HR * 0.75), sh[1] - hy * (NECK + HR * 0.75))
        J = {"sh": sh, "hc": hc}
        for s, off in (("f", 8), ("b", -10)):
            a1, a2 = p[s + "a1"], p[s + "a2"]
            o = (sh[0] + off * 0.6, sh[1] + 10)
            e = (o[0] + d2(a1)[0] * LU, o[1] + d2(a1)[1] * LU)
            h = (e[0] + d2(a1 + a2)[0] * LF, e[1] + d2(a1 + a2)[1] * LF)
            J[s + "arm"] = (o, e, h)
            t1, t2 = p[s + "t1"], p[s + "t2"]
            hip = (off * 0.9, 0)
            k = (hip[0] + d2(t1)[0] * LTH, hip[1] + d2(t1)[1] * LTH)
            f = (k[0] + d2(t1 + t2)[0] * LSH, k[1] + d2(t1 + t2)[1] * LSH)
            J[s + "leg"] = (hip, k, f)
        return J

    def foot_depth(self, p):
        J = self.joints(p)
        return max(J["fleg"][2][1], J["bleg"][2][1]) + 18

    # ---- parts
    def arm(self, c, pts, back, p):
        st = self.st
        k = 0.82 if back else 1.0
        o, e, h = pts
        wu = 46 if self.fat else 40
        if self.kind == "vegito" or self.kind == "gogeta":
            seg(c, [o, e], wu, shade(st["skin"], k))
            mid = (lerp(e[0], h[0], 0.15), lerp(e[1], h[1], 0.15))
            seg(c, [e, mid], 32, shade(st["skin"], k))
            seg(c, [mid, h], 36, shade(st["glove"], k))
        elif self.kind == "zamasu":
            seg(c, [o, e], 40, shade(st["top"], k))
            seg(c, [e, h], 34, shade(st["top"], k))
        else:
            seg(c, [o, e], wu, shade(st["top"] if self.fat else st["skin"], k))
            seg(c, [e, h], 38, shade(st["skin"], k))
        if "wrist" in st:
            wr = (lerp(e[0], h[0], 0.72), lerp(e[1], h[1], 0.72))
            seg(c, [wr, (lerp(e[0], h[0], 0.9), lerp(e[1], h[1], 0.9))], 40, shade(st["wrist"], k))
        hand = st["glove"] if self.kind in ("vegito", "gogeta") else st["skin"]
        circ(c, h[0], h[1], 24, shade(hand, k))

    def leg(self, c, pts, back):
        st = self.st
        k = 0.82 if back else 1.0
        hip, kn, f = pts
        an = (lerp(kn[0], f[0], 0.66), lerp(kn[1], f[1], 0.66))
        wp = 62 if self.fat else 54
        seg(c, [hip, kn], wp, shade(st["pants"], k))
        seg(c, [kn, an], wp - 4, shade(st["pants"], k))
        seg(c, [an, f], 38, shade(st["boot"], k))
        dx, dy = f[0] - kn[0], f[1] - kn[1]
        L = math.hypot(dx, dy) or 1
        nx, ny = -dy / L, dx / L  # perpendicular -> forward along +x roughly
        if nx < 0:
            nx, ny = -nx, -ny
        toe = (f[0] + nx * 22, f[1] + ny * 22)
        c.save()
        c.translate(*toe)
        c.rotate(math.degrees(math.atan2(ny, nx)))
        oval = skia.Path()
        oval.addOval(skia.Rect.MakeXYWH(-30, -15, 50, 30))
        fo(c, oval, shade(st["boot"], k))
        tip = skia.Path()
        tip.addOval(skia.Rect.MakeXYWH(4, -12, 18, 24))
        fo(c, tip, shade(st["toe"], k), 3)
        c.restore()

    def torso(self, c, p):
        st = self.st
        c.save()
        c.rotate(p["lean"])
        if self.fat:
            body = smooth([(-56, 8), (64, 8), (100, -54), (72, -LT + 6), (6, -LT - 8), (-56, -LT + 4), (-80, -50)])
            fo(c, body, st["top"])
            v = poly([(-10, -LT + 2), (34, -LT + 2), (14, -LT + 58)])
            fo(c, v, st["under"], 4)
            belly = smooth([(0, -8), (60, -10), (74, -50), (50, -70), (10, -60)])
            c.drawPath(belly, P(shade(st["top"], 1.1), a=120))
        else:
            body = smooth([(-34, 4), (40, 4), (74, -LT + 30), (64, -LT + 2), (10, -LT - 8), (-44, -LT + 0), (-62, -LT + 28)])
            fo(c, body, st["top"])
            if self.kind == "vegito":
                v = poly([(-8, -LT - 1), (30, -LT - 1), (12, -LT + 56)])
                fo(c, v, st["under"], 4)
                c.drawPath(poly([(-30, -LT + 26), (-8, -LT + 4), (-2, -LT + 40)], False), P(OUTC, 3))
            elif self.kind == "gogeta":
                v = poly([(-6, -LT - 1), (28, -LT - 1), (12, -LT + 64)])
                fo(c, v, st["skin"], 4)
                c.drawPath(poly([(-34, -LT + 2), (-48, -LT + 30)], False), P(st["trim"], 14))
                c.drawPath(poly([(50, -LT + 4), (58, -LT + 34)], False), P(st["trim"], 14))
                c.drawPath(poly([(12, -LT + 64), (-6, -LT - 1)], False), P(st["trim"], 8))
                c.drawPath(poly([(12, -LT + 64), (28, -LT - 1)], False), P(st["trim"], 8))
            elif self.kind == "zamasu":
                v = poly([(-4, -LT - 2), (26, -LT - 2), (10, -LT + 40)])
                fo(c, v, st["skin"], 4)
                c.drawPath(poly([(-30, -LT + 20), (10, -LT + 40), (44, -LT + 20)], False), P((90, 86, 110), 4))
        # neck
        c.restore()
        # sash
        c.save()
        c.rotate(p["lean"] * 0.5)
        band = skia.Path()
        ww = 64 if self.fat else 42
        band.addRoundRect(skia.Rect.MakeLTRB(-ww, -24, ww + 6, 6), 10, 10)
        fo(c, band, st["sash"], 4)
        tail = smooth([(ww - 6, -10), (ww + 18, -6), (ww + 26, 40), (ww + 12, 46), (ww + 2, 4)])
        fo(c, tail, shade(st["sash"], 0.9), 4)
        c.restore()

    def head(self, c, p, t):
        st = self.st
        expr = p.get("expr", "angry")
        k = self.kind
        # Zamasu halo
        if k == "zamasu":
            c.drawOval(skia.Rect.MakeXYWH(-70, -112, 120, 34), P((255, 220, 90), 9, blur=4, a=200))
            c.drawOval(skia.Rect.MakeXYWH(-70, -112, 120, 34), P((255, 240, 160), 5))
        # back hair
        if st["hair"] and k != "zamasu":
            self.hair(c, p, t)
        if k == "buu":
            self.antenna(c, t)
        # neck
        seg(c, [(-6, 40), (-10, 70)], 34, shade(st["skin"], 0.92))
        # ear (left side visible)
        if k == "zamasu":
            ear = poly([(-22, -2), (-74, -40), (-30, 22)])
            fo(c, ear, st["skin"])
        else:
            ear = skia.Path()
            ear.addOval(skia.Rect.MakeXYWH(-46, -12, 24, 34))
            fo(c, ear, st["skin"])
        face = smooth([(-38, -30), (0, -50), (40, -36), (50, 4), (40, 36), (14, 52), (-24, 44), (-42, 12)])
        fo(c, face, st["skin"])
        if k == "buu":
            for hx, hy in ((-20, -26), (-28, -10), (-30, 8)):
                c.drawCircle(hx, hy, 4, P(shade(st["skin"], 0.6)))
        if st["earring"]:
            ring = (230, 190, 40) if k != "zamasu" else (80, 200, 120)
            c.drawLine(-34, 22, -34, 34, P(OUTC, 3))
            circ(c, -34, 42, 9, ring, 3)
        # hair front (hairline) over forehead
        if st["hair"] == "white":
            self.zhair(c, t)
        elif st["hair"]:
            self.hair_front(c, p, t)
        # eyes
        angry = expr in ("angry", "shout", "smirk", "grin")
        for ex, s in ((10, 1.0), (36, 0.78)):
            eye = smooth([(ex - 12 * s, 0), (ex - 2 * s, -9 * s), (ex + 12 * s, -6 * s), (ex + 10 * s, 5 * s), (ex - 2 * s, 6 * s)])
            c.drawPath(eye, P((255, 255, 255) if k != "buu" else (30, 20, 30)))
            c.drawPath(eye, P(OUTC, 3))
            c.drawCircle(ex + 4 * s, -1, 5 * s, P(st["eye"]))
            c.drawCircle(ex + 5 * s, -1, 2 * s, P((10, 10, 20)))
        if expr == "hurt":
            c.drawPath(poly([(0, -16), (20, -12)], False), P(OUTC, 5))
        else:
            c.drawPath(poly([(-4, -20), (22, -9)], False), P(OUTC, 6))
            c.drawPath(poly([(28, -10), (46, -20)], False), P(OUTC, 5))
        # nose
        c.drawPath(poly([(44, 6), (49, 14), (42, 16)], False), P(OUTC, 3))
        # mouth
        if expr in ("smirk", "calm"):
            m = skia.Path(); m.moveTo(14, 32); m.quadTo(28, 36, 40, 26)
            c.drawPath(m, P(OUTC, 4))
        elif expr == "grin":
            m = smooth([(10, 26), (42, 22), (36, 38), (18, 38)])
            fo(c, m, (255, 255, 255), 3)
        elif expr in ("shout", "hurt"):
            m = smooth([(12, 26), (40, 22), (38, 46), (20, 48)])
            fo(c, m, (110, 20, 30), 3)
            c.drawOval(skia.Rect.MakeXYWH(18, 38, 16, 8), P((230, 90, 100)))
        else:
            c.drawPath(poly([(14, 32), (38, 30)], False), P(OUTC, 4))

    def hair(self, c, p, t):
        col = (255, 222, 60) if p.get("gold") else (70, 196, 240)
        if self.kind == "gogeta":
            spikes = [(-118, 70, 62), (-88, 112, 72), (-58, 138, 74), (-28, 150, 72), (2, 132, 66), (32, 96, 58)]
        else:
            spikes = [(-114, 66, 60), (-84, 108, 70), (-54, 136, 72), (-24, 146, 70), (6, 124, 64), (36, 88, 56)]
        ctr = (-4, -18)
        pts = []
        for i, (a, L, wd) in enumerate(spikes):
            sw = math.sin(t * 6 + i) * 4 + p.get("hairup", 0)
            ra = math.radians(a + sw)
            base = 46
            wa = math.degrees(wd / base) / 2
            for aa, rr in ((a - wa, base), (a + sw * 1.5, base + L), (a + wa, base)):
                r2 = math.radians(aa)
                pts.append((ctr[0] + math.sin(r2) * rr, ctr[1] - math.cos(r2) * rr))
        pts += [(44, -20), (-30, 10)]
        path = poly(pts)
        fo(c, path, col)
        hl = shade(col, 1.18)
        for i, (a, L, wd) in enumerate(spikes[1:-1]):
            r2 = math.radians(a)
            c.drawLine(ctr[0] + math.sin(r2) * 60, ctr[1] - math.cos(r2) * 60,
                       ctr[0] + math.sin(r2) * (40 + L * 0.7), ctr[1] - math.cos(r2) * (40 + L * 0.7), P(hl, 6))
        self.hcol = col

    def hair_front(self, c, p, t):
        col = getattr(self, "hcol", (70, 196, 240))
        bang = smooth([(-30, -40), (10, -52), (48, -38), (36, -24), (22, -12), (18, 14), (8, -14), (-6, -24), (-24, -20)])
        fo(c, bang, col)

    def zhair(self, c, t):
        col = (238, 238, 246)
        pts = [(-40, 0), (-58, -40), (-90, -70), (-40, -62), (-60, -110), (-10, -76), (-6, -126), (22, -80), (48, -104), (46, -56), (50, -34), (20, -42), (-20, -36)]
        sw = math.sin(t * 5) * 3
        pts = [(x - (sw if y < -60 else 0), y) for x, y in pts]
        fo(c, smooth(pts), col)

    def antenna(self, c, t):
        sw = math.sin(t * 3) * 10
        pth = skia.Path()
        pth.moveTo(-10, -44)
        pth.cubicTo(-30, -110, -100 + sw, -120, -110 + sw, -60)
        c.drawPath(pth, P(OUTC, 30))
        c.drawPath(pth, P(self.st["skin"], 20))
        circ(c, -110 + sw, -56, 13, self.st["skin"])

    def draw(self, c, x, gy, sc, p, t, face=1, air=0, alpha=1.0, shadow=True):
        p = dict(p)
        J = self.joints(p)
        depth = self.foot_depth(p)
        if shadow:
            sw = 120 * sc * max(0.3, 1 - air / 600)
            c.drawOval(skia.Rect.MakeXYWH(x - sw, gy - 14 * sc, 2 * sw, 28 * sc), P((0, 0, 0), a=int(70 * alpha)))
        if alpha < 1:
            c.saveLayerAlpha(None, int(255 * alpha))
        c.save()
        c.translate(x, gy - depth * sc - air)
        c.scale(sc * face, sc)
        self.arm(c, J["barm"], True, p)
        self.leg(c, J["bleg"], True)
        self.torso(c, p)
        self.leg(c, J["fleg"], False)
        c.save()
        c.translate(*J["hc"])
        c.rotate(p["lean"] + p["head"])
        self.head(c, p, t)
        c.restore()
        self.arm(c, J["farm"], False, p)
        # remember hand position in world coords
        hx, hy = J["farm"][2]
        self.hand = (x + hx * sc * face, gy - depth * sc - air + hy * sc)
        bx, by = J["barm"][2]
        self.bhand = (x + bx * sc * face, gy - depth * sc - air + by * sc)
        hcx, hcy = J["hc"]
        self.headpos = (x + hcx * sc * face, gy - depth * sc - air + hcy * sc)
        c.restore()
        if alpha < 1:
            c.restore()


# ---------------------------------------------------------------- effects
def aura(c, x, gy, sc, t, col, k=1.0, air=0):
    if k <= 0.01:
        return
    base = gy - air
    hgt = 600 * sc * k
    cy = base - hgt * 0.5
    for layer, (rx, ry, bl, a, kk) in enumerate(((250, 0.62, 40, 90, 1.0), (205, 0.56, 10, 120, 1.15), (150, 0.48, 4, 120, 1.45))):
        pts = []
        n = 36
        for i in range(n):
            ang = 2 * math.pi * i / n
            sx, sy = math.sin(ang), -math.cos(ang)
            r = 1.0
            if sy > -0.2:  # upper half: flame tongues
                r += (0.18 + 0.22 * sy) * (1 if i % 2 == 0 else -0.3) * (0.8 + 0.4 * math.sin(t * 9 + i * 1.9))
            px = x + sx * rx * sc * k ** 0.5
            py = cy + sy * (hgt * ry * r if sy < 0 else (hgt * 0.5 + 30 * sc))
            pts.append((px, py))
        c.drawPath(smooth(pts), P(shade(col, kk), blur=bl, a=int(a * min(1, k))))


def burst(c, x, y, r, t01, col=(255, 236, 90), word=None, rot=0):
    if t01 < 0 or t01 > 1:
        return
    s = 0.6 + 0.6 * ease(t01 * 3)
    a = 255 if t01 < 0.6 else int(255 * (1 - (t01 - 0.6) / 0.4))
    pts = []
    for i in range(24):
        ang = math.radians(i * 15 + rot)
        rr = r * s * (1.0 if i % 2 == 0 else 0.5) * (1 + 0.15 * math.sin(i * 7))
        pts.append((x + math.cos(ang) * rr, y + math.sin(ang) * rr))
    pth = poly(pts)
    c.drawPath(pth, P(col, a=a))
    c.drawPath(pth, P(OUTC, 6, a=a))
    inner = [(x + (px - x) * 0.55, y + (py - y) * 0.55) for px, py in pts]
    c.drawPath(poly(inner), P((255, 255, 255), a=a))
    if word:
        c.save()
        c.translate(x, y)
        c.rotate(-8)
        c.scale(s, s)
        text(c, word, 0, 26, 76, (230, 40, 40), 12)
        c.restore()


def speedlines(c, t, col=(255, 255, 255), a=120, horizontal=True, seed=1, cx=W / 2, cy=H / 2):
    rnd = random.Random(seed + int(t * 20))
    for i in range(40):
        ang = rnd.uniform(0, 2 * math.pi)
        r1 = rnd.uniform(420, 600)
        r2 = r1 + rnd.uniform(300, 700)
        c.drawLine(cx + math.cos(ang) * r1, cy + math.sin(ang) * r1, cx + math.cos(ang) * r2, cy + math.sin(ang) * r2,
                   P(col, rnd.uniform(3, 10), a=a))


def ring(c, x, y, t01, col=(255, 255, 255), rmax=420):
    if not 0 <= t01 <= 1:
        return
    r = rmax * ease(t01)
    a = int(220 * (1 - t01))
    c.drawOval(skia.Rect.MakeXYWH(x - r, y - r * 0.35, 2 * r, 0.7 * r), P(col, 18 * (1 - t01) + 2, a=a))


def sparks(c, x, y, t01, col=(255, 240, 150), n=14, seed=3, R=240):
    if not 0 <= t01 <= 1:
        return
    rnd = random.Random(seed)
    for i in range(n):
        ang = rnd.uniform(0, 2 * math.pi)
        sp = rnd.uniform(0.5, 1.0) * R
        r1 = sp * ease(t01)
        r2 = r1 + 60 * (1 - t01)
        c.drawLine(x + math.cos(ang) * r1, y + math.sin(ang) * r1, x + math.cos(ang) * r2, y + math.sin(ang) * r2,
                   P(col, 7 * (1 - t01) + 1, a=int(255 * (1 - t01))))


def kiball(c, x, y, r, col, t):
    c.drawCircle(x, y, r * 1.8, P(col, blur=r * 0.8, a=150))
    c.drawCircle(x, y, r, P(shade(col, 1.3), a=255))
    c.drawCircle(x, y, r * 0.55, P((255, 255, 255), a=255))


def dragonball(c, x, y, r, stars, t=0, glow=True):
    if glow:
        c.drawCircle(x, y, r * 1.5, P((255, 170, 60), blur=r * 0.5, a=110))
    sh = skia.GradientShader.MakeRadial((x - r * 0.35, y - r * 0.35), r * 1.4, [C(255, 214, 120), C(246, 140, 30), C(200, 90, 10)])
    c.drawCircle(x, y, r, P((255, 160, 40), shader=sh))
    c.drawCircle(x, y, r, P(OUTC, max(2, r * 0.07)))
    pos = {1: [(0, 0)], 2: [(-.3, 0), (.3, 0)], 3: [(-.3, .2), (.3, .2), (0, -.3)], 4: [(-.3, -.3), (.3, -.3), (-.3, .3), (.3, .3)],
           5: [(-.35, -.3), (.35, -.3), (0, 0), (-.35, .3), (.35, .3)], 6: [(-.3, -.38), (.3, -.38), (-.38, 0), (.38, 0), (-.3, .38), (.3, .38)],
           7: [(0, 0), (-.3, -.38), (.3, -.38), (-.42, 0), (.42, 0), (-.3, .38), (.3, .38)]}[stars]
    for sx, sy in pos:
        star(c, x + sx * r, y + sy * r, r * 0.18, (215, 30, 30))
    c.drawOval(skia.Rect.MakeXYWH(x - r * 0.6, y - r * 0.75, r * 0.5, r * 0.3), P((255, 255, 255), a=170))


def star(c, x, y, r, col):
    pts = []
    for i in range(10):
        ang = math.radians(-90 + i * 36)
        rr = r if i % 2 == 0 else r * 0.45
        pts.append((x + math.cos(ang) * rr, y + math.sin(ang) * rr))
    c.drawPath(poly(pts), P(col))


def candy(c, x, y, s, t):
    c.save()
    c.translate(x, y)
    c.rotate(math.sin(t * 8) * 6)
    c.scale(s, s)
    for d in (-1, 1):
        wrap = poly([(d * 60, 0), (d * 120, -40), (d * 110, 0), (d * 120, 40)])
        fo(c, wrap, (250, 250, 255))
        c.drawLine(d * 85, -20, d * 85, 20, P((230, 120, 200), 6))
    body = skia.Path()
    body.addOval(skia.Rect.MakeXYWH(-70, -52, 140, 104))
    sh = skia.GradientShader.MakeRadial((-20, -20), 110, [C(255, 210, 140), C(220, 130, 50), C(150, 80, 30)])
    c.drawPath(body, P((200, 120, 50), shader=sh))
    c.drawPath(body, P(OUTC, 6))
    c.drawOval(skia.Rect.MakeXYWH(-46, -38, 40, 18), P((255, 255, 255), a=190))
    # little angry face (Vegito inside)
    c.drawPath(poly([(-28, -10), (-10, -2)], False), P(OUTC, 5))
    c.drawPath(poly([(28, -10), (10, -2)], False), P(OUTC, 5))
    c.drawCircle(-16, 6, 5, P(OUTC))
    c.drawCircle(16, 6, 5, P(OUTC))
    m = skia.Path(); m.moveTo(-12, 26); m.quadTo(0, 32, 14, 22)
    c.drawPath(m, P(OUTC, 4))
    c.restore()


def beam(c, x0, y0, x1, y1, t, col=(255, 120, 200), w=26):
    pth = skia.Path()
    pth.moveTo(x0, y0)
    n = 14
    for i in range(1, n + 1):
        u = i / n
        off = math.sin(u * 20 + t * 40) * 14 * (1 if i < n else 0)
        pth.lineTo(lerp(x0, x1, u), lerp(y0, y1, u) + off)
    c.drawPath(pth, P(col, w * 2.2, blur=10, a=150))
    c.drawPath(pth, P(col, w))
    c.drawPath(pth, P((255, 255, 255), w * 0.4))


def steam(c, x, y, t, seed=0):
    for i in range(3):
        u = ((t * 1.6 + i / 3) % 1)
        px = x + (i - 1) * 40 + math.sin(u * 6 + i) * 10
        py = y - u * 120
        r = 16 + u * 22
        c.drawCircle(px, py, r, P((255, 255, 255), a=int(220 * (1 - u))))
        c.drawCircle(px, py, r, P(OUTC, 3, a=int(200 * (1 - u))))


def lightning(c, x0, y0, x1, y1, t, col=(140, 220, 255), seed=0):
    rnd = random.Random(seed + int(t * 24))
    pts = [(x0, y0)]
    n = 9
    for i in range(1, n):
        u = i / n
        pts.append((lerp(x0, x1, u) + rnd.uniform(-35, 35), lerp(y0, y1, u) + rnd.uniform(-35, 35)))
    pts.append((x1, y1))
    pth = poly(pts, False)
    c.drawPath(pth, P(col, 16, blur=8, a=160))
    c.drawPath(pth, P((255, 255, 255), 4))


# ---------------------------------------------------------------- backgrounds
def cloud(c, x, y, s, col=(255, 255, 255), shadowc=(200, 220, 245), a=255):
    for dx, dy, r in ((0, 0, 60), (60, -20, 70), (130, 0, 55), (70, 20, 60), (-50, 15, 45)):
        c.drawCircle(x + dx * s, y + (dy + 10) * s, r * s, P(shadowc, a=a))
    for dx, dy, r in ((0, 0, 60), (60, -20, 70), (130, 0, 55), (70, 20, 60), (-50, 15, 45)):
        c.drawCircle(x + dx * s, y + dy * s, r * s * 0.95, P(col, a=a))


def lin(c, rect, cols, y0, y1):
    sh = skia.GradientShader.MakeLinear([(0, y0), (0, y1)], [C(*k) for k in cols])
    c.drawRect(rect, P((0, 0, 0), shader=sh))


GROUND = 1360


def bg_sky(c, t):
    lin(c, skia.Rect.MakeWH(W, H), [(56, 140, 236), (120, 196, 250), (200, 236, 255)], 0, 1500)
    c.drawCircle(860, 520, 140, P((255, 255, 220), blur=60, a=200))
    c.drawCircle(860, 520, 80, P((255, 255, 235)))
    for i, (x, y, s) in enumerate(((100, 700, 1.0), (700, 900, 1.3), (300, 1150, 0.9), (900, 1300, 1.1), (-80, 1500, 1.4), (600, 1600, 1.2))):
        xx = (x + t * 25 * (0.5 + 0.2 * i)) % (W + 400) - 200
        cloud(c, xx, y, s)
    # distant ground hills
    pth = smooth([(-200, 1700), (200, 1560), (600, 1640), (1000, 1540), (1400, 1700), (1400, 2100), (-200, 2100)])
    c.drawPath(pth, P((120, 190, 110)))
    c.drawPath(pth, P(OUTC, 5))
    pth2 = smooth([(-200, 1800), (300, 1720), (800, 1790), (1300, 1720), (1400, 2100), (-200, 2100)])
    c.drawPath(pth2, P((88, 160, 86)))
    c.drawPath(pth2, P(OUTC, 5))


def mesa(c, x, base, w, h, col, dark):
    top = base - h
    body = poly([(x - w * 0.5, base), (x - w * 0.42, top + 20), (x - w * 0.34, top), (x + w * 0.36, top), (x + w * 0.44, top + 26), (x + w * 0.5, base)])
    fo(c, body, col, 5)
    c.drawPath(poly([(x + w * 0.1, top), (x + w * 0.36, top), (x + w * 0.44, top + 26), (x + w * 0.5, base), (x + w * 0.18, base)]), P(dark))
    c.drawPath(body, P(OUTC, 5))
    for k in range(3):
        yy = top + (k + 1) * h / 4
        c.drawLine(x - w * 0.4, yy, x + w * 0.42, yy + 6, P(dark, 4))


def bg_waste(c, t):
    lin(c, skia.Rect.MakeWH(W, GROUND), [(250, 150, 90), (255, 196, 120), (255, 228, 170)], 0, GROUND)
    c.drawCircle(220, 640, 120, P((255, 250, 210), blur=50, a=200))
    c.drawCircle(220, 640, 70, P((255, 246, 210)))
    for i, (x, y, s) in enumerate(((600, 520, 0.9), (100, 850, 0.7), (850, 760, 1.0))):
        cloud(c, (x + t * 12) % (W + 300) - 150, y, s, (255, 236, 210), (240, 180, 140))
    for x, w, h in ((80, 260, 380), (420, 200, 300), (760, 320, 460), (1050, 220, 330)):
        mesa(c, x, GROUND - 40, w, h, (196, 130, 120), (170, 100, 100))
    for x, w, h in ((-20, 300, 260), (300, 220, 180), (980, 300, 240)):
        mesa(c, x, GROUND + 10, w, h, (214, 146, 96), (186, 116, 72))
    lin(c, skia.Rect.MakeXYWH(0, GROUND, W, H - GROUND), [(226, 176, 116), (200, 146, 92)], GROUND, H)
    c.drawLine(0, GROUND, W, GROUND, P(OUTC, 6))
    rnd = random.Random(5)
    for i in range(16):
        x = rnd.uniform(0, W); y = rnd.uniform(GROUND + 60, H - 40); s = rnd.uniform(0.5, 1.4)
        rock = smooth([(x - 30 * s, y), (x - 20 * s, y - 22 * s), (x + 10 * s, y - 28 * s), (x + 32 * s, y - 6 * s), (x + 26 * s, y + 4 * s)])
        fo(c, rock, (178, 128, 84), 4)
    for i in range(6):
        x = rnd.uniform(50, W - 50); y = rnd.uniform(GROUND + 100, H - 100)
        c.drawPath(poly([(x, y), (x + 40, y + 20), (x + 70, y + 10), (x + 110, y + 34)], False), P((150, 100, 64), 4))


def bg_dark(c, t):
    lin(c, skia.Rect.MakeWH(W, GROUND), [(30, 14, 50), (90, 30, 80), (210, 70, 70)], 0, GROUND)
    for i in range(5):
        x = (i * 260 + t * 8) % (W + 300) - 150
        cloud(c, x, 300 + (i % 2) * 220, 1.4, (80, 40, 90), (50, 24, 60), 200)
    c.drawCircle(540, 1100, 360, P((255, 120, 90), blur=120, a=120))
    for x, h in ((60, 520), (200, 380), (880, 600), (1010, 420)):
        sp = poly([(x - 60, GROUND), (x - 30, GROUND - h), (x, GROUND - h - 60), (x + 30, GROUND - h), (x + 60, GROUND)])
        fo(c, sp, (60, 30, 66), 5)
    for i, (x, y, s) in enumerate(((180, 780, 1.0), (900, 880, 0.8), (520, 640, 0.6))):
        yy = y + math.sin(t * 1.5 + i) * 18
        rock = smooth([(x - 70 * s, yy), (x - 40 * s, yy - 40 * s), (x + 50 * s, yy - 36 * s), (x + 70 * s, yy + 6 * s), (x, yy + 60 * s)])
        fo(c, rock, (96, 66, 96), 5)
    lin(c, skia.Rect.MakeXYWH(0, GROUND, W, H - GROUND), [(80, 52, 78), (46, 30, 50)], GROUND, H)
    c.drawLine(0, GROUND, W, GROUND, P(OUTC, 6))
    rnd = random.Random(9)
    for i in range(9):
        x = rnd.uniform(0, W); y = rnd.uniform(GROUND + 40, H - 60)
        pts = [(x, y)]
        for k in range(5):
            x += rnd.uniform(30, 70); y += rnd.uniform(-20, 20); pts.append((x, y))
        c.drawPath(poly(pts, False), P((255, 110, 80), 8, blur=6, a=150))
        c.drawPath(poly(pts, False), P((30, 16, 30), 4))


def bg_split(c, t):
    lin(c, skia.Rect.MakeXYWH(0, 0, W / 2, GROUND), [(40, 90, 210), (110, 180, 250)], 0, GROUND)
    lin(c, skia.Rect.MakeXYWH(W / 2, 0, W / 2, GROUND), [(220, 90, 40), (255, 190, 90)], 0, GROUND)
    for i in range(30):
        ang = math.radians(i * 12 + t * 10)
        c.drawLine(W / 2, 760, W / 2 + math.cos(ang) * 1600, 760 + math.sin(ang) * 1600, P((255, 255, 255), 30, a=22))
    lin(c, skia.Rect.MakeXYWH(0, GROUND, W, H - GROUND), [(176, 186, 200), (120, 128, 146)], GROUND, H)
    for i in range(7):
        y = GROUND + 40 + i * i * 14
        c.drawLine(0, y, W, y, P((100, 108, 126), 3))
    for i in range(-6, 7):
        c.drawLine(W / 2 + i * 60, GROUND, W / 2 + i * 300, H, P((100, 108, 126), 3))
    c.drawLine(0, GROUND, W, GROUND, P(OUTC, 6))


BGS = {"sky": bg_sky, "waste": bg_waste, "dark": bg_dark, "split": bg_split}
