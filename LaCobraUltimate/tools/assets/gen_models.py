"""Genera geometrías Bedrock (.geo.json) y sus texturas con UV empaquetado.

Cada modelo se describe por huesos y cubos; el empaquetador asigna el box-UV
de cada cubo y los "pintores" generan la textura correspondiente, así la
geometría y la textura siempre coinciden.
"""
import json
import math
import os
import random
import sys
from pix import *

OUT = sys.argv[1] if len(sys.argv) > 1 else "out"
GEO_DIR = os.path.join(OUT, "models/entity")
TEX_DIR = os.path.join(OUT, "textures/entity")

GLOW_A = 72  # alfa baja (sin llegar a 0) => píxel emisivo con entity_emissive_alpha


def h(x, y, s=0):
    """Ruido determinista por píxel."""
    v = math.sin(x * 12.9898 + y * 78.233 + s * 37.719) * 43758.5453
    return v - math.floor(v)


class Model:
    def __init__(self, ident, tex_w, bounds=(2, 2, (0, 1, 0))):
        self.ident = ident
        self.tex_w = tex_w
        self.tex_h = 0
        self.bones = []
        self.cubes = []
        self.bounds = bounds

    def bone(self, name, parent=None, pivot=(0, 0, 0), rotation=None):
        b = {"name": name, "pivot": list(pivot)}
        if parent:
            b["parent"] = parent
        if rotation:
            b["rotation"] = list(rotation)
        self.bones.append(b)
        return name

    def cube(self, bone, origin, size, mat, rotation=None, pivot=None, inflate=0, tag=None, uv=None):
        self.cubes.append({"bone": bone, "origin": list(origin), "size": list(size), "mat": mat,
                           "rotation": rotation, "pivot": pivot, "inflate": inflate, "tag": tag or mat,
                           "uv": uv})

    def pack(self):
        x = y = row_h = 0
        order = sorted([c for c in self.cubes if c["uv"] is None],
                       key=lambda c: -(math.ceil(c["size"][2]) + math.ceil(c["size"][1])))
        for c in order:
            w, hh, d = (math.ceil(v) for v in c["size"])
            fw, fh = 2 * (w + d), d + hh
            if x + fw > self.tex_w:
                x, y, row_h = 0, y + row_h, 0
            c["uv"] = [x, y]
            x += fw
            row_h = max(row_h, fh)
        used = y + row_h
        for c in self.cubes:
            w, hh, d = (math.ceil(v) for v in c["size"])
            used = max(used, c["uv"][1] + d + hh)
        th = 16
        while th < used:
            th *= 2
        self.tex_h = th

    def paint(self, painters, name):
        img = canvas(self.tex_w, self.tex_h)
        for c in self.cubes:
            w, hh, d = (math.ceil(v) for v in c["size"])
            u, v = c["uv"]
            faces = {
                "up": (u + d, v, w, d), "down": (u + d + w, v, w, d),
                "east": (u, v + d, d, hh), "north": (u + d, v + d, w, hh),
                "west": (u + d + w, v + d, d, hh), "south": (u + 2 * d + w, v + d, w, hh),
            }
            fn = painters[c["mat"]]
            for face, (x0, y0, fw, fh) in faces.items():
                for yy in range(fh):
                    for xx in range(fw):
                        col = fn(face, xx, yy, fw, fh, c, x0 + xx, y0 + yy)
                        if col is not None:
                            px(img, x0 + xx, y0 + yy, col)
        save(img, os.path.join(TEX_DIR, name + ".png"))
        return img

    def to_json(self):
        bones = []
        for b in self.bones:
            bb = dict(b)
            cubes = []
            for c in self.cubes:
                if c["bone"] != b["name"]:
                    continue
                cc = {"origin": c["origin"], "size": c["size"], "uv": c["uv"]}
                if c["inflate"]:
                    cc["inflate"] = c["inflate"]
                if c["rotation"]:
                    cc["rotation"] = c["rotation"]
                    cc["pivot"] = c["pivot"]
                cubes.append(cc)
            if cubes:
                bb["cubes"] = cubes
            bones.append(bb)
        bw, bh, off = self.bounds
        return {
            "format_version": "1.12.0",
            "minecraft:geometry": [{
                "description": {
                    "identifier": self.ident, "texture_width": self.tex_w, "texture_height": self.tex_h,
                    "visible_bounds_width": bw, "visible_bounds_height": bh, "visible_bounds_offset": list(off)
                },
                "bones": bones
            }]
        }

    def write(self, fname):
        os.makedirs(GEO_DIR, exist_ok=True)
        with open(os.path.join(GEO_DIR, fname), "w") as f:
            json.dump(self.to_json(), f, indent=2)


# ======================================================================
#  PINTORES COMUNES
# ======================================================================
def scale_pattern(base, edge, hi, fleck=None, fleck_p=0.0, seed=0):
    def fn(face, x, y, fw, fh, c, ax, ay):
        cy = y // 3
        cx = (x + (cy % 2) * 2) // 4
        lx = (x + (cy % 2) * 2) % 4
        ly = y % 3
        col = base
        if ly == 2 or lx == 0:
            col = edge
        elif ly == 0 and lx in (1, 2):
            col = hi
        n = h(cx + ax // 4, cy + ay // 3, seed)
        col = shade(col, 0.92 + n * 0.16)
        if fleck and h(ax, ay, seed + 3) < fleck_p:
            col = fleck
        return col
    return fn


def belly_pattern(a, b):
    def fn(face, x, y, fw, fh, c, ax, ay):
        col = a if (y // 2) % 2 == 0 else b
        if x == 0 or x == fw - 1:
            col = shade(col, 0.8)
        return shade(col, 0.95 + h(ax, ay, 9) * 0.1)
    return fn


def solid(col, var=0.08, seed=4):
    def fn(face, x, y, fw, fh, c, ax, ay):
        return shade(col, 1 - var + h(ax, ay, seed) * var * 2)
    return fn


def glow(col, alpha=GLOW_A):
    def fn(face, x, y, fw, fh, c, ax, ay):
        cc = mix(col, WHITE, 0.25) if (x + y) % 3 == 0 else col
        return rgba(cc, alpha)
    return fn


def with_veins(fn, vein_col, freq, seed, alpha=GLOW_A, thick=0.07):
    """Superpone vetas emisivas (fase 2 / fase 3 del jefe)."""
    def g(face, x, y, fw, fh, c, ax, ay):
        base = fn(face, x, y, fw, fh, c, ax, ay)
        v = math.sin(ax * freq + math.sin(ay * freq * 0.7 + seed) * 2.2) + math.cos(ay * freq * 1.3 + seed)
        if abs(v) < thick and h(ax, ay, seed) < 0.85:
            return rgba(vein_col, alpha)
        return base
    return g


# ======================================================================
#  JEFE: LA SERPIENTE LEGENDARIA
# ======================================================================
def boss():
    m = Model("geometry.lacobra.serpiente_legendaria", 128, bounds=(7, 6, (0, 2.5, 1)))
    m.bone("root")
    # cola en el suelo (S hacia atrás)
    m.bone("base", "root", (0, 0, 0))
    m.cube("base", (-7, 0, -6), (14, 12, 12), "scale")
    m.cube("base", (-5, 0, -7), (10, 10, 1), "belly")
    prev, z, sizes = "base", 6, [(12, 10, 11), (10, 9, 10), (8, 7, 9), (6, 5, 9), (4, 3, 8), (2, 2, 6)]
    for i, (w, hh, d) in enumerate(sizes):
        name = "tail%d" % i
        m.bone(name, prev, (0, hh / 2, z))
        m.cube(name, (-w / 2, 0, z), (w, hh, d), "scale")
        prev, z = name, z + d
    # cuerpo erguido
    m.bone("body1", "base", (0, 12, 0))
    m.cube("body1", (-6, 12, -5), (12, 14, 10), "scale")
    m.cube("body1", (-4, 12, -6), (8, 14, 1), "belly")
    m.cube("body1", (-1, 17, 5), (2, 4, 2), "spike")
    m.cube("body1", (-1, 22, 5), (2, 3, 2), "spike")
    m.bone("body2", "body1", (0, 26, 0))
    m.cube("body2", (-5, 26, -5), (10, 14, 9), "scale")
    m.cube("body2", (-3, 26, -6), (6, 14, 1), "belly")
    m.cube("body2", (-1, 31, 4), (2, 4, 2), "spike")
    m.bone("neck", "body2", (0, 40, -1))
    m.cube("neck", (-4, 40, -5), (8, 10, 8), "scale")
    m.cube("neck", (-3, 40, -6), (6, 10, 1), "belly")
    # capucha de cobra
    m.bone("hood", "neck", (0, 44, 1))
    m.cube("hood", (-6, 38, 1), (12, 20, 2), "hood")
    m.bone("hood_l", "hood", (-6, 46, 2), (0, 25, 0))
    m.cube("hood_l", (-14, 39, 1), (8, 17, 2), "hood")
    m.bone("hood_r", "hood", (6, 46, 2), (0, -25, 0))
    m.cube("hood_r", (6, 39, 1), (8, 17, 2), "hood")
    # cabeza
    m.bone("head", "neck", (0, 50, -2))
    m.cube("head", (-5, 50, -14), (10, 6, 13), "head")
    m.cube("head", (-4, 50, -17), (8, 4, 3), "head")
    m.cube("head", (-6, 53, -12), (1, 2, 3), "eye")
    m.cube("head", (5, 53, -12), (1, 2, 3), "eye")
    m.cube("head", (-3, 47, -16), (1, 3, 1), "fang")
    m.cube("head", (2, 47, -16), (1, 3, 1), "fang")
    # corona dorada
    m.bone("crown", "head", (0, 56, -6))
    m.cube("crown", (-5, 56, -9), (10, 1, 6), "crown")
    m.cube("crown", (-4, 57, -8), (2, 3, 2), "crown")
    m.cube("crown", (-1, 57, -9), (2, 4, 2), "crown_gem")
    m.cube("crown", (2, 57, -8), (2, 3, 2), "crown")
    m.bone("jaw", "head", (0, 50, -2))
    m.cube("jaw", (-4, 47, -16), (8, 3, 14), "jaw")
    m.bone("tongue", "jaw", (0, 49, -15))
    m.cube("tongue", (-1, 49, -21), (2, 0, 6), "tongue")
    m.pack()
    m.write("serpiente_legendaria.geo.json")

    scale = scale_pattern(DARK, BLACK, DARK2, GOLD, 0.03, seed=1)
    belly = belly_pattern(GOLD, GOLD_D)

    def hood(face, x, y, fw, fh, c, ax, ay):
        if face == "south":  # dorso de la capucha: anteojo dorado
            cx, cy = fw / 2, fh * 0.45
            r = math.hypot((x - cx) * 1.1, y - cy)
            if fw >= 10 and 3 < r < 5.2:
                return GOLD_L if r < 4.2 else GOLD
            if fw < 10 and (x + y) % 5 == 0:
                return GOLD_D
        if face == "north":
            if x == 0 or x == fw - 1 or y == 0:
                return GOLD
            if fw >= 10 and (y - fh * 0.5) ** 2 + ((x - fw / 2) * 1.6) ** 2 < 7:
                return VIOLET_D
        return scale(face, x, y, fw, fh, c, ax, ay)

    def head(face, x, y, fw, fh, c, ax, ay):
        if face == "down":
            return (90, 20, 40, 255)  # paladar
        if face == "up" and fw == 10 and (x in (2, 7) and y % 3 == 0):
            return GOLD
        if face == "north" and fw == 8 and y == fh - 1 and x in (2, 5):
            return BLACK  # fosas nasales
        return scale(face, x, y, fw, fh, c, ax, ay)

    def jaw(face, x, y, fw, fh, c, ax, ay):
        if face == "up":
            return (110, 24, 52, 255) if 1 <= x < fw - 1 else (230, 220, 200, 255)
        return belly(face, x, y, fw, fh, c, ax, ay)

    def crown(face, x, y, fw, fh, c, ax, ay):
        return GOLD_L if (x + y) % 3 == 0 else GOLD

    def crown_gem(face, x, y, fw, fh, c, ax, ay):
        if y == 0 and face != "down":
            return rgba(VIOLET_L, GLOW_A)
        return GOLD_L

    base = {
        "scale": scale, "belly": belly, "hood": hood, "head": head, "jaw": jaw,
        "eye": glow(VIOLET_L), "fang": solid(IVORY, 0.04), "tongue": solid((160, 40, 110, 255)),
        "spike": solid(GOLD, 0.1), "crown": crown, "crown_gem": crown_gem,
    }
    m.paint(base, "serpiente_legendaria_f1")
    f2 = dict(base)
    for k in ("scale", "hood", "head"):
        f2[k] = with_veins(base[k], VIOLET_L, 0.55, 2.0)
    f2["spike"] = glow(VIOLET_L, 90)
    m.paint(f2, "serpiente_legendaria_f2")
    f3 = dict(base)
    for k in ("scale", "hood", "head"):
        f3[k] = with_veins(with_veins(base[k], VIOLET_L, 0.55, 2.0), GOLD_L, 0.8, 5.0, thick=0.09)
    f3["eye"] = glow(GOLD_W)
    f3["spike"] = glow(GOLD_L)
    f3["belly"] = with_veins(belly, GOLD_W, 0.9, 1.0, 90, 0.1)
    m.paint(f3, "serpiente_legendaria_f3")


# ======================================================================
#  SERPIENTE PEQUEÑA (veneno / guardiana / esbirro)
# ======================================================================
def serpiente():
    m = Model("geometry.lacobra.serpiente", 64, bounds=(2, 1.5, (0, 0.5, 0.5)))
    m.bone("root")
    m.bone("head", "root", (0, 1.5, -1))
    m.cube("head", (-2.5, 0, -6), (5, 3, 5), "head")
    m.cube("head", (-2, 0, -8), (4, 2, 2), "head")
    m.cube("head", (-3, 2, -5), (1, 1, 2), "eye")
    m.cube("head", (2, 2, -5), (1, 1, 2), "eye")
    m.cube("head", (-1.5, -1, -7), (1, 1, 1), "fang")
    m.cube("head", (0.5, -1, -7), (1, 1, 1), "fang")
    prev, z = "root", -1
    sizes = [(4, 3, 4), (3.5, 3, 4), (3, 2.5, 4), (2.5, 2, 4), (2, 1.5, 4), (1, 1, 4)]
    for i, (w, hh, d) in enumerate(sizes):
        name = "seg%d" % i
        m.bone(name, prev, (0, hh / 2, z))
        m.cube(name, (-w / 2, 0, z), (w, hh, d), "body")
        prev, z = name, z + d
    m.pack()
    m.write("serpiente.geo.json")

    def stripes(a, b, glow_band):
        def fn(face, x, y, fw, fh, c, ax, ay):
            if face == "down":
                return shade(b, 0.8)
            if glow_band and (ax + ay) % 6 == 0:
                return rgba(glow_band, GLOW_A)
            return a if (x + ay) % 4 else b
        return fn

    m.paint({"head": stripes(VIOLET, VIOLET_D, None), "body": stripes(VIOLET, BLACK, GOLD_L),
             "eye": glow(GOLD_W), "fang": solid(WHITE, 0.02)}, "serpiente_veneno")
    m.paint({"head": stripes(GOLD, GOLD_D, None), "body": stripes(GOLD_L, GOLD, WHITE),
             "eye": glow(VIOLET_L), "fang": solid(WHITE, 0.02)}, "serpiente_guardiana")
    m.paint({"head": scale_pattern(DARK, BLACK, DARK2, VIOLET, 0.05, 3),
             "body": scale_pattern(DARK, BLACK, DARK2, GOLD_D, 0.06, 5),
             "eye": glow(VIOLET_L), "fang": solid(IVORY, 0.02)}, "serpiente_esbirro")


# ======================================================================
#  ESFERA (Remate Legendario / Balón Dorado / Escupitajo)
# ======================================================================
def esfera():
    m = Model("geometry.lacobra.esfera", 64, bounds=(1, 1, (0, 0.25, 0)))
    m.bone("root")
    m.bone("ball", "root", (0, 3, 0))
    m.cube("ball", (-3, 0, -3), (6, 6, 6), "core")
    m.cube("ball", (-4, 1, -2), (8, 4, 4), "core")
    m.cube("ball", (-2, 1, -4), (4, 4, 8), "core")
    m.cube("ball", (-2, -1, -2), (4, 8, 4), "core")
    m.pack()
    m.write("esfera.geo.json")

    def orb(face, x, y, fw, fh, c, ax, ay):
        v = math.sin(ax * 0.9 + ay * 0.6) + math.cos(ay * 1.1 - ax * 0.3)
        if v > 1.0:
            return rgba(GOLD_W, GLOW_A)
        if v > 0.2:
            return rgba(GOLD_L, 100)
        if v < -1.1:
            return BLACK
        return rgba(VIOLET_L, 110)

    def ball(face, x, y, fw, fh, c, ax, ay):
        if (x // 2 + y // 2) % 3 == 0 and 0 < x < fw - 1 and 0 < y < fh - 1:
            return BLACK
        return GOLD_L if (x + y) % 5 else GOLD

    def spit(face, x, y, fw, fh, c, ax, ay):
        return rgba(mix(VIOLET_L, (120, 255, 120, 255), h(ax, ay)), 90)

    m.paint({"core": orb}, "esfera_remate")
    m.paint({"core": ball}, "balon_dorado")
    m.paint({"core": spit}, "escupitajo")


# ======================================================================
#  CÍRCULO MÁGICO (UV por cara de alta resolución)
# ======================================================================
def circulo():
    geo = {
        "format_version": "1.12.0",
        "minecraft:geometry": [{
            "description": {"identifier": "geometry.lacobra.circulo", "texture_width": 256, "texture_height": 128,
                            "visible_bounds_width": 10, "visible_bounds_height": 2, "visible_bounds_offset": [0, 0.5, 0]},
            "bones": [
                {"name": "root", "pivot": [0, 0, 0]},
                {"name": "inner", "parent": "root", "pivot": [0, 0, 0], "cubes": [
                    {"origin": [-24, 0.15, -24], "size": [48, 0, 48],
                     "uv": {"up": {"uv": [0, 0], "uv_size": [128, 128]}, "down": {"uv": [0, 0], "uv_size": [128, 128]}}}]},
                {"name": "outer", "parent": "root", "pivot": [0, 0, 0], "cubes": [
                    {"origin": [-36, 0.1, -36], "size": [72, 0, 72],
                     "uv": {"up": {"uv": [128, 0], "uv_size": [128, 128]}, "down": {"uv": [128, 0], "uv_size": [128, 128]}}}]},
            ]
        }]
    }
    os.makedirs(GEO_DIR, exist_ok=True)
    with open(os.path.join(GEO_DIR, "circulo.geo.json"), "w") as f:
        json.dump(geo, f, indent=2)

    img = canvas(256, 128)
    rnd = random.Random(7)
    c = 64
    glyphs = [[(0, 0), (1, 1), (2, 0), (1, -1)], [(0, -1), (0, 1), (1, 0), (2, -1), (2, 1)],
              [(0, 0), (1, 0), (2, 0), (1, 1), (1, -1)], [(0, -1), (1, 0), (2, 1), (2, -1)],
              [(0, 1), (1, 1), (2, 1), (2, 0), (2, -1)], [(0, 0), (1, -1), (2, 0), (1, 1), (0, -1)]]
    for y in range(128):
        for x in range(128):
            dx, dy = x + 0.5 - c, y + 0.5 - c
            r = math.hypot(dx, dy)
            a = math.degrees(math.atan2(dy, dx)) % 360
            col = None
            if 60 <= r < 62.5:
                col = GOLD_L
            elif 56 <= r < 57.2:
                col = GOLD
            elif 41 <= r < 42.4:
                col = VIOLET_L
            elif 26 <= r < 27.2:
                col = GOLD
            # ouroboros (serpiente) en el anillo exterior
            elif 47 <= r < 53:
                wave = math.sin(math.radians(a * 12))
                if (r - 50) ** 2 < 6 + wave * 2:
                    col = GOLD if int(a / 4) % 2 else GOLD_D
            # estrella de cinco puntas (pentágono futbolero)
            if col is None and r < 41:
                for k in range(5):
                    a1 = math.radians(k * 72 - 90)
                    a2 = math.radians(((k + 2) % 5) * 72 - 90)
                    p1 = (math.cos(a1) * 40, math.sin(a1) * 40)
                    p2 = (math.cos(a2) * 40, math.sin(a2) * 40)
                    ex, ey = p2[0] - p1[0], p2[1] - p1[1]
                    L = math.hypot(ex, ey)
                    t = max(0, min(1, ((dx - p1[0]) * ex + (dy - p1[1]) * ey) / (L * L)))
                    dd = math.hypot(dx - (p1[0] + ex * t), dy - (p1[1] + ey * t))
                    if dd < 1.1:
                        col = VIOLET_L
                        break
            if col is None and r < 9 and abs(r - 7) < 1.2:
                col = GOLD_W
            if col is not None:
                px(img, x, y, col)
    # cabeza del ouroboros
    for (x, y) in circle_mask(img, c + 50, c, 4):
        px(img, x, y, GOLD_L)
    px(img, c + 51, c - 1, VIOLET_W)
    # runas entre los anillos
    for i in range(16):
        a = math.radians(i * 22.5 + 11)
        gx, gy = c + math.cos(a) * 34 - 1, c + math.sin(a) * 34
        g = glyphs[i % len(glyphs)]
        for (ox, oy) in g:
            rect(img, gx + ox * 1.6, gy + oy * 1.6, gx + ox * 1.6 + 1, gy + oy * 1.6 + 1, GOLD_L)
    # anillo exterior de runas (segunda textura)
    c2 = 192
    for y in range(128):
        for x in range(128, 256):
            dx, dy = x + 0.5 - c2, y + 0.5 - c
            r = math.hypot(dx, dy)
            a = math.degrees(math.atan2(dy, dx)) % 360
            if 61 <= r < 63:
                px(img, x, y, VIOLET_L)
            elif 44 <= r < 45.5:
                px(img, x, y, VIOLET)
            elif 46 <= r < 60 and int(a) % 30 in (0, 1):
                px(img, x, y, GOLD_D)
    for i in range(24):
        a = math.radians(i * 15 + 7)
        gx, gy = c2 + math.cos(a) * 52 - 1, c + math.sin(a) * 52
        g = glyphs[(i * 5) % len(glyphs)]
        for (ox, oy) in g:
            rect(img, gx + ox * 2, gy + oy * 2, gx + ox * 2 + 1, gy + oy * 2 + 1, VIOLET_W if i % 2 else GOLD_L)
    save(img, os.path.join(TEX_DIR, "circulo_magico.png"))


# ======================================================================
#  COBRA SUPREMA: serpiente gigante enroscada en hélice
# ======================================================================
def cobra_suprema():
    m = Model("geometry.lacobra.cobra_suprema", 128, bounds=(8, 7, (0, 3, 0)))
    m.bone("root")
    m.bone("coil", "root", (0, 0, 0))
    n = 44
    turns = 1.75
    R = 26
    for i in range(n):
        t = i / (n - 1)
        a = t * turns * 2 * math.pi
        x, z = math.cos(a) * R, math.sin(a) * R
        y = 2 + t * 50
        s = round(4 + 4 * t)
        m.cube("coil", (round(x - s / 2), round(y - s / 2), round(z - s / 2)), (s, s, s), "body")
    # cabeza con capucha al final de la hélice (queda al frente, mirando a -Z)
    m.bone("head", "coil", (0, 54, -26))
    m.cube("head", (-6, 52, -40), (12, 7, 14), "head")
    m.cube("head", (-7, 55, -37), (1, 2, 3), "eye")
    m.cube("head", (6, 55, -37), (1, 2, 3), "eye")
    m.cube("head", (-14, 46, -25), (28, 22, 2), "hood")
    m.pack()
    m.write("cobra_suprema.geo.json")

    def body(face, x, y, fw, fh, c, ax, ay):
        v = (x + y * 2 + ax) % 7
        if v == 0:
            return rgba(GOLD_W, GLOW_A)
        if v in (1, 2):
            return rgba(GOLD_L, 100)
        return rgba(VIOLET if (y // 2) % 2 else BLACK, 255 if (y // 2) % 2 == 0 else 120)

    def hood(face, x, y, fw, fh, c, ax, ay):
        r = math.hypot(x - fw / 2, (y - fh / 2) * 1.2)
        if r < 6:
            return rgba(GOLD_L, 90)
        if x in (0, fw - 1) or y in (0, fh - 1):
            return rgba(GOLD_W, GLOW_A)
        return rgba(VIOLET_D, 140)

    m.paint({"body": body, "head": body, "eye": glow(WHITE), "hood": hood}, "cobra_suprema")


# ======================================================================
#  AVATAR DE LA COBRA (skin propia inspirada en la referencia)
# ======================================================================
HAIR = (51, 33, 18, 255)
HAIR_D = (34, 22, 12, 255)
HAIR_L = (72, 48, 26, 255)
SKIN = (186, 128, 80, 255)
SKIN_D = (150, 98, 58, 255)
BEARD = (70, 42, 20, 255)
JERSEY = (14, 36, 122, 255)
JERSEY_D = (8, 26, 92, 255)
JGOLD = (238, 172, 12, 255)
PANTS = (37, 37, 40, 255)
PANTS_D = (26, 26, 28, 255)
SHOE = (230, 228, 228, 255)
GLASS = (205, 205, 212, 255)
LENS = (240, 186, 40, 255)
PURPLE = (150, 92, 190, 255)


def box(img, u, v, w, hh, d, fn):
    faces = {
        "up": (u + d, v, w, d), "down": (u + d + w, v, w, d),
        "east": (u, v + d, d, hh), "north": (u + d, v + d, w, hh),
        "west": (u + d + w, v + d, d, hh), "south": (u + 2 * d + w, v + d, w, hh),
    }
    for face, (x0, y0, fw, fh) in faces.items():
        for y in range(fh):
            for x in range(fw):
                col = fn(face, x, y, fw, fh)
                if col is not None:
                    px(img, x0 + x, y0 + y, col)


def hair_px(x, y, s=0):
    r = h(x, y, s)
    return HAIR_D if r < 0.3 else (HAIR_L if r > 0.85 else HAIR)


def avatar():
    img = canvas(128, 64)

    def head(face, x, y, fw, fh):
        if face == "up":
            return hair_px(x, y, 1)
        if face == "down":
            return BEARD
        if face == "south":
            return hair_px(x, y, 2)
        if face in ("east", "west"):
            if y < 4 or (face == "east" and x > 4) or (face == "west" and x < 3):
                return hair_px(x, y, 3)
            if y >= 5:
                return BEARD if h(x, y, 4) < 0.7 else HAIR_D
            return SKIN_D
        # cara
        if y <= 1:
            return hair_px(x, y, 5) if not (y == 1 and x in (5, 6)) else PURPLE
        if y == 2:
            return HAIR_D if x in (1, 2, 5, 6) else SKIN
        if y == 3:
            if x in (0, 3, 4, 7):
                return GLASS
            return LENS if x in (2, 5) else (GLASS if x in (1, 6) else SKIN)
        if y == 4:
            return SKIN_D if x in (3, 4) else (GLASS if x in (0, 7) else SKIN)
        if y == 5:
            return BEARD if x in (0, 1, 6, 7) else (SKIN_D if x in (3, 4) else BEARD)
        if y == 6:
            return (60, 22, 14, 255) if x in (3, 4) else BEARD
        return BEARD if h(x, y, 6) < 0.8 else HAIR_D
    box(img, 0, 0, 8, 8, 8, head)

    def body(face, x, y, fw, fh):
        if face in ("up", "down"):
            return JERSEY_D
        base = JERSEY if h(x, y, 7) > 0.15 else JERSEY_D
        if face == "north":
            if y == 0 and 2 <= x <= 5:
                return JGOLD
            if y == 1 and 3 <= x <= 4:
                return SKIN
            if y == 1 and x in (2, 5):
                return JGOLD
            if y in (2, 3) and (x <= 1 or x >= 6):
                return JGOLD if y == 2 else JERSEY_D
            # escudo de serpiente dorado
            if (x, y) in ((5, 4), (6, 4), (5, 5), (6, 5)):
                return JGOLD if (x, y) != (5, 5) else (150, 92, 190, 255)
            if (x, y) == (1, 5):
                return JGOLD
            if y == 11:
                return JERSEY_D
            return base
        if face == "south":
            if y in (2, 3) and (x <= 1 or x >= 6):
                return JGOLD if y == 2 else base
            # dorsal "9"
            nine = {(3, 4), (4, 4), (2, 5), (5, 5), (3, 6), (4, 6), (5, 6), (5, 7), (3, 8), (4, 8)}
            if (x, y) in nine:
                return JGOLD
            return base
        return JGOLD if y == 2 else base
    box(img, 16, 16, 8, 12, 4, body)

    def arm(face, x, y, fw, fh):
        if y < 4:
            if face == "down":
                return SKIN
            return JGOLD if y in (1, 2) and face != "up" else JERSEY
        if face == "down":
            return SKIN_D
        if y == 11:
            return SKIN_D
        return SKIN if h(x, y, 8) > 0.1 else SKIN_D
    box(img, 40, 16, 4, 12, 4, arm)
    box(img, 32, 48, 4, 12, 4, arm)

    def leg(face, x, y, fw, fh):
        if face == "down":
            return SHOE
        if y >= 10:
            return SHOE if y == 11 else (PANTS_D if face != "north" else SHOE)
        return PANTS if h(x, y, 9) > 0.2 else PANTS_D
    box(img, 0, 16, 4, 12, 4, leg)
    box(img, 16, 48, 4, 12, 4, leg)

    def afro(face, x, y, fw, fh):
        if face == "north" and y < 2 and x in (8, 9):
            return PURPLE
        return hair_px(x + (fw if face in ("west", "south") else 0), y, 11)
    box(img, 64, 0, 12, 8, 11, afro)
    box(img, 64, 24, 2, 5, 8, lambda f, x, y, fw, fh: hair_px(x, y, 12))
    box(img, 84, 24, 2, 5, 8, lambda f, x, y, fw, fh: hair_px(x, y, 13))
    save(img, os.path.join(TEX_DIR, "avatar_cobra.png"))

    geo = {
        "format_version": "1.12.0",
        "minecraft:geometry": [{
            "description": {"identifier": "geometry.lacobra.avatar", "texture_width": 128, "texture_height": 64,
                            "visible_bounds_width": 3, "visible_bounds_height": 3.5, "visible_bounds_offset": [0, 1.5, 0]},
            "bones": [
                {"name": "root", "pivot": [0, 0, 0]},
                {"name": "body", "parent": "root", "pivot": [0, 24, 0],
                 "cubes": [{"origin": [-4, 12, -2], "size": [8, 12, 4], "uv": [16, 16]}]},
                {"name": "head", "parent": "body", "pivot": [0, 24, 0],
                 "cubes": [{"origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [0, 0]},
                           {"origin": [-6, 29, -3], "size": [12, 8, 11], "uv": [64, 0]},
                           {"origin": [-6, 24, -1], "size": [2, 5, 8], "uv": [64, 24]},
                           {"origin": [4, 24, -1], "size": [2, 5, 8], "uv": [84, 24]}]},
                {"name": "rightArm", "parent": "body", "pivot": [-5, 22, 0],
                 "cubes": [{"origin": [-8, 12, -2], "size": [4, 12, 4], "uv": [40, 16]}]},
                {"name": "leftArm", "parent": "body", "pivot": [5, 22, 0],
                 "cubes": [{"origin": [4, 12, -2], "size": [4, 12, 4], "uv": [32, 48]}]},
                {"name": "rightLeg", "parent": "root", "pivot": [-1.9, 12, 0],
                 "cubes": [{"origin": [-3.9, 0, -2], "size": [4, 12, 4], "uv": [0, 16]}]},
                {"name": "leftLeg", "parent": "root", "pivot": [1.9, 12, 0],
                 "cubes": [{"origin": [-0.1, 0, -2], "size": [4, 12, 4], "uv": [16, 48]}]},
            ]
        }]
    }
    with open(os.path.join(GEO_DIR, "avatar.geo.json"), "w") as f:
        json.dump(geo, f, indent=2)


if __name__ == "__main__":
    boss()
    serpiente()
    esfera()
    circulo()
    cobra_suprema()
    avatar()
    print("modelos generados")
