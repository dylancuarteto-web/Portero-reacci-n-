"""Genera los iconos de objetos (32x32) y las capas de la armadura de La Cobra."""
import math
import sys
import os
from pix import *

OUT = sys.argv[1] if len(sys.argv) > 1 else "out"
ITEMS = os.path.join(OUT, "textures/items")
ARMOR = os.path.join(OUT, "textures/models/armor")
S = 32


def seg_poly(a, b, wa, wb):
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy) or 1
    nx, ny = -dy / L, dx / L
    return [(a[0] + nx * wa, a[1] + ny * wa), (b[0] + nx * wb, b[1] + ny * wb),
            (b[0] - nx * wb, b[1] - ny * wb), (a[0] - nx * wa, a[1] - ny * wa)]


def lerp_pt(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


# ------------------------------------------------------------------ espada
def espada():
    img = canvas(S)
    base, tip = (10.5, 21.5), (29.5, 2.5)
    # hoja de obsidiana con filos dorados
    poly(img, seg_poly(base, lerp_pt(base, tip, 0.85), 2.6, 2.0) + [], DARK)
    poly(img, [(lerp_pt(base, tip, 0.84)[0] + 1.6, lerp_pt(base, tip, 0.84)[1] + 1.6),
          tip, (lerp_pt(base, tip, 0.84)[0] - 1.6, lerp_pt(base, tip, 0.84)[1] - 1.6)], DARK)
    for i in range(0, 40):
        t = i / 40
        p = lerp_pt(base, tip, t)
        px(img, p[0] + 1.6 + 0.5, p[1] + 1.6 - 0.4, GOLD_L if t < 0.86 else GOLD_W)
        px(img, p[0] - 1.4, p[1] - 1.6, GOLD_D if t < 0.86 else GOLD)
    # canal violeta
    for i in range(0, 30):
        p = lerp_pt((12, 20), (25, 7), i / 30)
        px(img, p[0], p[1], VIOLET if i % 6 else VIOLET_L)
    px(img, 28, 3, GOLD_W)
    # guarda: dos cabezas de serpiente doradas
    poly(img, seg_poly((6.5, 17.5), (14.5, 25.5), 1.6, 1.6), GOLD)
    poly(img, [(4, 16), (8, 15), (8, 19), (5, 19)], GOLD_L)
    poly(img, [(13, 24), (17, 25), (16, 28), (13, 27)], GOLD)
    px(img, 5, 17, VIOLET_L)
    px(img, 15, 26, VIOLET_L)
    px(img, 4, 15, GOLD_D)
    px(img, 17, 27, GOLD_D)
    # mango
    poly(img, seg_poly((9.5, 22.5), (4.5, 27.5), 1.4, 1.4), BLACK)
    for i, p in enumerate([(8, 23), (6, 25)]):
        px(img, p[0], p[1], GOLD)
        px(img, p[0] + 1, p[1], GOLD_D)
    # pomo con gema
    ellipse(img, 1, 26, 5, 30, VIOLET)
    px(img, 2, 27, VIOLET_W)
    px(img, 4, 29, VIOLET_D)
    outline(img, BLACK)
    return img


# ------------------------------------------------------------------ balón
def balon(size=S, energetic=False):
    img = canvas(size)
    c = size / 2
    r = size * 0.42
    for (x, y) in circle_mask(img, c, c, r):
        dx, dy = (x + 0.5 - c) / r, (y + 0.5 - c) / r
        light = 1.18 - 0.42 * (dx * 0.55 + dy * 0.75 + 0.6)
        px(img, x, y, shade(GOLD, max(0.6, light)))
    # parches pentagonales negros
    def pent(cx, cy, rr, rot=0):
        pts = [(cx + rr * math.cos(math.radians(rot + 72 * k - 90)),
                cy + rr * math.sin(math.radians(rot + 72 * k - 90))) for k in range(5)]
        poly(img, pts, BLACK)
        return pts
    s = size / 32
    centre = pent(c, c, 4.2 * s)
    for k in range(5):
        ang = math.radians(72 * k + 90 - 180 + 36)
        ox = c + math.cos(ang) * 11.6 * s
        oy = c + math.sin(ang) * 11.6 * s
        pent(ox, oy, 3.0 * s, 36 + 72 * k)
    # costuras
    for k in range(5):
        ang = math.radians(72 * k - 90)
        a = (c + math.cos(ang) * 4.2 * s, c + math.sin(ang) * 4.2 * s)
        b = (c + math.cos(ang) * 8.0 * s, c + math.sin(ang) * 8.0 * s)
        line(img, a[0], a[1], b[0], b[1], GOLD_D)
    # recorte al círculo
    for y in range(size):
        for x in range(size):
            if (x + 0.5 - c) ** 2 + (y + 0.5 - c) ** 2 > r * r:
                px(img, x, y, CLEAR)
    # brillo
    for (x, y) in [(10, 8), (11, 8), (9, 9), (10, 9), (9, 10)]:
        px(img, x * s, y * s, GOLD_W)
    outline(img, mix(GOLD_D, BLACK, 0.6))
    if energetic:
        img = glow_halo(img, VIOLET_L, 2, 0.5)
    return img


# ------------------------------------------------------------------ guantes
def guantes():
    img = canvas(S)
    # palma
    poly(img, [(8, 14), (22, 14), (23, 24), (20, 28), (10, 28), (7, 24)], BLACK)
    # dedos
    for i, x in enumerate([9, 13, 17, 21]):
        top = [6, 4, 4, 7][i]
        rect(img, x - 1 if i < 3 else x - 1, top, x + 2 if i < 3 else x + 1, 15, DARK)
        px(img, x, top, DARK2)
    # pulgar
    poly(img, [(7, 16), (3, 12), (2, 14), (6, 20)], DARK)
    # muñequera dorada con franja violeta
    rect(img, 9, 27, 21, 30, GOLD)
    rect(img, 9, 28, 21, 28, VIOLET)
    # detalles: franjas doradas en la palma
    line(img, 9, 18, 21, 18, GOLD)
    line(img, 9, 20, 21, 20, GOLD_D)
    # emblema serpiente (S)
    for (x, y) in [(16, 22), (15, 22), (14, 23), (15, 24), (16, 24), (17, 25), (16, 26), (15, 26)]:
        px(img, x, y, GOLD_L)
    px(img, 17, 22, VIOLET_L)
    inner_shade(img)
    outline(img, BLACK)
    return img


# ------------------------------------------------------------------ amuleto
def amuleto():
    img = canvas(S)
    # cadena
    for i in range(14):
        a = math.radians(200 + i * 10.5)
        x = 16 + math.cos(a) * 11
        y = 13 + math.sin(a) * 10
        px(img, x, y, GOLD if i % 2 else GOLD_L)
    # serpiente enroscada (anillo)
    for (x, y) in circle_mask(img, 16, 20, 8.5):
        d = math.hypot(x + 0.5 - 16, y + 0.5 - 20)
        if d > 5.2:
            ang = math.atan2(y + 0.5 - 20, x + 0.5 - 16)
            band = (math.sin(ang * 7) > 0.2)
            px(img, x, y, GOLD_L if band else GOLD)
    # gema violeta
    for (x, y) in circle_mask(img, 16, 20, 5):
        d = math.hypot(x + 0.5 - 15, y + 0.5 - 19)
        px(img, x, y, mix(VIOLET_W, VIOLET_D, d / 6))
    px(img, 14, 18, WHITE)
    # cabeza de serpiente
    poly(img, [(21, 11), (26, 12), (26, 15), (22, 15)], GOLD)
    px(img, 24, 13, VIOLET_L)
    px(img, 27, 14, (200, 40, 70, 255))
    inner_shade(img)
    outline(img, BLACK)
    return glow_halo(img, VIOLET, 1, 0.35)


# ------------------------------------------------------------------ núcleo
def nucleo():
    img = canvas(S)
    oct_pts = [(16 + 12 * math.cos(math.radians(22.5 + 45 * k)), 16 + 12 * math.sin(math.radians(22.5 + 45 * k))) for k in range(8)]
    poly(img, oct_pts, GOLD_D)
    oct2 = [(16 + 10 * math.cos(math.radians(22.5 + 45 * k)), 16 + 10 * math.sin(math.radians(22.5 + 45 * k))) for k in range(8)]
    poly(img, oct2, BLACK)
    for (x, y) in circle_mask(img, 16, 16, 8):
        d = math.hypot(x + 0.5 - 15, y + 0.5 - 15) / 8
        swirl = math.sin(math.atan2(y - 16, x - 16) * 3 + d * 9)
        c = mix(VIOLET_W, VIOLET_D, d)
        if swirl > 0.55:
            c = mix(c, GOLD_L, 0.55)
        px(img, x, y, c)
    for k in range(8):
        a = math.radians(22.5 + 45 * k)
        px(img, 16 + 11 * math.cos(a), 16 + 11 * math.sin(a), GOLD_L)
    sparkle(img, 12, 12, WHITE, 2)
    outline(img, BLACK)
    return glow_halo(img, VIOLET_L, 2, 0.45)


# ------------------------------------------------------------------ tótem
def totem():
    img = canvas(S)
    # cuerpo dorado
    poly(img, [(10, 13), (22, 13), (21, 27), (11, 27)], GOLD)
    # capucha de cobra
    poly(img, [(16, 2), (24, 6), (26, 13), (22, 17), (10, 17), (6, 13), (8, 6)], GOLD_L)
    poly(img, [(16, 5), (21, 8), (22, 13), (16, 15), (10, 13), (11, 8)], BLACK)
    # ojos
    px(img, 13, 10, VIOLET_W); px(img, 14, 10, VIOLET_L)
    px(img, 19, 10, VIOLET_W); px(img, 18, 10, VIOLET_L)
    # colmillos
    px(img, 14, 13, WHITE); px(img, 18, 13, WHITE)
    # gema en el pecho
    rect(img, 15, 19, 17, 21, VIOLET)
    px(img, 15, 19, VIOLET_W)
    # alas laterales
    poly(img, [(10, 18), (4, 20), (6, 24), (10, 23)], GOLD_D)
    poly(img, [(22, 18), (28, 20), (26, 24), (22, 23)], GOLD_D)
    # base negra
    rect(img, 9, 27, 23, 29, DARK)
    line(img, 9, 28, 23, 28, GOLD_D)
    inner_shade(img)
    outline(img, BLACK)
    return img


# ------------------------------------------------------------------ escama
def escama():
    img = canvas(S)
    poly(img, [(16, 4), (26, 14), (16, 28), (6, 14)], DARK)
    for (x, y) in [(x, y) for y in range(S) for x in range(S) if img.getpixel((x, y))[3]]:
        t = (y - 4) / 24
        c = mix(DARK2, BLACK, t)
        if abs((x - 16) + (y - 14) * 0.4) < 1.2:
            c = mix(c, GOLD, 0.8)
        px(img, x, y, c)
    poly(img, [(16, 6), (23, 14), (16, 17), (9, 14)], mix(DARK2, VIOLET_D, 0.5))
    line(img, 10, 14, 16, 7, GOLD_L)
    line(img, 16, 7, 22, 14, GOLD)
    sparkle(img, 12, 11, GOLD_W, 1)
    inner_shade(img)
    outline(img, BLACK)
    return img


# ------------------------------------------------------------------ colmillo
def colmillo():
    img = canvas(S)
    pts = []
    for i in range(20):
        t = i / 19
        x = 9 + 14 * t + math.sin(t * 3.1) * 2
        y = 4 + 23 * t
        w = 4.2 * (1 - t) + 0.4
        pts.append((x, y, w))
    left = [(p[0] - p[2], p[1]) for p in pts]
    right = [(p[0] + p[2], p[1]) for p in pts][::-1]
    poly(img, left + right, IVORY)
    for (x, y) in [(x, y) for y in range(S) for x in range(S) if img.getpixel((x, y))[3]]:
        t = (y - 4) / 23
        c = mix(IVORY, IVORY_D, abs(x - (9 + 14 * t)) / 5)
        if t > 0.7:
            c = mix(c, VIOLET_L, (t - 0.7) * 3)
        px(img, x, y, c)
    rect(img, 5, 3, 14, 5, GOLD)
    line(img, 5, 4, 14, 4, GOLD_L)
    inner_shade(img)
    outline(img, BLACK)
    return glow_halo(img, VIOLET, 1, 0.4)


# ------------------------------------------------------------------ esencia
def esencia():
    img = canvas(S)
    star = []
    for k in range(16):
        r = 13 if k % 2 == 0 else 5.5
        a = math.radians(k * 22.5 - 90)
        star.append((16 + r * math.cos(a), 16 + r * math.sin(a)))
    poly(img, star, GOLD)
    for (x, y) in circle_mask(img, 16, 16, 6.5):
        d = math.hypot(x + 0.5 - 16, y + 0.5 - 16) / 6.5
        px(img, x, y, mix(VIOLET_W, VIOLET, d))
    for (x, y) in circle_mask(img, 16, 16, 2.2):
        px(img, x, y, WHITE)
    inner_shade(img, hi=1.3, lo=0.75)
    outline(img, mix(GOLD_D, BLACK, 0.5))
    return glow_halo(img, GOLD_L, 2, 0.55)


# ------------------------------------------------------------------ ídolo
def idolo():
    img = canvas(S)
    rect(img, 6, 25, 26, 29, DARK2)
    rect(img, 8, 23, 24, 25, DARK)
    line(img, 6, 27, 26, 27, GOLD_D)
    # espiral de serpiente
    for i in range(140):
        t = i / 140
        a = t * math.pi * 4.4
        r = 8.5 * (1 - t * 0.55)
        x = 16 + math.cos(a) * r
        y = 22 - t * 14 + math.sin(a) * r * 0.32
        c = GOLD if (i // 6) % 2 else GOLD_L
        ellipse(img, x - 1.4, y - 1.4, x + 1.4, y + 1.4, c)
    # cabeza
    poly(img, [(14, 3), (20, 3), (22, 7), (12, 7)], GOLD_L)
    px(img, 15, 5, VIOLET_W); px(img, 19, 5, VIOLET_W)
    px(img, 17, 8, (200, 40, 70, 255))
    inner_shade(img)
    outline(img, BLACK)
    return glow_halo(img, VIOLET, 1, 0.4)


# ------------------------------------------------------------------ libro táctico (menú)
def libro():
    img = canvas(S)
    poly(img, [(6, 5), (24, 3), (27, 26), (9, 29)], BLACK)
    poly(img, [(8, 6), (24, 4.5), (26, 25), (10, 27)], DARK)
    poly(img, [(24, 3), (27, 4), (29, 26), (27, 26)], IVORY_D)
    # cancha táctica dorada
    line(img, 10, 9, 23, 7.5, GOLD); line(img, 23, 7.5, 25, 23, GOLD)
    line(img, 25, 23, 12, 25, GOLD); line(img, 12, 25, 10, 9, GOLD)
    line(img, 11, 17, 24, 15.5, GOLD_D)
    ellipse(img, 15, 13, 20, 18, CLEAR)
    for a in range(0, 360, 30):
        px(img, 17.5 + 2.6 * math.cos(math.radians(a)), 16.3 + 2.6 * math.sin(math.radians(a)), GOLD_L)
    # flechas violetas (jugada)
    line(img, 13, 22, 17, 19, VIOLET_L); line(img, 17, 19, 21, 11, VIOLET_L)
    px(img, 21, 10, VIOLET_W); px(img, 20, 11, VIOLET_W); px(img, 22, 11, VIOLET_W)
    # marcador
    rect(img, 16, 27, 17, 31, VIOLET)
    inner_shade(img)
    outline(img, BLACK)
    return img


# ------------------------------------------------------------------ runas
GLYPHS = {
    "instinto": [  # ojo de serpiente
        "..........", "...####...", ".##....##.", "#...##...#", "#..####..#",
        "#...##...#", ".##....##.", "...####...", "..........", ".........."],
    "remate": [  # balón con flecha
        ".......###", "........##", ".......#.#", "..###.#...", ".#####....",
        ".#####....", ".#####....", "..###.....", "..........", ".........."],
    "veneno": [  # colmillo con gota
        ".##....##.", ".##....##.", ".##....##.", "..#....#..", "..#....#..",
        "...........", "....##....", "...####...", "...####...", "....##...."],
    "dominio": [  # círculo rúnico
        "...####...", ".##....##.", ".#..##..#.", "#..#..#..#", "#.#.##.#.#",
        "#..#..#..#", ".#..##..#.", ".##....##.", "...####...", ".........."],
    "suprema": [  # corona + serpiente
        "#...##...#", "##.####.##", "##########", "..........", "..######..",
        ".##....##.", "......##..", "....##....", "..##......", ".########."],
}
RUNE_COL = {
    "instinto": (GOLD_L, GOLD),
    "remate": (GOLD_W, GOLD_L),
    "veneno": (VIOLET_W, VIOLET_L),
    "dominio": (VIOLET_L, GOLD_L),
    "suprema": (GOLD_W, VIOLET_L),
}


def runa(kind):
    img = canvas(S)
    # tablilla de piedra oscura
    poly(img, [(7, 3), (25, 3), (28, 7), (28, 25), (25, 29), (7, 29), (4, 25), (4, 7)], DARK)
    poly(img, [(8, 5), (24, 5), (26, 8), (26, 24), (24, 27), (8, 27), (6, 24), (6, 8)], DARK2)
    col, edge = RUNE_COL[kind]
    # marco
    for (x, y) in [(x, y) for y in range(S) for x in range(S)]:
        c = get(img, x, y)
        if c == DARK and (x + y) % 3 == 0:
            px(img, x, y, mix(DARK, edge, 0.35))
    g = GLYPHS[kind]
    for j, row in enumerate(g):
        for i, ch in enumerate(row):
            if ch == "#":
                for (dx, dy) in ((0, 0), (1, 0), (0, 1), (1, 1)) if False else ((0, 0),):
                    pass
                x0, y0 = 6 + i * 2, 6 + j * 2
                rect(img, x0, y0, x0 + 1, y0 + 1, col)
                px(img, x0 + 1, y0 + 1, edge)
    if kind == "suprema":
        for (x, y) in [(x, y) for y in range(S) for x in range(S) if get(img, x, y) == DARK]:
            px(img, x, y, mix(DARK, GOLD_D, 0.45))
    inner_shade(img)
    outline(img, BLACK)
    return glow_halo(img, edge, 1, 0.45)


# ------------------------------------------------------------------ iconos de armadura
def casco():
    img = canvas(S)
    poly(img, [(6, 14), (8, 6), (16, 3), (24, 6), (26, 14), (26, 24), (21, 24), (21, 16), (11, 16), (11, 24), (6, 24)], BLACK)
    poly(img, [(8, 12), (10, 7), (16, 5), (22, 7), (24, 12)], DARK2)
    line(img, 16, 3, 16, 15, GOLD)
    line(img, 7, 14, 25, 14, GOLD)
    px(img, 9, 19, VIOLET_L); px(img, 22, 19, VIOLET_L)
    # cresta de cobra
    poly(img, [(13, 2), (16, -1), (19, 2)], GOLD_L)
    inner_shade(img)
    outline(img, BLACK)
    return img


def pechera():
    img = canvas(S)
    poly(img, [(4, 5), (11, 4), (16, 7), (21, 4), (28, 5), (28, 13), (24, 13), (24, 28), (8, 28), (8, 13), (4, 13)], BLACK)
    poly(img, [(10, 9), (22, 9), (22, 26), (10, 26)], DARK)
    line(img, 8, 15, 24, 15, GOLD); line(img, 8, 17, 24, 17, GOLD_D)
    # escudo serpiente en el pecho
    poly(img, [(13, 18), (19, 18), (19, 22), (16, 25), (13, 22)], GOLD)
    px(img, 16, 20, VIOLET_W); px(img, 15, 21, VIOLET_L); px(img, 17, 21, VIOLET_L)
    rect(img, 4, 5, 8, 7, GOLD_D); rect(img, 24, 5, 28, 7, GOLD_D)
    inner_shade(img)
    outline(img, BLACK)
    return img


def pantalones():
    img = canvas(S)
    poly(img, [(7, 4), (25, 4), (26, 29), (19, 29), (16, 12), (13, 29), (6, 29)], BLACK)
    rect(img, 7, 4, 25, 7, GOLD)
    line(img, 7, 6, 25, 6, VIOLET)
    line(img, 8, 9, 7, 28, GOLD_D); line(img, 24, 9, 25, 28, GOLD_D)
    px(img, 16, 5, VIOLET_W)
    inner_shade(img)
    outline(img, BLACK)
    return img


def botas():
    img = canvas(S)
    poly(img, [(4, 10), (11, 10), (11, 22), (14, 24), (14, 28), (3, 28), (3, 10)], BLACK)
    poly(img, [(18, 10), (25, 10), (25, 22), (28, 24), (28, 28), (17, 28), (17, 10)], BLACK)
    for x0 in (3, 17):
        line(img, x0 + 1, 13, x0 + 8, 13, GOLD)
        rect(img, x0, 26, x0 + 11, 28, GOLD_D)
        line(img, x0 + 1, 27, x0 + 10, 27, WHITE)
        px(img, x0 + 4, 18, VIOLET_L)
    inner_shade(img)
    outline(img, BLACK)
    return img


# ------------------------------------------------------------------ capas de armadura 64x32
def face_paint(img, u, v, w, h, d, painter):
    """Pinta una caja de UV estilo Bedrock (box uv) en (u, v)."""
    faces = {
        "up": (u + d, v, w, d), "down": (u + d + w, v, w, d),
        "east": (u, v + d, d, h), "north": (u + d, v + d, w, h),
        "west": (u + d + w, v + d, d, h), "south": (u + 2 * d + w, v + d, w, h),
    }
    for name, (x0, y0, fw, fh) in faces.items():
        for y in range(fh):
            for x in range(fw):
                c = painter(name, x, y, fw, fh)
                if c is not None:
                    px(img, x0 + x, y0 + y, c)


def armor_layer1():
    img = canvas(64, 32)

    def helmet(face, x, y, w, h):
        base = BLACK if (x + y) % 4 else DARK
        if face == "up":
            return GOLD if x in (3, 4) else base
        if face == "north":
            if y == 7 or (y < 3 and x in (3, 4)):
                return GOLD
            if y in (4,) and x in (1, 2, 5, 6):
                return CLEAR  # visor
            if y == 5 and x in (2, 5):
                return VIOLET_L
            return base
        if face in ("east", "west", "south"):
            if y == 7:
                return GOLD_D
            if y == 3:
                return VIOLET if face == "south" else GOLD
            return base
        return base
    face_paint(img, 0, 0, 8, 8, 8, helmet)

    def chest(face, x, y, w, h):
        base = BLACK if (x * 3 + y) % 5 else DARK
        if face == "north":
            if y in (3, 4):
                return GOLD if y == 3 else GOLD_D
            if 2 <= x <= 5 and 6 <= y <= 9:
                if (x, y) in ((3, 7), (4, 7)):
                    return VIOLET_W
                return GOLD if not (y == 9 and x in (2, 5)) else base
            if y == 11:
                return VIOLET
            return base
        if face == "south":
            if y in (3, 4):
                return GOLD_D
            if x in (3, 4) and y > 5:
                return GOLD if y % 2 else GOLD_D
            return base
        if face in ("east", "west"):
            return GOLD_D if y in (3, 4) else base
        return base
    face_paint(img, 16, 16, 8, 12, 4, chest)

    def arm(face, x, y, w, h):
        base = BLACK if (x + y * 2) % 5 else DARK
        if y < 4:
            return GOLD if y in (1, 2) and face != "down" else base
        if y == 10:
            return VIOLET
        return base
    face_paint(img, 40, 16, 4, 12, 4, arm)

    def boot(face, x, y, w, h):
        base = BLACK if (x + y) % 4 else DARK
        if y >= 10:
            return WHITE if y == 11 else GOLD_D
        if y == 8:
            return GOLD
        if face == "north" and y == 9 and x in (1, 2):
            return VIOLET_L
        return base
    face_paint(img, 0, 16, 4, 12, 4, boot)
    return img


def armor_layer2():
    img = canvas(64, 32)

    def belt(face, x, y, w, h):
        base = BLACK if (x + y) % 5 else DARK
        if y in (0, 1):
            return GOLD if y == 0 else VIOLET
        if face == "north" and x in (3, 4) and y == 0:
            return GOLD_W
        return base
    face_paint(img, 16, 16, 8, 12, 4, belt)

    def leg(face, x, y, w, h):
        base = BLACK if (x + y * 3) % 6 else DARK
        if face in ("east", "west") and x in (1, 2):
            return GOLD if y % 3 else GOLD_D
        if y == 0:
            return GOLD
        if face == "north" and y == 6 and x in (1, 2):
            return VIOLET_L
        return base
    face_paint(img, 0, 16, 4, 12, 4, leg)
    return img


def main():
    icons = {
        "espada_cobra": espada(), "balon_dorado": balon(), "guantes_goat": guantes(),
        "amuleto_cobra": amuleto(), "nucleo_energia": nucleo(), "totem_cobra": totem(),
        "escama_cobra": escama(), "colmillo_legendario": colmillo(), "esencia_suprema": esencia(),
        "idolo_serpiente": idolo(), "libro_tactico": libro(),
        "casco_cobra": casco(), "pechera_cobra": pechera(), "pantalones_cobra": pantalones(), "botas_cobra": botas(),
    }
    for k in GLYPHS:
        icons["runa_" + k] = runa(k)
    for name, img in icons.items():
        save(img, os.path.join(ITEMS, name + ".png"))
    save(armor_layer1(), os.path.join(ARMOR, "cobra_layer_1.png"))
    save(armor_layer2(), os.path.join(ARMOR, "cobra_layer_2.png"))
    # hoja de vista previa (no se empaqueta)
    if len(sys.argv) > 2:
        names = list(icons)
        sheet = canvas(len(names) * 34 * 4, 34 * 4)
        bg = Image.new("RGBA", sheet.size, (90, 90, 100, 255))
        for i, n in enumerate(names):
            bg.alpha_composite(icons[n].resize((128, 128), Image.NEAREST), (i * 136 + 4, 4))
        bg.save(sys.argv[2])
    print("iconos:", len(icons))


if __name__ == "__main__":
    main()
