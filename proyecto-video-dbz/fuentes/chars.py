from engine import *

# --------------------------------------------------------------- hair system
HAIRCOL = {
    "black": ((44, 42, 60), (20, 18, 30), (110, 110, 150)),
    "gold": ((255, 214, 64), (226, 150, 24), (255, 250, 190)),
    "blue": ((64, 186, 240), (26, 112, 200), (190, 240, 255)),
    "white": ((236, 238, 246), (160, 166, 196), (255, 255, 255)),
}


def hair_path(ctr, R, spikes, t, sway=1.0, grow=1.0, crown=None):
    ob = skia.OpBuilder()
    cx, cy = ctr
    info = []
    if crown:
        ob.add(smooth(crown), skia.PathOp.kUnion_PathOp)
    for i, (a, L, wdt, bend) in enumerate(spikes):
        L = L * grow
        sw = math.sin(t * 5.5 + i * 1.3) * 2.5 * sway
        a2 = math.radians(a + sw)
        d = (math.sin(a2), -math.cos(a2)); n = (math.cos(a2), math.sin(a2))
        hw = wdt / 2
        B = (cx + d[0] * R * 0.5, cy + d[1] * R * 0.5)
        bl = (B[0] - n[0] * hw, B[1] - n[1] * hw); br = (B[0] + n[0] * hw, B[1] + n[1] * hw)
        ta = math.radians(a + bend + sw * 1.6)
        dT = (math.sin(ta), -math.cos(ta)); nT = (math.cos(ta), math.sin(ta))
        T = (cx + dT[0] * (R + L), cy + dT[1] * (R + L))
        ma = math.radians(a + bend * 0.5 + sw)
        dm = (math.sin(ma), -math.cos(ma)); nm = (math.cos(ma), math.sin(ma))
        M = (cx + dm[0] * (R * 0.5 + (R * 0.5 + L) * 0.5), cy + dm[1] * (R * 0.5 + (R * 0.5 + L) * 0.5))
        cl = (M[0] - nm[0] * hw * 0.95, M[1] - nm[1] * hw * 0.95); cr = (M[0] + nm[0] * hw * 0.95, M[1] + nm[1] * hw * 0.95)
        tl = (T[0] - nT[0] * hw * 0.2 - dT[0] * 12, T[1] - nT[1] * hw * 0.2 - dT[1] * 12)
        tr = (T[0] + nT[0] * hw * 0.2 - dT[0] * 12, T[1] + nT[1] * hw * 0.2 - dT[1] * 12)
        sp = skia.Path()
        sp.moveTo(*bl); sp.quadTo(*cl, *tl); sp.quadTo(T[0] + dT[0] * 6, T[1] + dT[1] * 6, *tr); sp.quadTo(*cr, *br); sp.close()
        ob.add(sp, skia.PathOp.kUnion_PathOp)
        info.append((bl, br, T, M, wdt))
    return ob.resolve(), info


def draw_hair(c, path, info, colname, ctr, R):
    base, dark, hl = HAIRCOL[colname]
    c.drawPath(path, P(base))
    c.save()
    c.clipPath(path, skia.ClipOp.kIntersect, True)
    sh = skia.GradientShader.MakeRadial((ctr[0] - R * 0.2, ctr[1] - R * 1.4), R * 3.4, [C(*hl, 110), C(*base, 0), C(*dark, 170)], [0, 0.45, 1.0])
    c.drawPaint(P(base, shader=sh))
    for bl, br, tip, mid, wdt in info:
        # shadow on the right half of each spike (outer part only), soft highlight on the left
        rx, ry = (br[0] - bl[0]) / wdt, (br[1] - bl[1]) / wdt
        s0 = (mid[0] + rx * wdt * 0.28, mid[1] + ry * wdt * 0.28)
        pr = skia.Path(); pr.moveTo(lerp(s0[0], bl[0], 0.25), lerp(s0[1], bl[1], 0.25)); pr.quadTo(s0[0], s0[1], lerp(tip[0], s0[0], 0.12), lerp(tip[1], s0[1], 0.12))
        c.drawPath(pr, P(dark, wdt * 0.34, a=120, blur=3))
        h0 = (mid[0] - rx * wdt * 0.18, mid[1] - ry * wdt * 0.18)
        pl = skia.Path(); pl.moveTo(*h0); pl.lineTo(lerp(h0[0], tip[0], 0.55), lerp(h0[1], tip[1], 0.55))
        c.drawPath(pl, P(hl, wdt * 0.1, a=210))
    # darker band near the hairline for volume
    c.drawCircle(ctr[0], ctr[1] + R * 0.6, R * 1.0, P(dark, blur=R * 0.4, a=110))
    c.restore()
    c.drawPath(path, P(OUTC, OW))


def lock(c, pts, wdt, colname, t=0):
    """A single curved strand (bang) from root to tip."""
    base, dark, hl = HAIRCOL[colname]
    (x0, y0), (x1, y1), (x2, y2) = pts
    p = skia.Path()
    p.moveTo(x0 - wdt / 2, y0)
    p.quadTo(x1 - wdt * 0.35, y1, x2, y2)
    p.quadTo(x1 + wdt * 0.35, y1, x0 + wdt / 2, y0)
    p.close()
    c.drawPath(p, P(base))
    c.save(); c.clipPath(p, skia.ClipOp.kIntersect, True)
    q = skia.Path(); q.moveTo(x0 + wdt * 0.3, y0); q.quadTo(x1 + wdt * 0.3, y1, x2, y2)
    c.drawPath(q, P(dark, wdt * 0.35, a=160))
    q2 = skia.Path(); q2.moveTo(x0 - wdt * 0.2, y0); q2.quadTo(x1 - wdt * 0.2, y1, lerp(x1, x2, 0.6), lerp(y1, y2, 0.6))
    c.drawPath(q2, P(hl, wdt * 0.15, a=170))
    c.restore()
    c.drawPath(p, P(OUTC, OW))


# spike sets: (angle, length, width, bend)
SIDE_SPIKES = {
    "vegito_up": [(-122, 60, 80, -18), (-94, 96, 88, -16), (-64, 118, 92, -10), (-36, 128, 92, -6), (-8, 118, 88, 2), (20, 92, 80, 10), (46, 60, 70, 16)],
    "vegito_base": [(-112, 46, 78, -18), (-84, 74, 84, -12), (-54, 96, 88, -6), (-24, 108, 88, -2), (6, 98, 84, 4), (34, 70, 76, 10)],
    "gogeta_up": [(-124, 66, 80, -20), (-96, 100, 88, -16), (-66, 122, 92, -10), (-38, 130, 92, -6), (-10, 120, 88, 2), (18, 96, 80, 8), (44, 66, 70, 14)],
    "gogeta_base": [(-140, 64, 76, -28), (-112, 80, 82, -22), (-82, 88, 86, -12), (-52, 90, 86, -6), (-22, 84, 84, 0), (8, 70, 78, 8), (36, 52, 70, 18)],
    "zamasu": [(-130, 78, 74, -30), (-104, 104, 80, -28), (-78, 118, 84, -24), (-50, 114, 82, -18), (-22, 96, 78, -12), (4, 70, 70, -6)],
}
CROWN_SIDE = [(-50, 18), (-54, -30), (-14, -62), (38, -50), (52, -22), (22, -34), (-16, -28), (-38, 2)]
FRONT_SPIKES = {
    "vegito_up": [(-100, 56, 76, -16), (-72, 92, 84, -12), (-44, 118, 88, -8), (-15, 130, 90, -3), (15, 128, 90, 3), (44, 116, 88, 8), (72, 92, 84, 12), (100, 56, 76, 16)],
    "vegito_base": [(-74, 54, 80, -10), (-46, 88, 86, -6), (-16, 110, 90, -2), (16, 108, 90, 2), (46, 86, 86, 6), (74, 52, 80, 10)],
    "gogeta_up": [(-104, 60, 76, -18), (-76, 96, 84, -14), (-46, 122, 88, -8), (-16, 134, 90, -3), (14, 130, 90, 3), (44, 118, 88, 8), (74, 94, 84, 14), (104, 60, 76, 18)],
    "gogeta_base": [(-112, 44, 70, -26), (-86, 66, 78, -18), (-56, 86, 84, -10), (-24, 92, 84, -4), (8, 90, 84, 4), (40, 84, 84, 10), (72, 66, 78, 18), (100, 44, 70, 26)],
}
CROWN_FRONT = [(-54, 4), (-52, -40), (0, -66), (52, -40), (54, 4), (34, -24), (0, -32), (-34, -24)]


# --------------------------------------------------------------- styles
STY = {
    "vegito": dict(skin=(252, 206, 168), top=(38, 72, 178), under=(246, 142, 40), pants=(34, 58, 160), sash=(96, 146, 226),
                   glove=(248, 248, 252), boot=(248, 248, 252), toe=(232, 182, 44), earring=(236, 196, 50), eye=(40, 170, 220), gloves=True),
    "gogeta": dict(skin=(250, 210, 176), top=(222, 200, 58), under=(30, 34, 62), trim=(32, 36, 70), pants=(246, 246, 250), sash=(60, 96, 206),
                   glove=(250, 210, 176), boot=(36, 38, 64), toe=(200, 40, 40), earring=None, eye=(40, 170, 220), wrist=(30, 30, 46), gloves=False),
    "buu": dict(skin=(246, 152, 188), top=(246, 142, 40), under=(38, 72, 178), pants=(248, 248, 252), sash=(38, 72, 178),
                glove=(246, 152, 188), boot=(240, 200, 60), toe=(40, 40, 60), earring=None, eye=(200, 30, 40), wrist=(30, 30, 46), gloves=False),
    "zamasu": dict(skin=(124, 194, 112), top=(48, 44, 66), under=(36, 32, 50), pants=(30, 28, 40), sash=(200, 36, 52),
                   glove=(124, 194, 112), boot=(240, 240, 246), toe=(196, 36, 52), earring=(110, 210, 130), eye=(200, 40, 60), gloves=False, sleeve=True),
}


def cel(c, path, rot_dark_side=1, k=0.78, col=None):
    """darken one side of a filled path (simple cel shading)."""
    c.save()
    c.clipPath(path, skia.ClipOp.kIntersect, True)
    b = path.getBounds()
    x0 = b.left() if rot_dark_side < 0 else b.right() - b.width() * 0.32
    c.drawRect(skia.Rect.MakeXYWH(x0, b.top() - 10, b.width() * 0.32, b.height() + 20), P((10, 0, 40), a=int(255 * (1 - k))))
    c.restore()


class Char:
    def __init__(self, kind):
        self.kind = kind
        self.st = STY[kind]
        self.fat = False
        self.hand = self.headpos = (0, 0)

    def hairset(self, p, view):
        if self.kind == "zamasu":
            return "zamasu", "white"
        form = p.get("form", "blue")
        nm = self.kind + ("_base" if form == "base" else "_up")
        return nm, {"base": "black", "gold": "gold", "blue": "blue"}[form]

    # ============================================================ SIDE VIEW
    def joints(self, p):
        sx, sy = d2(p["lean"])
        sh = (sx * LT, -sy * LT)
        hx, hy = d2(p["lean"] + p["head"])
        hc = (sh[0] + hx * (NECK + HR * 0.75), sh[1] - hy * (NECK + HR * 0.75))
        J = {"sh": sh, "hc": hc}
        for s, off in (("f", 8), ("b", -10)):
            a1, a2 = p[s + "a1"], p[s + "a2"]
            rc = p.get("reach", 1.0) if s == "f" else 1.0
            o = (sh[0] + off * 0.6, sh[1] + 10)
            e = (o[0] + d2(a1)[0] * LU * rc, o[1] + d2(a1)[1] * LU * rc)
            h = (e[0] + d2(a1 + a2)[0] * LF * rc, e[1] + d2(a1 + a2)[1] * LF * rc)
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

    def arm(self, c, pts, back, p):
        st = self.st
        k = 0.8 if back else 1.0
        o, e, h = pts
        if st.get("sleeve"):
            seg(c, [o, e], 42, shade(st["top"], k))
            seg(c, [e, h], 36, shade(st["top"], k))
        elif self.fat:
            seg(c, [o, e], 48, shade(st["top"], k))
            seg(c, [e, h], 40, shade(st["skin"], k))
        else:
            seg(c, [o, e], 42, shade(st["skin"], k))
            if st["gloves"]:
                mid = (lerp(e[0], h[0], 0.18), lerp(e[1], h[1], 0.18))
                seg(c, [e, mid], 34, shade(st["skin"], k))
                seg(c, [mid, h], 38, shade(st["glove"], k))
            else:
                seg(c, [e, h], 36, shade(st["skin"], k))
        if "wrist" in st:
            seg(c, [(lerp(e[0], h[0], 0.66), lerp(e[1], h[1], 0.66)), (lerp(e[0], h[0], 0.86), lerp(e[1], h[1], 0.86))], 42, shade(st["wrist"], k))
        circ(c, h[0], h[1], 25, shade(st["glove"], k))
        c.drawArc(skia.Rect.MakeXYWH(h[0] - 14, h[1] - 14, 28, 28), 200, 120, False, P(OUTC, 3))

    def leg(self, c, pts, back):
        st = self.st
        k = 0.8 if back else 1.0
        hip, kn, f = pts
        an = (lerp(kn[0], f[0], 0.64), lerp(kn[1], f[1], 0.64))
        wp = 64 if self.fat else 56
        seg(c, [hip, kn], wp, shade(st["pants"], k))
        seg(c, [kn, an], wp - 6, shade(st["pants"], k))
        seg(c, [an, f], 40, shade(st["boot"], k))
        dx, dy = f[0] - kn[0], f[1] - kn[1]
        L = math.hypot(dx, dy) or 1
        nx, ny = -dy / L, dx / L
        if nx < 0:
            nx, ny = -nx, -ny
        toe = (f[0] + nx * 22, f[1] + ny * 22)
        c.save(); c.translate(*toe); c.rotate(math.degrees(math.atan2(ny, nx)))
        oval = skia.Path(); oval.addOval(skia.Rect.MakeXYWH(-32, -16, 54, 32))
        fo(c, oval, shade(st["boot"], k))
        tip = skia.Path(); tip.addOval(skia.Rect.MakeXYWH(4, -13, 20, 26))
        fo(c, tip, shade(st["toe"], k), 3)
        c.restore()

    def torso(self, c, p):
        st = self.st
        c.save(); c.rotate(p["lean"])
        if self.fat:
            body = smooth([(-56, 8), (64, 8), (100, -54), (72, -LT + 6), (6, -LT - 8), (-56, -LT + 4), (-80, -50)])
            fo(c, body, st["top"]); cel(c, body, -1)
            fo(c, poly([(-10, -LT + 2), (34, -LT + 2), (14, -LT + 58)]), st["under"], 4)
        else:
            body = smooth([(-34, 4), (40, 4), (74, -LT + 30), (64, -LT + 2), (10, -LT - 8), (-44, -LT + 0), (-62, -LT + 28)])
            fo(c, body, st["top"]); cel(c, body, -1)
            if self.kind in ("vegito", "buu"):
                fo(c, poly([(-8, -LT - 1), (32, -LT - 1), (14, -LT + 58)]), st["under"], 4)
            elif self.kind == "gogeta":
                fo(c, poly([(-6, -LT - 1), (30, -LT - 1), (12, -LT + 66)]), st["skin"], 4)
                c.drawPath(poly([(12, -LT + 66), (-6, -LT - 1)], False), P(st["trim"], 9))
                c.drawPath(poly([(12, -LT + 66), (30, -LT - 1)], False), P(st["trim"], 9))
                c.drawPath(poly([(-44, -LT + 2), (-62, -LT + 28)], False), P(st["trim"], 14))
            elif self.kind == "zamasu":
                fo(c, poly([(-10, -LT - 4), (34, -LT - 4), (12, -LT + 34)]), st["under"], 4)
                # grey kai collar / shoulder piece
                col = smooth([(-46, -LT + 4), (8, -LT - 12), (64, -LT + 2), (60, -LT + 26), (8, -LT + 12), (-50, -LT + 26)])
                fo(c, col, (150, 146, 176), 4)
            c.drawPath(poly([(6, -LT + 46), (30, -LT + 40), (52, -LT + 50)], False), P(OUTC, 3))
        c.restore()
        c.save(); c.rotate(p["lean"] * 0.5)
        ww = 66 if self.fat else 46
        band = skia.Path(); band.addRoundRect(skia.Rect.MakeLTRB(-ww, -26, ww + 6, 6), 10, 10)
        fo(c, band, st["sash"], 4)
        tail = smooth([(ww - 8, -10), (ww + 18, -6), (ww + 28, 44), (ww + 12, 50), (ww + 2, 4)])
        fo(c, tail, shade(st["sash"], 0.88), 4)
        c.restore()

    def face_side(self, c, p, t):
        st = self.st
        expr = p.get("expr", "angry")
        k = self.kind
        seg(c, [(-6, 40), (-10, 72)], 38, shade(st["skin"], 0.9))
        if k == "zamasu":
            ear = smooth([(-24, -6), (-60, -26), (-86, -52), (-56, -6), (-30, 24)])
            fo(c, ear, st["skin"])
        else:
            ear = skia.Path(); ear.addOval(skia.Rect.MakeXYWH(-48, -12, 26, 36)); fo(c, ear, st["skin"])
        face = smooth([(-38, -30), (0, -50), (40, -36), (52, 4), (44, 34), (16, 54), (-24, 46), (-42, 12)])
        fo(c, face, st["skin"]); cel(c, face, -1, 0.85)
        if k == "buu":
            for hx, hy in ((-20, -26), (-28, -10), (-30, 8)):
                c.drawCircle(hx, hy, 4, P(shade(st["skin"], 0.6)))
        if st["earring"]:
            c.drawLine(-36, 22, -36, 34, P(OUTC, 3))
            circ(c, -36, 42, 9, st["earring"], 3)
        return face

    def eyes_side(self, c, p):
        st = self.st
        expr = p.get("expr", "angry")
        dark = self.kind == "buu"
        for ex, s in ((12, 1.0), (38, 0.76)):
            eye = smooth([(ex - 12 * s, 0), (ex - 2 * s, -9 * s), (ex + 12 * s, -7 * s), (ex + 10 * s, 5 * s), (ex - 2 * s, 6 * s)])
            c.drawPath(eye, P((30, 20, 30) if dark else (255, 255, 255)))
            c.drawPath(eye, P(OUTC, 3))
            c.drawCircle(ex + 4 * s, -1, 5.5 * s, P(st["eye"]))
            c.drawCircle(ex + 5 * s, -1, 2.2 * s, P((10, 10, 20)))
            c.drawCircle(ex + 2 * s, -3, 1.6 * s, P((255, 255, 255)))
        if expr == "hurt":
            c.drawPath(poly([(0, -16), (22, -12)], False), P(OUTC, 5))
        else:
            c.drawPath(poly([(-4, -20), (24, -9)], False), P(OUTC, 7))
            c.drawPath(poly([(30, -10), (48, -20)], False), P(OUTC, 5))
        c.drawPath(poly([(46, 6), (52, 14), (44, 16)], False), P(OUTC, 3))
        self.mouth(c, expr, 26, 32)

    def mouth(self, c, expr, mx, my):
        if expr in ("smirk", "calm"):
            m = skia.Path(); m.moveTo(mx - 12, my); m.quadTo(mx + 2, my + 5, mx + 14, my - 6); c.drawPath(m, P(OUTC, 4))
        elif expr == "grin":
            m = smooth([(mx - 16, my - 6), (mx + 16, my - 10), (mx + 12, my + 6), (mx - 8, my + 7)])
            fo(c, m, (255, 255, 255), 3)
            c.drawLine(mx - 14, my - 2, mx + 14, my - 4, P(OUTC, 2))
        elif expr in ("shout", "hurt"):
            m = smooth([(mx - 14, my - 6), (mx + 14, my - 10), (mx + 12, my + 14), (mx - 6, my + 16)])
            fo(c, m, (110, 20, 30), 3)
            c.drawOval(skia.Rect.MakeXYWH(mx - 8, my + 6, 16, 8), P((230, 90, 100)))
            c.drawRect(skia.Rect.MakeXYWH(mx - 10, my - 8, 22, 5), P((255, 255, 255)))
        else:
            c.drawPath(poly([(mx - 12, my), (mx + 12, my - 2)], False), P(OUTC, 4))

    def head_side(self, c, p, t):
        k = self.kind
        if k == "zamasu":
            # halo behind the head
            c.drawOval(skia.Rect.MakeXYWH(-120, -130, 150, 190), P((255, 214, 90), 14, blur=10, a=170))
            c.drawOval(skia.Rect.MakeXYWH(-120, -130, 150, 190), P((255, 246, 190), 6))
        if k == "buu":
            sw = math.sin(t * 3) * 10
            pth = skia.Path(); pth.moveTo(-10, -44); pth.cubicTo(-30, -112, -104 + sw, -122, -112 + sw, -60)
            c.drawPath(pth, P(OUTC, 32)); c.drawPath(pth, P(self.st["skin"], 22))
            circ(c, -112 + sw, -56, 14, self.st["skin"])
        self.face_side(c, p, t)
        if k != "buu":
            nm, col = self.hairset(p, "side")
            pth, info = hair_path((-6, -16), 44, SIDE_SPIKES[nm], t, grow=p.get("grow", 1.0), crown=CROWN_SIDE)
            draw_hair(c, pth, info, col, (-6, -16), 44)
            if k == "vegito":
                lock(c, [(30, -36), (52, -20), (40, 8)], 22, col)
            elif k == "gogeta":
                lock(c, [(26, -38), (54, -24), (46, 4)], 22, col)
                lock(c, [(10, -40), (34, -24), (22, 0)], 18, col)
        self.eyes_side(c, p)

    def draw_side(self, c, x, gy, sc, p, t, face=1, air=0):
        J = self.joints(p)
        depth = self.foot_depth(p)
        oy = gy - depth * sc - air
        c.save(); c.translate(x, oy); c.scale(sc * face, sc)
        self.arm(c, J["barm"], True, p)
        self.leg(c, J["bleg"], True)
        self.torso(c, p)
        self.leg(c, J["fleg"], False)
        c.save(); c.translate(*J["hc"]); c.rotate(p["lean"] + p["head"]); self.head_side(c, p, t); c.restore()
        if p.get("blade"):
            hx, hy = J["farm"][2]
            ex, ey = J["farm"][1]
            dx, dy = hx - ex, hy - ey
            L = math.hypot(dx, dy) or 1
            bx, by = hx + dx / L * 190, hy + dy / L * 190
            c.drawLine(hx, hy, bx, by, P((230, 80, 220), 46, blur=14, a=170))
            c.drawLine(hx, hy, bx, by, P((250, 150, 245), 20))
            c.drawLine(hx, hy, bx, by, P((255, 255, 255), 7))
        self.arm(c, J["farm"], False, p)
        c.restore()
        hx, hy = J["farm"][2]
        self.hand = (x + hx * sc * face, oy + hy * sc)
        hcx, hcy = J["hc"]
        self.headpos = (x + hcx * sc * face, oy + hcy * sc)
        self.top = oy + (hcy - 150) * sc

    # ============================================================ FRONT VIEW
    def draw_front(self, c, x, gy, sc, p, t, air=0):
        st = self.st
        crouch = p.get("crouch", 0)
        legL = LTH + LSH
        oy = gy - (legL - crouch) * sc - 18 * sc - air
        c.save(); c.translate(x, oy); c.scale(sc, sc)
        spread = p.get("spread", 12)
        # legs
        for sgn in (-1, 1):
            hip = (sgn * 26, 0)
            ang = spread + crouch * 0.25
            kn = (hip[0] + sgn * math.sin(math.radians(ang)) * LTH, hip[1] + math.cos(math.radians(ang)) * LTH - crouch * 0.5)
            ft = (kn[0] - sgn * crouch * 0.1, legL - crouch + 4)
            an = (lerp(kn[0], ft[0], 0.62), lerp(kn[1], ft[1], 0.62))
            seg(c, [hip, kn], 60, st["pants"]); seg(c, [kn, an], 54, st["pants"])
            seg(c, [an, ft], 42, st["boot"])
            boot = skia.Path(); boot.addOval(skia.Rect.MakeXYWH(ft[0] - 30 + sgn * 6, ft[1] - 14, 60, 34)); fo(c, boot, st["boot"])
            tip = skia.Path(); tip.addOval(skia.Rect.MakeXYWH(ft[0] - 16 + sgn * 8, ft[1] + 2, 32, 18)); fo(c, tip, st["toe"], 3)
        # torso
        body = smooth([(-44, 6), (44, 6), (84, -LT + 30), (70, -LT + 0), (0, -LT - 10), (-70, -LT + 0), (-84, -LT + 30)])
        fo(c, body, st["top"])
        cel(c, body, 1, 0.82)
        if self.kind == "vegito":
            fo(c, poly([(-24, -LT - 4), (24, -LT - 4), (0, -LT + 60)]), st["under"], 4)
        elif self.kind == "gogeta":
            fo(c, poly([(-22, -LT - 4), (22, -LT - 4), (0, -LT + 70)]), st["skin"], 4)
            for sgn in (-1, 1):
                c.drawPath(poly([(0, -LT + 70), (sgn * 22, -LT - 4)], False), P(st["trim"], 9))
                c.drawPath(poly([(sgn * 70, -LT + 0), (sgn * 84, -LT + 30)], False), P(st["trim"], 16))
        c.drawPath(poly([(-40, -LT + 52), (-12, -LT + 58)], False), P(OUTC, 3))
        c.drawPath(poly([(40, -LT + 52), (12, -LT + 58)], False), P(OUTC, 3))
        band = skia.Path(); band.addRoundRect(skia.Rect.MakeLTRB(-50, -26, 50, 6), 10, 10); fo(c, band, st["sash"], 4)
        tail = smooth([(-30, -6), (-8, -4), (-12, 56), (-30, 60), (-34, 4)]); fo(c, tail, shade(st["sash"], 0.88), 4)
        # arms
        hands = {}
        cross = p.get("cross", False)
        order = (-1, 1)
        for sgn in order:
            a1 = p.get("a1", 18); a2 = p.get("a2", 10)
            if sgn == 1 and "ra1" in p:
                a1, a2 = p["ra1"], p["ra2"]
            o = (sgn * 74, -LT + 18)
            e = (o[0] + sgn * math.sin(math.radians(a1)) * LU, o[1] + math.cos(math.radians(a1)) * LU)
            h = (e[0] + sgn * math.sin(math.radians(a1 + a2)) * LF, e[1] + math.cos(math.radians(a1 + a2)) * LF)
            if cross:
                e = (sgn * 96, -LT + 74)
                h = (-sgn * 46, -LT + 60 + sgn * 6)
            hands[sgn] = (o, e, h)
        for sgn in order:
            o, e, h = hands[sgn]
            seg(c, [o, e], 44, st["skin"])
            if st["gloves"]:
                mid = (lerp(e[0], h[0], 0.18), lerp(e[1], h[1], 0.18))
                seg(c, [e, mid], 36, st["skin"]); seg(c, [mid, h], 40, st["glove"])
            else:
                seg(c, [e, h], 38, st["skin"])
            if "wrist" in st:
                seg(c, [(lerp(e[0], h[0], 0.66), lerp(e[1], h[1], 0.66)), (lerp(e[0], h[0], 0.86), lerp(e[1], h[1], 0.86))], 44, st["wrist"])
            circ(c, h[0], h[1], 26, st["glove"])
        # neck + head
        seg(c, [(0, -LT - 4), (0, -LT - 30)], 46, shade(st["skin"], 0.9))
        c.save()
        c.translate(0, -LT - NECK - HR * 0.75)
        c.rotate(p.get("tilt", 0))
        self.head_front(c, p, t)
        c.restore()
        c.restore()
        self.headpos = (x, oy + (-LT - NECK - HR * 0.75) * sc)
        self.top = oy + (-LT - NECK - HR * 0.75 - 170) * sc

    def head_front(self, c, p, t):
        st = self.st
        expr = p.get("expr", "smirk")
        for sgn in (-1, 1):
            ear = skia.Path(); ear.addOval(skia.Rect.MakeXYWH(sgn * 46 - 13, -10, 26, 36)); fo(c, ear, st["skin"])
            if st["earring"]:
                c.drawLine(sgn * 48, 22, sgn * 48, 34, P(OUTC, 3)); circ(c, sgn * 48, 42, 9, st["earring"], 3)
        face = smooth([(-44, -30), (0, -52), (44, -30), (48, 6), (30, 42), (0, 56), (-30, 42), (-48, 6)])
        fo(c, face, st["skin"]); cel(c, face, 1, 0.88)
        nm, col = self.hairset(p, "front")
        pth, info = hair_path((0, -18), 46, FRONT_SPIKES[nm], t, grow=p.get("grow", 1.0), crown=CROWN_FRONT)
        draw_hair(c, pth, info, col, (0, -18), 46)
        if self.kind == "vegito":
            lock(c, [(-8, -42), (-24, -20), (-16, 6)], 26, col)
        else:
            lock(c, [(-14, -42), (-30, -26), (-26, -6)], 24, col)
            lock(c, [(12, -42), (28, -28), (24, -10)], 22, col)
        # eyes
        for sgn in (-1, 1):
            ex = sgn * 20
            eye = smooth([(ex - sgn * 13, 2), (ex - sgn * 4, -8), (ex + sgn * 12, -6), (ex + sgn * 13, 4), (ex, 7)])
            c.drawPath(eye, P((255, 255, 255))); c.drawPath(eye, P(OUTC, 3))
            ec = st["eye"] if p.get("form", "blue") != "base" else (30, 30, 40)
            look = p.get("look", 0) * 4
            c.drawCircle(ex + look, -1, 5.5, P(ec)); c.drawCircle(ex + look, -1, 2.4, P((10, 10, 20)))
            c.drawCircle(ex + look - 2, -3, 1.6, P((255, 255, 255)))
            c.drawPath(poly([(sgn * 6, -14), (sgn * 34, -20)], False), P(OUTC, 7))
        c.drawPath(poly([(0, 6), (-5, 18), (3, 20)], False), P(OUTC, 3))
        self.mouth(c, expr, 0, 34)

    def draw(self, c, x, gy, sc, p, t, face=1, air=0, alpha=1.0, shadow=True, view="side"):
        if shadow and air < 250:
            sw = 120 * sc * max(0.3, 1 - air / 600)
            c.drawOval(skia.Rect.MakeXYWH(x - sw, gy - 14 * sc, 2 * sw, 28 * sc), P((0, 0, 0), a=int(70 * alpha)))
        if alpha < 1:
            c.saveLayerAlpha(None, int(255 * alpha))
        if view == "front":
            self.draw_front(c, x, gy, sc, p, t, air)
        else:
            self.draw_side(c, x, gy, sc, p, t, face, air)
        if alpha < 1:
            c.restore()

    def silhouette(self, c, x, gy, sc, p, t, col, face=1, air=0, a=230):
        pt = skia.Paint(ColorFilter=skia.ColorFilters.Blend(C(*col, a), skia.BlendMode.kSrcIn))
        c.saveLayer(None, pt)
        self.draw(c, x, gy, sc, p, t, face, air, shadow=False)
        c.restore()


FPOSES = {
    "fstand": dict(a1=14, a2=8, spread=10, crouch=0, tilt=0),
    "fcross": dict(a1=22, a2=-128, spread=12, crouch=0, tilt=-3, cross=True),
    "fpower": dict(a1=30, a2=-14, spread=22, crouch=30, tilt=0),
    "fflex": dict(a1=86, a2=96, spread=16, crouch=6, tilt=0),
}


def ftrack(kfs, t):
    return interp(kfs, t, lambda d: dict(FPOSES[d.get("p", "fstand")], grow=1.0))
