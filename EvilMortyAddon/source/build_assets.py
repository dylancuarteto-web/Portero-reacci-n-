"""Genera los modelos 3D y las texturas originales del add-on Evil Morty (fan-made).

Uso (desde la carpeta EvilMortyAddon):  python source/build_assets.py
Requiere Pillow. Todo el arte se dibuja aquí desde cero; no usa assets de terceros.
"""
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
RP = ROOT / "RP"
BP = ROOT / "BP"

AMBER = (255, 170, 30)
AMBER_HOT = (255, 214, 90)
AMBER_DEEP = (200, 90, 10)


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def save(img, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path)


# --- Utilidades de geometría (UV por cara) ---------------------------------

def face_uv(regions, front, rest):
    out = {}
    for face in ("north", "south", "east", "west", "up", "down"):
        u, v, w, h = regions[front if face == "north" else rest]
        out[face] = {"uv": [u, v], "uv_size": [w, h]}
    return out


def cube(regions, origin, size, front, rest=None, **extra):
    data = {"origin": origin, "size": size, "uv": face_uv(regions, front, rest or front)}
    data.update(extra)
    return data


def geo(identifier, tw, th, bones, bounds=(2, 3, 1.5)):
    return {
        "format_version": "1.16.0",
        "minecraft:geometry": [{
            "description": {
                "identifier": identifier,
                "texture_width": tw,
                "texture_height": th,
                "visible_bounds_width": bounds[0],
                "visible_bounds_height": bounds[1],
                "visible_bounds_offset": [0, bounds[2], 0],
            },
            "bones": bones,
        }],
    }


def fill(px, region, color):
    u, v, w, h = region
    for x in range(u, u + w):
        for y in range(v, v + h):
            px[x, y] = color


# --- Pintura con volumen -----------------------------------------------------

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def paint(px, region, top, bottom, light=None, dark=None):
    """Degradado vertical con bisel: borde superior/izquierdo claro, inferior/derecho oscuro."""
    u, v, w, h = region
    for y in range(h):
        base = lerp(top, bottom, y / max(h - 1, 1))
        for x in range(w):
            color = base
            if light and (x == 0 or y == 0):
                color = light
            if dark and (x == w - 1 or y == h - 1):
                color = dark
            px[u + x, v + y] = color + (255,)


# --- Parche (casco) ---------------------------------------------------------
# Las raíces "head" y "rightItem" se llaman igual que los huesos del jugador:
# así Bedrock une el modelo a la cabeza y a la mano.

PATCH_REG = {
    "front": (0, 0, 12, 10), "side": (12, 0, 4, 4), "strap": (16, 0, 4, 4), "metal": (20, 0, 4, 4),
    "amber": (24, 0, 4, 4), "lens": (28, 0, 4, 4), "led": (0, 10, 2, 2), "led_amber": (2, 10, 2, 2),
    "buckle": (4, 10, 4, 4),
}
PATCH_WORN = ["parche", "anillo", "lente", "led", "correa", "hebilla", "modulo", "antena", "antena_punta", "cable"]
PATCH_HELD = ["sostenido", "sostenido_lente"]


def patch_geometry():
    r = PATCH_REG
    y, h, t = 28.6, 0.5, 0.3
    bones = [
        {"name": "head", "pivot": [0, 24, 0]},
        {"name": "parche", "parent": "head", "pivot": [-2, 27.7, -4.5], "cubes": [
            cube(r, [-4.0, 25.9, -4.55], [4.0, 3.6, 0.25], "metal"),
            cube(r, [-3.8, 26.1, -4.8], [3.6, 3.2, 0.5], "front", "side"),
        ]},
        {"name": "anillo", "parent": "parche", "pivot": [-2, 27.7, -5.0], "cubes": [
            cube(r, [-2.9, 28.5, -5.05], [1.8, 0.3, 0.3], "amber"),
            cube(r, [-2.9, 26.6, -5.05], [1.8, 0.3, 0.3], "amber"),
            cube(r, [-2.9, 26.9, -5.05], [0.3, 1.6, 0.3], "amber"),
            cube(r, [-1.4, 26.9, -5.05], [0.3, 1.6, 0.3], "amber"),
        ]},
        {"name": "lente", "parent": "parche", "pivot": [-2, 27.7, -5.0],
         "cubes": [cube(r, [-2.5, 27.2, -5.0], [1.0, 1.0, 0.2], "lens")]},
        {"name": "led", "parent": "parche", "pivot": [-0.6, 28.9, -4.9],
         "cubes": [cube(r, [-0.8, 28.7, -4.95], [0.4, 0.4, 0.2], "led")]},
        {"name": "correa", "parent": "head", "pivot": [0, 28.85, 0], "cubes": [
            cube(r, [-0.2, y, -4.35], [4.55, h, t], "strap"),
            cube(r, [-4.35, y, -4.35], [0.5, h, t], "strap"),
            cube(r, [4.05, y, -4.35], [t, h, 8.7], "strap"),
            cube(r, [-4.35, y, -4.35], [t, h, 8.7], "strap"),
            cube(r, [-4.35, y, 4.05], [8.7, h, t], "strap"),
            cube(r, [1.2, y + 0.05, -4.45], [0.4, 0.4, 0.12], "led_amber"),
            cube(r, [2.4, y + 0.05, -4.45], [0.4, 0.4, 0.12], "led_amber"),
        ]},
        {"name": "hebilla", "parent": "head", "pivot": [4.3, 28.85, 0],
         "cubes": [cube(r, [4.1, 28.35, -0.8], [0.45, 1.0, 1.6], "buckle")]},
        {"name": "modulo", "parent": "head", "pivot": [-4.7, 27.5, -1.1], "cubes": [
            cube(r, [-5.1, 26.2, -2.6], [0.8, 2.6, 3.0], "metal"),
            cube(r, [-5.2, 27.2, -2.3], [0.1, 0.6, 2.4], "amber"),
        ]},
        {"name": "antena", "parent": "modulo", "pivot": [-4.75, 28.8, -1.5],
         "cubes": [cube(r, [-4.85, 28.8, -1.6], [0.25, 3.6, 0.25], "metal")]},
        {"name": "antena_punta", "parent": "antena", "pivot": [-4.75, 32.6, -1.5],
         "cubes": [cube(r, [-4.95, 32.4, -1.7], [0.45, 0.45, 0.45], "led_amber")]},
        {"name": "cable", "parent": "head", "pivot": [-4.5, 26.5, -4.6], "cubes": [
            cube(r, [-4.6, 26.4, -4.75], [0.9, 0.3, 0.3], "metal"),
            cube(r, [-4.6, 26.4, -4.75], [0.3, 0.3, 2.2], "metal"),
        ]},
        {"name": "rightItem", "pivot": [-6, 15, 1]},
        {"name": "sostenido", "parent": "rightItem", "pivot": [-6, 15, 1], "cubes": [
            cube(r, [-7.8, 14.0, -0.5], [3.6, 3.2, 0.5], "front", "side"),
            cube(r, [-9.0, 15.4, -0.4], [6.0, 0.5, 0.3], "strap"),
        ]},
        {"name": "sostenido_lente", "parent": "sostenido", "pivot": [-6, 15.6, -0.6],
         "cubes": [cube(r, [-6.5, 15.1, -0.7], [1.0, 1.0, 0.2], "lens")]},
    ]
    return geo("geometry.evilmorty.parche", 32, 32, bones)


def patch_texture():
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    px = img.load()
    r = PATCH_REG
    # Cara del parche: cuero negro con costura y brillo.
    u, v, w, h = r["front"]
    paint(px, r["front"], (44, 44, 50), (18, 18, 22), (70, 70, 78), (8, 8, 10))
    for x in range(2, w - 2, 2):
        px[u + x, v + 1] = px[u + x, v + h - 2] = (96, 96, 104, 255)
    for y in range(2, h - 2, 2):
        px[u + 1, v + y] = px[u + w - 2, v + y] = (96, 96, 104, 255)
    px[u + 3, v + 3] = px[u + 4, v + 3] = px[u + 3, v + 4] = (90, 90, 98, 255)
    paint(px, r["side"], (34, 34, 38), (14, 14, 16), dark=(6, 6, 8))
    paint(px, r["strap"], (40, 34, 30), (22, 18, 16), (60, 52, 46), (10, 8, 8))
    paint(px, r["metal"], (150, 156, 168), (78, 84, 96), (196, 202, 212), (48, 52, 60))
    paint(px, r["amber"], AMBER_HOT, AMBER_DEEP, (255, 236, 160), (150, 60, 0))
    paint(px, r["lens"], (255, 200, 70), (220, 110, 10), (255, 250, 210), (140, 50, 0))
    px[r["lens"][0] + 1, r["lens"][1] + 1] = (255, 255, 240, 255)
    paint(px, r["led"], (255, 90, 60), (200, 20, 10))
    paint(px, r["led_amber"], (255, 230, 120), (255, 150, 20))
    paint(px, r["buckle"], (210, 214, 222), (120, 126, 136), (240, 242, 246), (70, 74, 82))
    return img


# --- Mano de Rayo Láser (guante en el brazo derecho) ------------------------

GLOVE_REG = {
    "metal": (0, 0, 6, 6), "dark": (6, 0, 6, 6), "amber": (12, 0, 4, 4), "red": (16, 0, 4, 4),
    "finger": (20, 0, 3, 3), "panel": (0, 6, 8, 8),
}


def glove_geometry():
    r = GLOVE_REG
    fingers = [cube(r, [-8.1 + i * 1.05, 9.8, -2.1], [0.9, 1.4, 1.4], "finger") for i in range(4)]
    bones = [
        {"name": "rightArm", "pivot": [-5, 22, 0]},
        {"name": "guante", "parent": "rightArm", "pivot": [-5, 22, 0], "cubes": [
            cube(r, [-8.4, 14.2, -2.4], [4.8, 3.6, 4.8], "dark", "panel"),
            cube(r, [-8.55, 17.6, -2.55], [5.1, 0.9, 5.1], "amber"),
            cube(r, [-8.3, 11.2, -2.3], [4.6, 3.0, 4.6], "metal"),
            cube(r, [-8.0, 11.4, -2.6], [4.0, 0.8, 0.3], "dark"),
            cube(r, [-8.6, 11.6, -1.8], [0.3, 2.2, 3.6], "amber"),
            cube(r, [-3.9, 11.0, -1.6], [0.6, 1.6, 1.0], "finger"),
            cube(r, [-7.6, 12.0, 2.35], [0.4, 5.5, 0.4], "dark"),
            cube(r, [-5.6, 12.0, 2.35], [0.4, 5.5, 0.4], "dark"),
            cube(r, [-6.75, 9.2, -0.4], [1.5, 1.0, 1.5], "dark"),
        ] + fingers},
        {"name": "nucleo", "parent": "guante", "pivot": [-8.6, 15.8, 0],
         "cubes": [cube(r, [-8.85, 14.8, -1.0], [0.45, 2.0, 2.0], "amber")]},
        {"name": "lente", "parent": "guante", "pivot": [-6, 9.05, 0.35],
         "cubes": [cube(r, [-6.5, 8.9, -0.15], [1.0, 0.3, 1.0], "red")]},
    ]
    return geo("geometry.evilmorty.mano_laser", 32, 32, bones)


def glove_texture():
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    px = img.load()
    r = GLOVE_REG
    paint(px, r["metal"], (176, 184, 196), (92, 100, 114), (220, 226, 234), (56, 60, 70))
    paint(px, r["dark"], (70, 76, 88), (34, 38, 46), (96, 104, 118), (18, 20, 26))
    paint(px, r["amber"], AMBER_HOT, AMBER_DEEP, (255, 236, 160), (150, 60, 0))
    paint(px, r["red"], (255, 120, 80), (220, 30, 10), (255, 220, 200), (130, 10, 0))
    paint(px, r["finger"], (160, 168, 180), (100, 108, 120), (210, 216, 226), (60, 64, 74))
    u, v, w, h = r["panel"]
    paint(px, r["panel"], (66, 72, 84), (34, 38, 46), (96, 104, 118), (18, 20, 26))
    for x in range(1, w - 1):
        px[u + x, v + 3] = AMBER + (255,)
    for y in range(3, h - 1):
        px[u + 2, v + y] = AMBER + (255,)
    px[u + 5, v + 5] = AMBER_HOT + (255,)
    return img


# --- Cúpula del escudo (entidad) --------------------------------------------

DOME_REG = {"panel": (0, 0, 32, 32), "cap": (0, 0, 32, 32)}


def dome_geometry():
    radius, count, low, top_len, tilt = 20.0, 12, 24.0, 14.0, -35.0
    width = 2 * radius * math.tan(math.pi / count) + 0.2
    bones = [{"name": "domo", "pivot": [0, 0, 0]}]
    for i in range(count):
        bones.append({
            "name": f"panel_{i}", "parent": "domo", "pivot": [0, 0, 0], "rotation": [0, i * 360 / count, 0],
            "cubes": [
                cube(DOME_REG, [-width / 2, 0, -radius], [width, low, 0], "panel"),
                cube(DOME_REG, [-width / 2, low, -radius], [width, top_len, 0], "panel",
                     pivot=[0, low, -radius], rotation=[tilt, 0, 0]),
            ],
        })
    cap_y = low + top_len * math.cos(math.radians(-tilt))
    bones.append({"name": "tapa", "parent": "domo", "pivot": [0, cap_y, 0], "cubes": [
        cube(DOME_REG, [-10, cap_y, -10], [20, 0, 20], "cap"),
        cube(DOME_REG, [-10, cap_y, -10], [20, 0, 20], "cap", pivot=[0, cap_y, 0], rotation=[0, 45, 0]),
    ]})
    return geo("geometry.evilmorty.escudo_domo", 32, 32, bones, bounds=(4, 4, 1.5))


def dome_texture():
    img = Image.new("RGBA", (32, 32), AMBER + (40,))
    d = ImageDraw.Draw(img)
    # Rejilla hexagonal propia.
    for cx, cy in ((8, 8), (24, 8), (16, 22), (0, 22), (32, 22)):
        pts = [(cx + 7 * math.cos(math.radians(a)), cy + 7 * math.sin(math.radians(a))) for a in range(0, 360, 60)]
        d.polygon(pts, outline=AMBER_HOT + (190,))
    d.rectangle([0, 0, 31, 31], outline=AMBER_DEEP + (150,))
    return img


# --- Rayo láser (entidad) ---------------------------------------------------

BEAM_REG = {"core": (0, 0, 4, 4), "glow": (4, 0, 4, 4)}


def beam_geometry():
    r = BEAM_REG
    bones = [
        {"name": "rayo", "pivot": [0, 0, 0], "cubes": [cube(r, [-0.5, -0.5, -16], [1, 1, 16], "core")]},
        {"name": "brillo", "parent": "rayo", "pivot": [0, 0, 0],
         "cubes": [cube(r, [-1.25, -1.25, -16], [2.5, 2.5, 16], "glow")]},
    ]
    # Rayos de hasta 64 bloques: límites visibles amplios para que no se oculte.
    return geo("geometry.evilmorty.rayo_laser", 8, 4, bones, bounds=(130, 130, 0))


def beam_texture():
    img = Image.new("RGBA", (8, 4), (0, 0, 0, 0))
    px = img.load()
    # Núcleo: alfa 0 = emisivo con entity_emissive_alpha.
    fill(px, BEAM_REG["core"], (255, 240, 200, 0))
    fill(px, BEAM_REG["glow"], (255, 60, 20, 110))
    return img


# --- Iconos de inventario (32x32, con contorno y sombreado) ----------------

def outline(img, color=(10, 8, 6, 255)):
    src = img.copy()
    w, h = img.size
    sp, dp = src.load(), img.load()
    for x in range(w):
        for y in range(h):
            if sp[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and sp[nx, ny][3] > 128:
                    dp[x, y] = color
                    break
    return img


def icon_parche():
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Correa.
    d.line([(0, 9), (9, 12)], fill=(58, 48, 42, 255), width=3)
    d.line([(23, 12), (31, 10)], fill=(58, 48, 42, 255), width=3)
    d.point([(2, 9), (5, 10)], fill=AMBER_HOT + (255,))
    # Parche de cuero con degradado.
    for i in range(10):
        c = lerp((62, 62, 70), (16, 16, 20), i / 9)
        d.ellipse([6 + i // 3, 9 + i // 3, 26 - i // 2, 27 - i // 2], fill=c + (255,))
    # Costura.
    for a in range(0, 360, 30):
        x = 16 + 8.2 * math.cos(math.radians(a))
        y = 18 + 7.2 * math.sin(math.radians(a))
        d.point((round(x), round(y)), fill=(120, 120, 130, 255))
    # Anillo y lente ámbar.
    d.ellipse([11, 13, 21, 23], outline=AMBER + (255,), width=2)
    d.ellipse([14, 16, 18, 20], fill=(255, 200, 70, 255))
    d.point([(15, 17)], fill=(255, 255, 230, 255))
    # LED y módulo con antena.
    d.rectangle([22, 13, 23, 14], fill=(255, 70, 40, 255))
    d.rectangle([26, 16, 29, 23], fill=(120, 126, 138, 255))
    d.line([(26, 16), (26, 23)], fill=(180, 186, 196, 255))
    d.line([(28, 15), (28, 5)], fill=(150, 156, 168, 255))
    d.rectangle([27, 3, 29, 5], fill=AMBER_HOT + (255,))
    d.point([(27, 3)], fill=(255, 255, 230, 255))
    return outline(img)


def icon_mano():
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    steel_hi, steel, steel_lo = (214, 220, 230, 255), (150, 158, 172, 255), (86, 94, 108, 255)
    # Dedos.
    for i, top in enumerate((5, 3, 4, 7)):
        x = 9 + i * 4
        d.rectangle([x, top, x + 2, 13], fill=steel)
        d.line([(x, top), (x, 13)], fill=steel_hi)
        d.line([(x, 9), (x + 2, 9)], fill=steel_lo)
    # Pulgar.
    d.polygon([(5, 14), (8, 12), (10, 16), (8, 20), (5, 18)], fill=steel)
    d.line([(5, 14), (8, 12)], fill=steel_hi)
    # Dorso de la mano.
    d.rectangle([8, 12, 24, 23], fill=steel)
    d.line([(8, 12), (24, 12)], fill=steel_hi)
    d.line([(8, 12), (8, 23)], fill=steel_hi)
    d.line([(24, 13), (24, 23)], fill=steel_lo)
    d.rectangle([9, 13, 23, 14], fill=(70, 76, 88, 255))
    # Emisor rojo con anillo ámbar.
    d.ellipse([12, 15, 20, 23], fill=AMBER + (255,))
    d.ellipse([14, 17, 18, 21], fill=(255, 60, 30, 255))
    d.point([(15, 18)], fill=(255, 220, 200, 255))
    # Muñequera y antebrazo.
    d.rectangle([9, 24, 23, 25], fill=AMBER_HOT + (255,))
    d.rectangle([10, 26, 22, 31], fill=(60, 66, 78, 255))
    d.line([(10, 26), (22, 26)], fill=(96, 104, 118, 255))
    d.line([(13, 27), (13, 31)], fill=AMBER + (255,))
    d.line([(19, 27), (19, 31)], fill=AMBER + (255,))
    return outline(img)


# --- Iconos del menú (32x32) -------------------------------------------------

def menu_icon(kind):
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    line = AMBER_HOT + (255,)
    fillc = AMBER + (255,)
    if kind == "carpeta" or kind == "archivos":
        d.polygon([(3, 9), (12, 9), (15, 12), (29, 12), (29, 26), (3, 26)], fill=fillc, outline=line)
        d.line([(3, 14), (29, 14)], fill=AMBER_DEEP + (255,))
        if kind == "archivos":
            d.ellipse([18, 16, 25, 23], outline=(40, 20, 0, 255), width=2)
            d.line([(24, 22), (27, 25)], fill=(40, 20, 0, 255), width=2)
    elif kind == "escudo":
        d.arc([4, 6, 28, 34], 180, 360, fill=line, width=3)
        d.line([(4, 20), (28, 20)], fill=line, width=2)
        d.ellipse([13, 10, 19, 16], fill=fillc)
    elif kind == "modo":
        d.arc([5, 5, 27, 27], 30, 300, fill=line, width=3)
        d.polygon([(24, 4), (28, 12), (20, 11)], fill=fillc)
    elif kind == "vision":
        d.ellipse([3, 9, 29, 23], outline=line, width=2)
        d.ellipse([11, 10, 21, 22], fill=fillc)
        d.ellipse([14, 13, 18, 19], fill=(30, 15, 0, 255))
    elif kind == "ojo":
        d.rectangle([4, 6, 28, 26], outline=line, width=2)
        for x in (8, 24):
            d.line([(x, 10), (x, 22)], fill=fillc)
        d.ellipse([13, 13, 19, 19], outline=line, width=2)
    elif kind == "nocturna":
        d.ellipse([6, 5, 26, 25], fill=fillc)
        d.ellipse([12, 2, 30, 20], fill=(0, 0, 0, 0))
        d.point([(24, 22), (27, 17), (21, 26)], fill=line)
    elif kind == "cerrar":
        d.line([(8, 8), (24, 24)], fill=line, width=4)
        d.line([(24, 8), (8, 24)], fill=line, width=4)
    elif kind == "volver":
        d.polygon([(6, 16), (16, 7), (16, 12), (26, 12), (26, 20), (16, 20), (16, 25)], fill=fillc, outline=line)
    return img


# --- Interfaz del ojo (capa HUD) --------------------------------------------

def hud_overlay(w=640, h=360):
    """Capa holográfica ámbar original: marco con esquinas, retícula central,
    líneas de escaneo y barras de datos laterales. Centro transparente."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    a = AMBER + (230,)
    hot = AMBER_HOT + (255,)

    # Viñeta cálida en los bordes.
    vignette = Image.new("L", (w, h), 0)
    vd = ImageDraw.Draw(vignette)
    for i in range(40):
        vd.rectangle([i, i, w - 1 - i, h - 1 - i], outline=int(70 * (1 - i / 40)))
    tint = Image.new("RGBA", (w, h), AMBER_DEEP + (0,))
    tint.putalpha(vignette)
    img = Image.alpha_composite(img, tint)

    # Esquinas del marco.
    m, L = 14, 46
    for (x, y, sx, sy) in ((m, m, 1, 1), (w - m, m, -1, 1), (m, h - m, 1, -1), (w - m, h - m, -1, -1)):
        d.line([(x, y), (x + sx * L, y)], fill=a, width=3)
        d.line([(x, y), (x, y + sy * L)], fill=a, width=3)
        d.line([(x + sx * 6, y + sy * 6), (x + sx * 18, y + sy * 6)], fill=hot, width=1)

    # Barra superior con marcas.
    d.line([(w // 2 - 110, 18), (w // 2 + 110, 18)], fill=a, width=2)
    for i in range(-5, 6):
        x = w // 2 + i * 20
        d.line([(x, 18), (x, 24 if i % 5 else 28)], fill=a, width=1)
    d.polygon([(w // 2 - 5, 30), (w // 2 + 5, 30), (w // 2, 36)], fill=hot)

    # Barras de datos laterales.
    for i, length_ in enumerate((60, 42, 70, 30, 52)):
        y = h // 2 - 50 + i * 22
        d.rectangle([24, y, 24 + length_, y + 6], outline=a)
        d.rectangle([24, y, 24 + length_ * 2 // 3, y + 6], fill=AMBER + (120,))
        d.rectangle([w - 24 - length_, y, w - 24, y + 6], outline=a)
    d.line([(w - 150, h - 40), (w - 40, h - 40)], fill=a, width=2)
    d.line([(40, h - 40), (150, h - 40)], fill=a, width=2)

    # Retícula central.
    cx, cy = w // 2, h // 2
    d.ellipse([cx - 22, cy - 22, cx + 22, cy + 22], outline=a, width=2)
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        d.line([(cx + dx * 28, cy + dy * 28), (cx + dx * 40, cy + dy * 40)], fill=a, width=2)
    d.ellipse([cx - 2, cy - 2, cx + 2, cy + 2], fill=hot)
    d.arc([cx - 34, cy - 34, cx + 34, cy + 34], 200, 250, fill=hot, width=2)
    d.arc([cx - 34, cy - 34, cx + 34, cy + 34], 20, 70, fill=hot, width=2)

    blurred = glow.filter(ImageFilter.GaussianBlur(3))
    img = Image.alpha_composite(img, blurred)
    img = Image.alpha_composite(img, glow)

    # Líneas de escaneo muy suaves.
    scan = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(scan)
    for y in range(0, h, 4):
        sd.line([(0, y), (w, y)], fill=AMBER + (14,))
    return Image.alpha_composite(img, scan)


def pack_icon():
    img = Image.new("RGBA", (128, 128), (28, 14, 4, 255))
    d = ImageDraw.Draw(img)
    d.rectangle([6, 6, 121, 121], outline=AMBER + (255,), width=3)
    d.line([(14, 26), (114, 50)], fill=(30, 30, 34, 255), width=6)
    d.ellipse([34, 36, 82, 80], fill=(16, 16, 18, 255), outline=(60, 60, 66, 255), width=2)
    d.ellipse([70, 42, 76, 48], fill=AMBER_HOT + (255,))
    d.rectangle([22, 96, 106, 106], fill=AMBER + (255,))
    return img


def render_controllers():
    worn = "c.item_slot != 'main_hand' && c.item_slot != 'off_hand'"
    held = "c.item_slot == 'main_hand' || c.item_slot == 'off_hand'"
    visibility = [{"*": True}] + [{b: worn} for b in PATCH_WORN] + [{b: held} for b in PATCH_HELD]
    return {"format_version": "1.8.0", "render_controllers": {
        # Si c.item_slot no estuviera disponible, el parche se sigue viendo en la cabeza.
        "controller.render.evilmorty_parche": {
            "geometry": "Geometry.default", "materials": [{"*": "Material.default"}],
            "textures": ["Texture.default"], "part_visibility": visibility},
        "controller.render.evilmorty_rayo": {
            "geometry": "Geometry.default", "materials": [{"*": "Material.default"}, {"brillo": "Material.glow"}],
            "textures": ["Texture.default"]},
    }}


def main():
    write_json(RP / "models/entity/parche.geo.json", patch_geometry())
    write_json(RP / "models/entity/mano_laser.geo.json", glove_geometry())
    write_json(RP / "models/entity/escudo_domo.geo.json", dome_geometry())
    write_json(RP / "models/entity/rayo_laser.geo.json", beam_geometry())
    save(patch_texture(), RP / "textures/models/evilmorty/parche.png")
    save(glove_texture(), RP / "textures/models/evilmorty/mano_laser.png")
    save(dome_texture(), RP / "textures/entity/evilmorty/escudo_domo.png")
    save(beam_texture(), RP / "textures/entity/evilmorty/rayo_laser.png")
    save(icon_parche(), RP / "textures/items/evilmorty/parche.png")
    save(icon_mano(), RP / "textures/items/evilmorty/mano_laser.png")
    write_json(RP / "render_controllers/evilmorty.render_controllers.json", render_controllers())
    for kind in ("escudo", "modo", "vision", "nocturna", "archivos", "ojo", "cerrar", "carpeta", "volver"):
        save(menu_icon(kind), RP / f"textures/ui/evilmorty/{kind}.png")
    save(hud_overlay(), RP / "textures/ui/evilmorty/ojo_hud.png")
    save(pack_icon(), RP / "pack_icon.png")
    save(pack_icon(), BP / "pack_icon.png")
    print("Recursos generados en", ROOT)


if __name__ == "__main__":
    main()
