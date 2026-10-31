"""Genera el arte original del add-on Evil Morty (fan-made): modelos 3D, texturas,
partículas, interfaz del ojo, iconos y los JSON de render que dependen de ellos.

Uso (desde la carpeta EvilMortyAddon):  python source/build_assets.py
Requiere Pillow. Todo se dibuja aquí desde cero; no usa assets de terceros.
Vista previa de los modelos:  python source/preview_render.py salida.png
"""
import json
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
RP = ROOT / "RP"
BP = ROOT / "BP"

AMBER = (255, 170, 30)
AMBER_HOT = (255, 214, 90)
AMBER_DEEP = (200, 90, 10)
FACES = ("north", "south", "east", "west", "up", "down")


# --- Utilidades -----------------------------------------------------------------

def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def save(img, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path)


def clamp(v):
    return max(0, min(255, int(round(v))))


def lerp(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(len(a)))


def rgba(color, alpha=255):
    return (clamp(color[0]), clamp(color[1]), clamp(color[2]), clamp(alpha))


def r4(values):
    return [round(v, 4) for v in values]


class Tex:
    """Lienzo de textura con regiones con nombre."""

    def __init__(self, w, h, regions, seed=7):
        self.img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        self.px = self.img.load()
        self.reg = regions
        self.rand = random.Random(seed)

    def put(self, x, y, color, alpha=255):
        self.px[x, y] = rgba(color, alpha)

    def fill(self, name, top, bottom=None, alpha=255, noise=0.0):
        u, v, w, h = self.reg[name]
        bottom = bottom or top
        for y in range(h):
            base = lerp(top, bottom, y / max(h - 1, 1))
            for x in range(w):
                n = self.rand.uniform(-noise, noise) if noise else 0
                self.put(u + x, v + y, tuple(c + n for c in base), alpha)

    def bevel(self, name, light, dark):
        u, v, w, h = self.reg[name]
        for x in range(w):
            self.put(u + x, v, light)
            self.put(u + x, v + h - 1, dark)
        for y in range(h):
            self.put(u, v + y, light)
            self.put(u + w - 1, v + y, dark)

    def at(self, name, x, y, color, alpha=255):
        u, v, _, _ = self.reg[name]
        self.put(u + x, v + y, color, alpha)

    def radial(self, name, stops, rim=None):
        """Degradado radial; stops = [(radio_normalizado, color, alfa), ...]."""
        u, v, w, h = self.reg[name]
        cx, cy = (w - 1) / 2, (h - 1) / 2
        rmax = max(cx, cy) or 1
        for y in range(h):
            for x in range(w):
                d = math.hypot((x - cx) / (cx or 1), (y - cy) / (cy or 1))
                color, alpha = stops[-1][1], stops[-1][2]
                for (r0, c0, a0), (r1, c1, a1) in zip(stops, stops[1:]):
                    if r0 <= d <= r1:
                        t = (d - r0) / ((r1 - r0) or 1)
                        color, alpha = lerp(c0, c1, t), a0 + (a1 - a0) * t
                        break
                if d < stops[0][0]:
                    color, alpha = stops[0][1], stops[0][2]
                self.put(u + x, v + y, color, alpha)
        if rim:
            self.bevel(name, rim, rim)


def cube(reg, origin, size, faces, rest=None, **extra):
    """faces: nombre de región para todas las caras, o dict {cara: región} (+ rest)."""
    mapping = {f: faces for f in FACES} if isinstance(faces, str) else {f: faces.get(f, rest) for f in FACES}
    uv = {}
    for face, name in mapping.items():
        u, v, w, h = reg[name]
        uv[face] = {"uv": [u, v], "uv_size": [w, h]}
    data = {"origin": r4(origin), "size": r4(size), "uv": uv}
    for key, value in extra.items():
        data[key] = r4(value) if isinstance(value, (list, tuple)) else value
    return data


def geo(identifier, tw, th, bones, bounds=(2.5, 3, 1.5)):
    return {
        "format_version": "1.16.0",
        "minecraft:geometry": [{
            "description": {
                "identifier": identifier, "texture_width": tw, "texture_height": th,
                "visible_bounds_width": bounds[0], "visible_bounds_height": bounds[1],
                "visible_bounds_offset": [0, bounds[2], 0],
            },
            "bones": bones,
        }],
    }


def anim_file(animations):
    return {"format_version": "1.8.0", "animations": animations}


# =================================================================================
# PARCHE (casco). Las raíces "head" y "rightItem" se llaman igual que los huesos
# del jugador: así Bedrock une el modelo a la cabeza y a la mano.
# =================================================================================

PATCH_REG = {
    "placa": (0, 0, 24, 20), "cuero_lado": (24, 0, 4, 4), "metal": (28, 0, 8, 8),
    "metal_claro": (36, 0, 4, 4), "correa": (40, 0, 16, 4), "correa_lado": (56, 0, 4, 4),
    "lente": (0, 20, 10, 10), "led_rojo": (10, 20, 2, 2), "led_ambar": (12, 20, 2, 2),
    "modulo_lado": (16, 20, 16, 12), "modulo": (32, 20, 8, 8), "hebilla": (40, 20, 4, 8),
    "cable": (44, 20, 4, 4), "iris": (48, 20, 2, 2), "franja": (50, 20, 2, 2),
}
PATCH_WORN = ["parche", "carcasa", "lente", "iris", "led", "correa", "luz_1", "luz_2", "luz_3",
              "hebilla", "modulo", "franja_modulo", "antena", "antena_punta", "cable"]
PATCH_HELD = ["sostenido", "sostenido_lente"]
PATCH_GLOW = ["lente", "led", "luz_1", "luz_2", "luz_3", "franja_modulo", "antena_punta", "sostenido_lente"]


def patch_geometry():
    r = PATCH_REG
    y, h, t = 28.6, 0.6, 0.3
    strap = [
        cube(r, [-0.2, y, -4.85], [5.05, h, t], {"north": "correa"}, "correa_lado"),
        cube(r, [-4.85, y, -4.85], [0.9, h, t], {"north": "correa"}, "correa_lado"),
        cube(r, [4.55, y, -4.85], [t, h, 9.7], {"east": "correa", "west": "correa"}, "correa_lado"),
        cube(r, [-4.85, y, -4.85], [t, h, 9.7], {"east": "correa", "west": "correa"}, "correa_lado"),
        cube(r, [-4.85, y, 4.55], [9.7, h, t], {"south": "correa"}, "correa_lado"),
    ]
    housing = [
        cube(r, [-2.85, 28.2, -5.35], [1.6, 0.3, 0.3], "metal"),
        cube(r, [-2.85, 26.5, -5.35], [1.6, 0.3, 0.3], "metal"),
        cube(r, [-3.15, 26.5, -5.35], [0.3, 2.0, 0.3], "metal"),
        cube(r, [-1.25, 26.5, -5.35], [0.3, 2.0, 0.3], "metal"),
    ]
    iris = [
        cube(r, [-2.15, 27.85, -5.38], [0.2, 0.3, 0.05], "iris"),
        cube(r, [-2.15, 26.85, -5.38], [0.2, 0.3, 0.05], "iris"),
        cube(r, [-2.8, 27.4, -5.38], [0.3, 0.2, 0.05], "iris"),
        cube(r, [-1.6, 27.4, -5.38], [0.3, 0.2, 0.05], "iris"),
    ]
    bones = [
        {"name": "head", "pivot": [0, 24, 0]},
        {"name": "parche", "parent": "head", "pivot": [-2, 27.5, -4.85],
         "cubes": [cube(r, [-3.95, 25.9, -5.1], [3.9, 3.2, 0.5], {"north": "placa"}, "cuero_lado")]},
        {"name": "carcasa", "parent": "parche", "pivot": [-2.05, 27.5, -5.2], "cubes": housing},
        {"name": "lente", "parent": "parche", "pivot": [-2.05, 27.5, -5.25],
         "cubes": [cube(r, [-2.85, 26.8, -5.3], [1.6, 1.4, 0.1], "lente")]},
        {"name": "iris", "parent": "parche", "pivot": [-2.05, 27.5, -5.36], "cubes": iris},
        {"name": "led", "parent": "parche", "pivot": [-0.68, 28.5, -5.2],
         "cubes": [cube(r, [-0.85, 28.32, -5.22], [0.35, 0.35, 0.12], "led_rojo")]},
        {"name": "correa", "parent": "head", "pivot": [0, 28.9, 0], "cubes": strap},
        {"name": "hebilla", "parent": "head", "pivot": [4.9, 28.9, 0],
         "cubes": [cube(r, [4.82, 28.4, -0.9], [0.15, 1.0, 1.8], {"east": "hebilla"}, "metal")]},
        {"name": "modulo", "parent": "head", "pivot": [-5.0, 27.2, -0.5], "cubes": [
            cube(r, [-5.45, 25.6, -2.2], [0.9, 3.2, 3.4], {"west": "modulo_lado"}, "modulo"),
        ]},
        {"name": "franja_modulo", "parent": "modulo", "pivot": [-5.47, 27.78, -0.5],
         "cubes": [cube(r, [-5.5, 27.6, -1.9], [0.06, 0.35, 2.8], "franja")]},
        {"name": "antena", "parent": "modulo", "pivot": [-5.03, 28.8, 0.47], "cubes": [
            cube(r, [-5.25, 28.8, 0.25], [0.45, 0.4, 0.45], "metal"),
            cube(r, [-5.15, 29.2, 0.35], [0.25, 3.2, 0.25], "metal"),
        ]},
        {"name": "antena_punta", "parent": "antena", "pivot": [-5.03, 32.62, 0.47],
         "cubes": [cube(r, [-5.25, 32.4, 0.25], [0.45, 0.45, 0.45], "led_ambar")]},
        {"name": "cable", "parent": "head", "pivot": [-4.4, 26.4, -4.8], "cubes": [
            cube(r, [-4.85, 26.3, -4.95], [0.95, 0.28, 0.28], "cable"),
            cube(r, [-4.85, 26.3, -4.95], [0.28, 0.28, 2.8], "cable"),
        ]},
        {"name": "rightItem", "pivot": [-6, 15, 1]},
        {"name": "sostenido", "parent": "rightItem", "pivot": [-6, 15, 1], "cubes": [
            cube(r, [-7.95, 13.4, -0.6], [3.9, 3.2, 0.5], {"north": "placa"}, "cuero_lado"),
            cube(r, [-9.4, 15.0, -0.5], [6.8, 0.5, 0.3], {"north": "correa"}, "correa_lado"),
        ]},
        {"name": "sostenido_lente", "parent": "sostenido", "pivot": [-6, 15, -0.7],
         "cubes": [cube(r, [-6.8, 14.3, -0.7], [1.6, 1.4, 0.1], "lente")]},
    ]
    luces = []
    for i, x in enumerate((0.7, 1.5, 2.3), start=1):
        luces.append({"name": f"luz_{i}", "parent": "correa", "pivot": [x + 0.15, 28.9, -4.89],
                      "cubes": [cube(r, [x, 28.75, -4.92], [0.3, 0.3, 0.07], "led_ambar")]})
    bones[7:7] = luces
    return geo("geometry.evilmorty.parche", 64, 64, bones)


def paint_rounded_plate(t, name, radius=4):
    """Placa de cuero con borde metálico redondeado, costura y tornillos (cara frontal)."""
    u, v, w, h = t.reg[name]
    for y in range(h):
        for x in range(w):
            dx = max(radius - x, 0, x - (w - 1 - radius))
            dy = max(radius - y, 0, y - (h - 1 - radius))
            inside = radius - math.hypot(dx, dy) if dx and dy else min(x, y, w - 1 - x, h - 1 - y)
            if inside < -0.35:
                t.put(u + x, v + y, (0, 0, 0), 0)
                continue
            light = 1 - (x / w + y / h) / 2  # luz desde arriba a la izquierda
            if inside < 1.6:
                t.put(u + x, v + y, lerp((70, 74, 84), (168, 176, 190), light))
            elif inside < 2.6:
                t.put(u + x, v + y, (16, 15, 18))
            else:
                base = lerp((38, 36, 42), (20, 19, 23), y / h)
                sheen = 16 if 0 <= (x - y) - w * 0.2 < 3 else 0
                n = t.rand.uniform(-3, 3)
                t.put(u + x, v + y, tuple(c + sheen + n for c in base))
                if 3.4 <= inside < 4.4 and (x + y) % 2 == 0:
                    t.put(u + x, v + y, (92, 88, 98))
    for sx, sy in ((2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3)):
        t.put(u + sx, v + sy, (226, 230, 236))
        t.put(u + sx + 1, v + sy + 1, (96, 100, 110))
        t.put(u + sx + 1, v + sy, (170, 176, 186))
        t.put(u + sx, v + sy + 1, (170, 176, 186))


def patch_texture():
    t = Tex(64, 64, PATCH_REG, seed=11)
    paint_rounded_plate(t, "placa")
    t.fill("cuero_lado", (30, 28, 32), (16, 15, 18))
    t.fill("metal", (112, 118, 132), (58, 62, 72), noise=2)
    t.bevel("metal", (168, 174, 188), (34, 36, 42))
    t.fill("metal_claro", (214, 218, 226), (150, 156, 166))
    u, v, w, h = PATCH_REG["correa"]
    for x in range(w):
        t.put(u + x, v, (26, 22, 20))
        t.put(u + x, v + 1, (60, 50, 42))
        t.put(u + x, v + 2, (100, 88, 74) if x % 2 == 0 else (52, 44, 38))
        t.put(u + x, v + 3, (24, 20, 18))
    t.fill("correa_lado", (44, 38, 32), (24, 20, 18))
    t.radial("lente", [(0.0, (255, 252, 228), 0), (0.35, (255, 196, 70), 0), (0.7, (230, 110, 14), 30),
                       (0.9, (90, 40, 8), 200), (1.42, (28, 16, 8), 255)])
    t.at("lente", 3, 3, (255, 255, 255), 0)
    t.fill("led_rojo", (255, 70, 46), alpha=0)
    t.fill("led_ambar", (255, 200, 80), alpha=0)
    t.fill("modulo_lado", (70, 74, 86), (44, 48, 56), noise=2)
    t.bevel("modulo_lado", (122, 128, 142), (22, 24, 28))
    u, v, w, h = PATCH_REG["modulo_lado"]
    for row in (3, 5, 7):
        for x in range(3, w - 4):
            t.put(u + x, v + row, (14, 14, 18))
            t.put(u + x, v + row + 1, (96, 100, 112))
    for sx, sy in ((1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2)):
        t.put(u + sx, v + sy, (200, 204, 212))
    t.fill("modulo", (66, 70, 82), (42, 46, 54))
    t.bevel("modulo", (110, 116, 130), (24, 26, 30))
    t.fill("hebilla", (150, 156, 170), (92, 98, 112))
    t.bevel("hebilla", (206, 210, 220), (52, 56, 64))
    for y in range(2, 6):
        t.at("hebilla", 1, y, (30, 30, 34))
        t.at("hebilla", 2, y, (30, 30, 34))
    t.fill("cable", (24, 24, 28))
    for x in range(4):
        t.at("cable", x, 1, (196, 120, 24))
    t.fill("iris", (34, 30, 28))
    t.fill("franja", (255, 190, 60), alpha=0)
    return t.img


def patch_animations():
    def chase(phase):
        return f"math.mod(query.anim_time * 3 + {phase}, 3) < 1 ? 1.0 : 0.35"

    return anim_file({
        "animation.evilmorty.parche.idle": {
            "loop": True, "animation_length": 8.0,
            "bones": {
                "iris": {"rotation": [0, 0, "query.anim_time * 45"]},
                "lente": {"scale": ["1.0 + math.sin(query.anim_time * 180) * 0.06",
                                    "1.0 + math.sin(query.anim_time * 180) * 0.06", 1.0]},
                "led": {"scale": "math.mod(query.anim_time, 2.0) < 0.4 ? 1.0 : 0.15"},
                "luz_1": {"scale": chase(0)},
                "luz_2": {"scale": chase(2)},
                "luz_3": {"scale": chase(1)},
                "antena_punta": {"scale": "math.mod(query.anim_time + 1.0, 2.0) < 0.3 ? 1.35 : 0.85"},
                "franja_modulo": {"scale": [1.0, "1.0 + math.sin(query.anim_time * 90) * 0.25", 1.0]},
            },
        },
    })


# =================================================================================
# MANO DE RAYO LÁSER: guante unido a "rightArm" (tercera persona) y una copia
# interior unida a "rightItem" que solo se muestra en primera persona.
# =================================================================================

GLOVE_REG = {
    "antebrazo": (0, 0, 20, 18), "metal_oscuro": (20, 0, 8, 8), "placa_ext": (28, 0, 8, 14),
    "placa_frontal": (36, 0, 12, 14), "anillo": (48, 0, 16, 4), "mano": (0, 18, 20, 12),
    "nudillera": (20, 18, 16, 6), "dedo": (36, 18, 6, 6), "dedo_punta": (42, 18, 6, 6),
    "lente_roja": (48, 18, 8, 8), "nucleo": (56, 18, 8, 8), "tubo": (0, 30, 4, 16), "luz": (4, 30, 2, 8),
}
GLOVE_FP = ["guante_fp"]
GLOVE_GLOW = ["lente", "nucleo", "luces"]


def glove_hand_cubes(r, inset=0.0):
    i = inset
    cubes = [
        cube(r, [-8.35 + i, 10.8 + i, -2.35 + i], [4.7 - 2 * i, 3.0 - 2 * i, 4.7 - 2 * i],
             {"north": "mano", "south": "mano", "east": "mano", "west": "mano"}, "metal_oscuro"),
    ]
    for k in range(4):
        x0 = -8.15 + k * 1.08
        cubes.append(cube(r, [x0 + i, 9.7 + i, -2.3 + i], [0.95 - 2 * i, 1.1, 1.6 - 2 * i], "dedo"))
        cubes.append(cube(r, [x0 + 0.05 + i, 8.9 + i, -2.2 + i], [0.85 - 2 * i, 0.8, 1.4 - 2 * i], "dedo_punta"))
    return cubes


def glove_geometry():
    r = GLOVE_REG
    side = {"north": "antebrazo", "south": "antebrazo", "east": "antebrazo", "west": "antebrazo"}
    bones = [
        {"name": "rightArm", "pivot": [-5, 22, 0]},
        {"name": "guante", "parent": "rightArm", "pivot": [-6, 14, 0], "cubes": [
            cube(r, [-8.45, 14.4, -2.45], [4.9, 4.0, 4.9], side, "metal_oscuro"),
            cube(r, [-8.6, 18.4, -2.6], [5.2, 0.6, 5.2], "metal_oscuro"),
            cube(r, [-8.55, 13.7, -2.55], [5.1, 0.7, 5.1], "anillo"),
            cube(r, [-8.75, 14.9, -1.7], [0.3, 3.4, 3.4], {"west": "placa_ext"}, "metal_oscuro"),
            cube(r, [-7.6, 14.9, -2.75], [2.4, 3.4, 0.3], {"north": "placa_frontal"}, "metal_oscuro"),
            cube(r, [-8.15, 11.0, -2.7], [4.3, 1.3, 0.35], {"north": "nudillera"}, "metal_oscuro"),
            cube(r, [-3.75, 10.6, -2.0], [0.75, 2.0, 1.2], "dedo"),
            cube(r, [-3.7, 10.0, -1.9], [0.65, 0.6, 1.0], "dedo_punta"),
            cube(r, [-7.1, 10.0, -0.5], [2.2, 0.8, 2.2], "metal_oscuro"),
            cube(r, [-7.55, 11.6, 2.35], [0.5, 6.8, 0.5], "tubo"),
            cube(r, [-5.45, 11.6, 2.35], [0.5, 6.8, 0.5], "tubo"),
        ] + glove_hand_cubes(r)},
        {"name": "lente", "parent": "guante", "pivot": [-6.0, 9.92, 0.6],
         "cubes": [cube(r, [-6.7, 9.85, -0.1], [1.4, 0.15, 1.4], "lente_roja")]},
        {"name": "nucleo", "parent": "guante", "pivot": [-8.55, 12.25, -0.05],
         "cubes": [cube(r, [-8.75, 11.3, -1.0], [0.4, 1.9, 1.9], "nucleo")]},
        {"name": "luces", "parent": "guante", "pivot": [-6.2, 16.4, -2.48], "cubes": [
            cube(r, [-7.95, 15.0, -2.5], [0.25, 2.8, 0.05], "luz"),
            cube(r, [-4.85, 15.0, -2.5], [0.25, 2.8, 0.05], "luz"),
        ]},
        {"name": "rightItem", "pivot": [-6, 15, 1]},
        {"name": "guante_fp", "parent": "rightItem", "pivot": [-6, 15, 1],
         "cubes": glove_hand_cubes(r, inset=0.06)},
    ]
    return geo("geometry.evilmorty.mano_laser", 64, 64, bones)


def glove_texture():
    t = Tex(64, 64, GLOVE_REG, seed=23)
    t.fill("antebrazo", (86, 92, 106), (52, 56, 66), noise=2.5)
    t.bevel("antebrazo", (140, 146, 160), (24, 26, 32))
    u, v, w, h = GLOVE_REG["antebrazo"]
    for x in (6, 13):
        for y in range(1, h - 1):
            t.put(u + x, v + y, (24, 26, 32))
            t.put(u + x + 1, v + y, (118, 124, 138))
    for x in range(1, w - 1):
        t.put(u + x, v + 9, (24, 26, 32))
        t.put(u + x, v + 10, (118, 124, 138))
    for sx, sy in ((2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3), (9, 4), (9, 14)):
        t.put(u + sx, v + sy, (222, 226, 234))
        t.put(u + sx, v + sy + 1, (40, 42, 48))
    for k in range(5):
        t.put(u + 3 + k, v + 12 + k // 2, (150, 156, 170))
    t.fill("metal_oscuro", (52, 56, 66), (32, 34, 40), noise=1.5)
    t.bevel("metal_oscuro", (92, 98, 112), (18, 20, 24))
    t.fill("placa_ext", (170, 178, 192), (104, 110, 124))
    t.bevel("placa_ext", (220, 226, 236), (60, 64, 74))
    for row in (3, 8):
        for k in range(3):
            t.at("placa_ext", 2 + k, row + abs(1 - k), AMBER)
            t.at("placa_ext", 5 - k, row + abs(1 - k), AMBER)
    t.fill("placa_frontal", (176, 184, 198), (110, 116, 130))
    t.bevel("placa_frontal", (226, 230, 238), (62, 66, 76))
    for y in range(1, 13):
        t.at("placa_frontal", 5, y, (40, 42, 50))
        t.at("placa_frontal", 6, y, (40, 42, 50))
    for x, y in ((2, 3), (9, 3), (2, 10), (9, 10)):
        t.at("placa_frontal", x, y, AMBER_HOT)
    t.fill("anillo", AMBER_HOT, AMBER_DEEP)
    for x in range(0, 16, 4):
        for y in range(4):
            t.at("anillo", x, y, (90, 40, 6))
    t.fill("mano", (176, 184, 198), (112, 120, 134), noise=2)
    t.bevel("mano", (226, 230, 238), (60, 64, 74))
    for x in range(1, 19):
        t.at("mano", x, 4, (60, 64, 74))
        t.at("mano", x, 5, (210, 216, 226))
    for y in range(1, 11):
        t.at("mano", 10, y, (70, 74, 84))
    t.fill("nudillera", (56, 60, 70), (36, 38, 46))
    for x in (1, 5, 9, 13):
        t.at("nudillera", x, 2, (230, 234, 240))
        t.at("nudillera", x + 1, 2, (170, 176, 188))
        t.at("nudillera", x, 3, (150, 156, 168))
        t.at("nudillera", x + 1, 3, (90, 96, 108))
    t.fill("dedo", (176, 184, 198), (104, 110, 124))
    for x in range(6):
        t.at("dedo", x, 3, (52, 56, 66))
    t.fill("dedo_punta", (100, 106, 120), (60, 64, 74))
    for x in range(6):
        t.at("dedo_punta", x, 4, AMBER)
    t.radial("lente_roja", [(0.0, (255, 240, 230), 0), (0.4, (255, 80, 46), 0), (0.75, (170, 24, 10), 90),
                            (1.0, (60, 16, 10), 255), (1.42, (40, 14, 10), 255)])
    t.radial("nucleo", [(0.0, (255, 250, 220), 0), (0.45, (255, 180, 40), 0), (0.8, (220, 100, 10), 40),
                        (1.0, (60, 64, 74), 255), (1.42, (60, 64, 74), 255)])
    t.fill("tubo", (26, 26, 30))
    for y in range(0, 16, 4):
        for x in range(4):
            t.at("tubo", x, y, (200, 122, 22))
    for y in range(16):
        if y % 4:
            t.at("tubo", 1, y, (64, 64, 72))
    t.fill("luz", (255, 220, 120), (255, 150, 20), alpha=0)
    return t.img


def glove_animations():
    return anim_file({
        "animation.evilmorty.mano_laser.idle": {
            "loop": True, "animation_length": 2.0,
            "bones": {
                "nucleo": {"scale": "1.0 + math.sin(query.anim_time * 360) * 0.08"},
                "lente": {"scale": ["1.0 + math.sin(query.anim_time * 540) * 0.1", 1.0,
                                    "1.0 + math.sin(query.anim_time * 540) * 0.1"]},
                "luces": {"scale": [1.0, "math.mod(query.anim_time, 1.0) < 0.85 ? 1.0 : 0.6", 1.0]},
            },
        },
    })


# =================================================================================
# ESCUDO PROTECTOR: esfera geodésica translúcida, anillo de escaneo y anillo en el suelo.
# =================================================================================

DOME_REG = {"panel": (0, 0, 32, 32), "escaneo": (32, 0, 32, 4), "suelo": (32, 4, 32, 8)}
DOME_R, DOME_CY = 22.0, 14.0


def dome_geometry():
    r = DOME_REG
    n_lon, half = 16, 7.5
    bands = [-37.5, -22.5, -7.5, 7.5, 22.5, 37.5, 52.5, 67.5, 82.5]
    h = 2 * DOME_R * math.tan(math.radians(half)) * 1.02
    bones = [{"name": "domo", "pivot": [0, DOME_CY, 0]}]
    for i in range(n_lon):
        cubes = []
        for lat in bands:
            edge = max(0.0, abs(lat) - half)  # borde más cercano al ecuador: sin huecos
            w = 2 * DOME_R * math.cos(math.radians(edge)) * math.tan(math.pi / n_lon) * 1.02
            # Rotar en x por -latitud sube el panel tangente (convención comprobada en el juego).
            cubes.append(cube(r, [-w / 2, DOME_CY - h / 2, -DOME_R], [w, h, 0], "panel",
                              pivot=[0, DOME_CY, 0], rotation=[-lat, 0, 0]))
        bones.append({"name": f"gajo_{i}", "parent": "domo", "pivot": [0, DOME_CY, 0],
                      "rotation": [0, i * 360 / n_lon, 0], "cubes": cubes})
    ring_r = DOME_R * 1.012
    w = 2 * ring_r * math.tan(math.pi / 24) * 1.03
    bones.append({"name": "escaneo", "pivot": [0, DOME_CY, 0], "cubes": [
        cube(r, [-w / 2, DOME_CY - 0.35, -ring_r], [w, 0.7, 0], "escaneo",
             pivot=[0, DOME_CY, 0], rotation=[0, j * 15, 0]) for j in range(24)]})
    ground = math.sqrt(DOME_R ** 2 - DOME_CY ** 2)
    w = 2 * (ground + 1.5) * math.tan(math.pi / 16) * 1.05
    bones.append({"name": "suelo", "pivot": [0, 0.2, 0], "cubes": [
        cube(r, [-w / 2, 0.2, -(ground + 1.5)], [w, 0, 4], "suelo",
             pivot=[0, 0.2, 0], rotation=[0, j * 22.5, 0]) for j in range(16)]})
    return geo("geometry.evilmorty.escudo_domo", 64, 64, bones, bounds=(4, 4, 1.5))


def dome_texture():
    t = Tex(64, 64, DOME_REG, seed=5)
    u, v, w, h = DOME_REG["panel"]
    for y in range(h):
        for x in range(w):
            edge = min(x, y, w - 1 - x, h - 1 - y)
            # Borde suave (energía) en vez de una línea dura: se lee como burbuja, no como jaula.
            alpha = {0: 150, 1: 95, 2: 62}.get(edge, 18 + 40 * max(0.0, 1 - (edge - 3) / 8))
            color = (255, 214, 120) if edge < 2 else lerp((255, 160, 40), (255, 128, 24), y / h)
            t.put(u + x, v + y, color, alpha)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pts = [(15.5 + 7 * math.cos(math.radians(a)), 15.5 + 7 * math.sin(math.radians(a))) for a in range(30, 390, 60)]
    d.polygon(pts, outline=(255, 200, 90, 46))
    t.img.alpha_composite(img, (u, v))
    t.px = t.img.load()
    u, v, w, h = DOME_REG["escaneo"]
    for y in range(h):
        for x in range(w):
            t.put(u + x, v + y, (255, 226, 140), (230, 255, 255, 230)[y])
    u, v, w, h = DOME_REG["suelo"]
    for y in range(h):
        a = 170 * math.sin(math.pi * (y + 0.5) / h)
        for x in range(w):
            t.put(u + x, v + y, (255, 180, 50), a)
    return t.img


def dome_animations():
    wave = "math.sin(query.life_time * 80) * 16"
    ring = f"math.sqrt(math.max(0.0, 1 - math.pow({wave} / {DOME_R}, 2)))"
    grow = "math.min(query.life_time * 4, 1)"
    return anim_file({
        "animation.evilmorty.escudo_domo.idle": {
            "loop": True,
            "bones": {
                "domo": {"rotation": [0, "query.life_time * 12", 0],
                         "scale": f"{grow} * (1 + math.sin(query.life_time * 140) * 0.012)"},
                "escaneo": {"position": [0, wave, 0], "scale": [f"{grow} * {ring}", grow, f"{grow} * {ring}"]},
                "suelo": {"rotation": [0, "-query.life_time * 30", 0], "scale": grow},
            },
        },
    })


# =================================================================================
# RAYO LÁSER: núcleo emisivo, dos capas de brillo y una espiral de energía.
# =================================================================================

BEAM_REG = {"nucleo": (0, 0, 8, 8), "brillo1": (8, 0, 8, 8), "brillo2": (16, 0, 8, 8), "espiral": (24, 0, 8, 8)}


def beam_geometry():
    r = BEAM_REG
    bones = [
        {"name": "rayo", "pivot": [0, 0, 0], "cubes": [cube(r, [-0.35, -0.35, -16], [0.7, 0.7, 16], "nucleo")]},
        {"name": "brillo_interno", "parent": "rayo", "pivot": [0, 0, 0],
         "cubes": [cube(r, [-0.9, -0.9, -16], [1.8, 1.8, 16], "brillo1")]},
        {"name": "brillo_externo", "parent": "rayo", "pivot": [0, 0, 0],
         "cubes": [cube(r, [-1.7, -1.7, -16], [3.4, 3.4, 16], "brillo2")]},
        {"name": "espiral", "parent": "rayo", "pivot": [0, 0, 0], "cubes": [
            cube(r, [-1.25, -0.1, -16], [0.2, 0.2, 16], "espiral"),
            cube(r, [1.05, -0.1, -16], [0.2, 0.2, 16], "espiral"),
        ]},
    ]
    # Rayos de hasta 64 bloques: límites visibles amplios para que no se oculten.
    return geo("geometry.evilmorty.rayo_laser", 32, 16, bones, bounds=(130, 130, 0))


def beam_texture():
    t = Tex(32, 16, BEAM_REG, seed=3)
    t.fill("nucleo", (255, 250, 228), alpha=0, noise=4)
    t.fill("brillo1", (255, 146, 44), alpha=150, noise=6)
    t.fill("brillo2", (255, 64, 22), alpha=55)
    t.fill("espiral", (255, 214, 130), alpha=210)
    return t.img


def beam_animations():
    width = "(1 + query.property('evilmorty:nivel') * 0.3) * (1 + math.sin(query.life_time * 2400) * 0.12)"
    return anim_file({
        "animation.evilmorty.rayo_laser.idle": {
            "loop": True,
            "bones": {
                "rayo": {"rotation": ["query.property('evilmorty:pitch')",
                                      "query.property('evilmorty:yaw') - query.body_y_rotation", 0],
                         "scale": [width, width, "query.property('evilmorty:longitud')"]},
                "espiral": {"rotation": [0, 0, "query.life_time * 1440"]},
            },
        },
    })


# =================================================================================
# PARTÍCULAS: atlas propio (blanco, se tiñe en cada efecto).
# =================================================================================

PART_REG = {"brillo": (0, 0, 16, 16), "anillo": (16, 0, 16, 16), "hex": (32, 0, 16, 16),
            "estrella": (48, 0, 16, 16), "humo": (0, 16, 16, 16), "chispa": (16, 16, 8, 8)}


def particle_atlas():
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    px = img.load()

    def region(name, fn):
        u, v, w, h = PART_REG[name]
        for y in range(h):
            for x in range(w):
                a = fn((x + 0.5) / w * 2 - 1, (y + 0.5) / h * 2 - 1)
                px[u + x, v + y] = (255, 255, 255, clamp(a * 255))

    region("brillo", lambda x, y: math.exp(-((x * x + y * y) * 4.5)))
    region("anillo", lambda x, y: math.exp(-((math.hypot(x, y) - 0.72) ** 2) * 160))

    def hexa(x, y):
        a = math.atan2(y, x)
        rr = math.hypot(x, y)
        edge = 0.78 * math.cos(math.pi / 6) / math.cos((a % (math.pi / 3)) - math.pi / 6)
        return max(math.exp(-((rr - edge) ** 2) * 220), 0.16 if rr < edge else 0)

    region("hex", hexa)
    region("estrella", lambda x, y: min(1, math.exp(-abs(x) * 9) * math.exp(-abs(y) * 1.6)
                                        + math.exp(-abs(y) * 9) * math.exp(-abs(x) * 1.6)
                                        + math.exp(-(x * x + y * y) * 10)))
    rand = random.Random(9)
    blobs = [(rand.uniform(-0.4, 0.4), rand.uniform(-0.4, 0.4), rand.uniform(0.25, 0.45)) for _ in range(6)]
    region("humo", lambda x, y: min(0.85, sum(math.exp(-(((x - bx) ** 2 + (y - by) ** 2) / (s * s)) * 2)
                                              for bx, by, s in blobs) * 0.45))
    region("chispa", lambda x, y: min(1, math.exp(-(x * x + y * y) * 6) + math.exp(-abs(x) * 12) * 0.5
                                      * math.exp(-abs(y) * 3)))
    return img


def particle(name, sprite, material, comps):
    u, v, w, h = PART_REG[sprite]
    for key, comp in comps.items():
        if key == "minecraft:particle_appearance_billboard":
            comp.setdefault("facing_camera_mode", "lookat_xyz")
            comp["uv"] = {"texture_width": 64, "texture_height": 64, "uv": [u, v], "uv_size": [w, h]}
    write_json(RP / f"particles/{name}.particle.json", {
        "format_version": "1.10.0",
        "particle_effect": {
            "description": {"identifier": f"evilmorty:{name}",
                            "basic_render_parameters": {"material": material, "texture": "textures/particle/evilmorty"}},
            "components": {"minecraft:emitter_lifetime_once": {"active_time": 0.1}, **comps},
        },
    })


def tint(a, b, c=None):
    grad = {"0.0": a, "1.0": b} if c is None else {"0.0": a, "0.5": b, "1.0": c}
    return {"color": {"gradient": grad, "interpolant": "variable.particle_age / variable.particle_lifetime"}}


FADE = "(1 - variable.particle_age / variable.particle_lifetime)"


def bb(start, end=None):
    if end is None:
        return {"size": [start, start]}
    s = f"({start} + ({end} - {start}) * variable.particle_age / variable.particle_lifetime)"
    return {"size": [s, s]}


def write_particles():
    instant = lambda n: {"minecraft:emitter_rate_instant": {"num_particles": n}}
    life = lambda t: {"minecraft:particle_lifetime_expression": {"max_lifetime": t}}
    speed = lambda s: {"minecraft:particle_initial_speed": s}
    motion = lambda **k: {"minecraft:particle_motion_dynamic": k}
    shape = lambda kind, **k: {f"minecraft:emitter_shape_{kind}": k}
    look = lambda d: {"minecraft:particle_appearance_billboard": d}
    color = lambda c: {"minecraft:particle_appearance_tinting": c}

    particle("prediccion_punto", "brillo", "particles_add", {
        **instant(1), **shape("point"), **life(0.55), **speed(0), **motion(),
        **look(bb(f"0.16 * {FADE}")), **color(tint("#FFFFD27A", "#00FF8C1E"))})
    particle("prediccion_fin", "anillo", "particles_add", {
        **instant(1), **shape("point"), **life(0.55), **speed(0), **motion(),
        **look(bb(0.75, 0.45)), **color(tint("#FFFFE08C", "#00FF8C1E"))})
    particle("escudo_activar", "hex", "particles_add", {
        **instant(36), **shape("sphere", radius=1.35, surface_only=True, direction="outwards"),
        **life("0.6 + variable.particle_random_1 * 0.4"), **speed(0.4), **motion(linear_drag_coefficient=2),
        **look(bb(0.32, 0.05)), **color(tint("#FFFFE6A0", "#CCFFAA1E", "#00C85A0A"))})
    particle("escudo_impacto", "hex", "particles_add", {
        **instant(14), **shape("sphere", radius=1.3, surface_only=True), **life(0.35), **speed(0), **motion(),
        **look(bb(0.45, 0.2)), **color(tint("#FFFFF0C8", "#00FF8C1E"))})
    particle("proyectil_destruido", "chispa", "particles_add", {
        **instant(16), **shape("sphere", radius=0.15, direction="outwards"),
        **life("0.3 + variable.particle_random_1 * 0.3"), **speed(3.5), **motion(linear_drag_coefficient=4),
        **look(bb(0.14, 0.02)), **color(tint("#FFFFF0B4", "#FFFF6A1E", "#00B4280A"))})
    particle("proyectil_reflejado", "estrella", "particles_add", {
        **instant(6), **shape("sphere", radius=0.1, direction="outwards"), **life(0.3), **speed(2.5),
        **motion(linear_drag_coefficient=5), **look(bb(0.35, 0.05)), **color(tint("#FFFFFFFF", "#00FFC24A"))})
    particle("laser_destello", "estrella", "particles_add", {
        **instant(2), **shape("point"), **life(0.14), **speed(0), **motion(),
        **look(bb(0.7, 0.1)), **color(tint("#FFFFF6DC", "#00FF3C14"))})
    particle("laser_impacto", "brillo", "particles_add", {
        **instant(2), **shape("point"), **life(0.22), **speed(0), **motion(),
        **look(bb(1.1, 0.2)), **color(tint("#FFFFF0C8", "#FFFF6A1E", "#00B4140A"))})
    particle("laser_chispas", "chispa", "particles_add", {
        **instant(18), **shape("sphere", radius=0.1, direction="outwards"),
        **life("0.35 + variable.particle_random_1 * 0.35"), **speed("3 + variable.particle_random_2 * 3"),
        **motion(linear_acceleration=[0, -9, 0], linear_drag_coefficient=2.5),
        **look(bb(0.12, 0.03)), **color(tint("#FFFFF0B4", "#FFFF8C1E", "#00C8280A"))})
    particle("laser_estela", "brillo", "particles_add", {
        **instant("math.min(variable.longitud * 2.5, 100)"),
        **shape("custom", offset=["variable.dir_x * variable.longitud * variable.particle_random_1",
                                  "variable.dir_y * variable.longitud * variable.particle_random_1",
                                  "variable.dir_z * variable.longitud * variable.particle_random_1"],
                direction=["variable.particle_random_2 - 0.5", "variable.particle_random_3 - 0.5",
                           "variable.particle_random_4 - 0.5"]),
        **life("0.18 + variable.particle_random_2 * 0.25"), **speed(0.4), **motion(linear_drag_coefficient=3),
        **look(bb(0.16, 0.02)), **color(tint("#FFFFE6AA", "#FFFF7828", "#00C8280A"))})
    particle("mejora", "estrella", "particles_add", {
        **instant(28), **shape("disc", radius=0.9, plane_normal="y", surface_only=True, direction="inwards"),
        **life("0.8 + variable.particle_random_1 * 0.5"), **speed(0.5),
        **motion(linear_acceleration=[0, 2.6, 0], linear_drag_coefficient=1),
        **look(bb(0.22, 0.04)), **color(tint("#FF8CF0FF", "#FFFFD25A", "#00FF8C1E"))})
    particle("parche_destello", "estrella", "particles_add", {
        **instant(1), **shape("point"), **life(0.35), **speed(0), **motion(),
        **look(bb(0.16, 0.02)), **color(tint("#FFFFE6A0", "#00FF961E"))})
    particle("parche_activar", "anillo", "particles_add", {
        **instant(3), **shape("point"), **life("0.35 + variable.particle_random_1 * 0.25"), **speed(0), **motion(),
        **look(bb(0.1, 1.3)), **color(tint("#FFFFE6A0", "#00FF8C1E"))})
    particle("escudo_humo", "humo", "particles_alpha", {
        **instant(10), **shape("sphere", radius=1.0, direction="outwards"),
        **life("0.8 + variable.particle_random_1 * 0.4"), **speed(0.3),
        **motion(linear_acceleration=[0, 0.5, 0], linear_drag_coefficient=1.5),
        **look(bb(0.4, 0.9)), **color(tint("#88402A14", "#00402A14"))})


# =================================================================================
# INTERFAZ DEL OJO: piezas ancladas a la pantalla (no se deforman ni dejan franjas).
# =================================================================================

def glow_layer(draw_fn, size, blur=2.2, strength=1.0):
    base = Image.new("RGBA", size, (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(base))
    halo = base.filter(ImageFilter.GaussianBlur(blur))
    if strength != 1.0:
        a = halo.getchannel("A").point(lambda p: clamp(p * strength))
        halo.putalpha(a)
    out = Image.alpha_composite(Image.new("RGBA", size, (0, 0, 0, 0)), halo)
    return Image.alpha_composite(out, base)


def hud_corner():
    s = 48

    def draw(d):
        d.line([(3, 3), (34, 3)], fill=AMBER + (240,), width=2)
        d.line([(3, 3), (3, 34)], fill=AMBER + (240,), width=2)
        d.line([(8, 8), (18, 8)], fill=AMBER_HOT + (255,), width=1)
        d.line([(8, 8), (8, 18)], fill=AMBER_HOT + (255,), width=1)
        for k in range(3):
            d.point([(38 + k * 3, 3)], fill=AMBER + (200,))
            d.point([(3, 38 + k * 3)], fill=AMBER + (200,))
        d.rectangle([12, 12, 13, 13], fill=AMBER_HOT + (255,))

    return glow_layer(draw, (s, s), blur=1.8, strength=1.3)


def hud_reticle():
    s = 64
    c = s / 2

    def draw(d):
        for a0 in (20, 110, 200, 290):
            d.arc([c - 16, c - 16, c + 16, c + 16], a0, a0 + 50, fill=AMBER + (230,), width=2)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            d.line([(c + dx * 21, c + dy * 21), (c + dx * 27, c + dy * 27)], fill=AMBER + (220,), width=2)
        d.ellipse([c - 1.5, c - 1.5, c + 1.5, c + 1.5], fill=AMBER_HOT + (255,))

    return glow_layer(draw, (s, s), blur=2.0, strength=1.2)


def hud_signal():
    img_size = (40, 16)

    def draw(d):
        for k in range(5):
            x = 2 + k * 7
            top = 12 - k * 2
            fill = AMBER_HOT + (255,) if k < 4 else AMBER + (90,)
            d.rectangle([x, top, x + 4, 13], fill=fill)

    return glow_layer(draw, img_size, blur=1.4)


def hud_scanlines():
    img = Image.new("RGBA", (2, 4), (0, 0, 0, 0))
    for x in range(2):
        img.putpixel((x, 0), (255, 176, 48, 20))
    return img


def hud_vignette():
    w, h = 128, 72
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = img.load()
    for y in range(h):
        for x in range(w):
            ex = min(x, w - 1 - x) / (w * 0.14)
            ey = min(y, h - 1 - y) / (h * 0.16)
            e = min(ex, ey)
            a = 0 if e >= 1 else 60 * (1 - e) ** 2
            px[x, y] = (255, 140, 30, clamp(a))
    return img


def hud_json():
    piece = lambda **k: {"type": "image", "layer": 1, **k}
    corner = lambda tex, anchor, off: piece(texture=f"textures/ui/evilmorty/{tex}", size=[30, 30],
                                            anchor_from=anchor, anchor_to=anchor, offset=off)
    return {
        "namespace": "hud",
        "root_panel": {"modifications": [{
            "array_name": "controls", "operation": "insert_front",
            "value": [{"evilmorty_ojo@hud.evilmorty_ojo": {}}],
        }]},
        "evilmorty_ojo": {
            "type": "panel", "size": ["100%", "100%"], "layer": 1,
            "bindings": [
                {"binding_name": "#hud_title_text_string"},
                {"binding_type": "view",
                 "source_property_name": "(not ((#hud_title_text_string - 'evilmorty:ojo_on') = #hud_title_text_string))",
                 "target_property_name": "#visible"},
            ],
            "controls": [
                {"vineta": piece(texture="textures/ui/evilmorty/hud_vineta", size=["100%", "100%"],
                                 keep_ratio=False, alpha=0.8)},
                {"lineas": piece(texture="textures/ui/evilmorty/hud_lineas", size=["100%", "100%"],
                                 tiled=True, keep_ratio=False)},
                {"esquina_si": corner("hud_esquina_si", "top_left", [3, 3])},
                {"esquina_sd": corner("hud_esquina_sd", "top_right", [-3, 3])},
                {"esquina_ii": corner("hud_esquina_ii", "bottom_left", [3, -3])},
                {"esquina_id": corner("hud_esquina_id", "bottom_right", [-3, -3])},
                {"reticula": piece(texture="textures/ui/evilmorty/hud_reticula", size=[30, 30],
                                   anchor_from="center", anchor_to="center", alpha=0.8)},
                {"senal": piece(texture="textures/ui/evilmorty/hud_senal", size=[20, 8],
                                anchor_from="top_right", anchor_to="top_right", offset=[-13, 13])},
                {"etiqueta": {"type": "label", "layer": 2, "text": "EVIL MORTY // PARCHE",
                              "color": [1.0, 0.72, 0.25], "font_scale_factor": 0.75, "shadow": False,
                              "size": ["default", "default"], "anchor_from": "top_left",
                              "anchor_to": "top_left", "offset": [13, 13]}},
            ],
        },
    }


# =================================================================================
# ICONOS (32x32, pixel art con contorno) e icono del paquete.
# =================================================================================

def outline(img, color=(12, 8, 6, 255)):
    src = img.copy()
    w, h = img.size
    sp, dp = src.load(), img.load()
    for x in range(w):
        for y in range(h):
            if sp[x, y][3] > 40:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and sp[nx, ny][3] > 128:
                    dp[x, y] = color
                    break
    return img


def soft_glow(img, color, center, radius, alpha=120):
    halo = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(halo).ellipse([center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius],
                                 fill=color + (alpha,))
    halo = halo.filter(ImageFilter.GaussianBlur(radius / 2))
    return Image.alpha_composite(halo, img)


def icon_parche():
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    strap, strap_hi = (66, 54, 46, 255), (104, 90, 76, 255)
    d.line([(0, 12), (8, 13)], fill=strap, width=3)
    d.line([(24, 13), (31, 12)], fill=strap, width=3)
    for x in (1, 4):
        d.point((x, 12), fill=strap_hi)
    d.point((27, 12), fill=strap_hi)
    d.rectangle([29, 10, 30, 15], fill=(212, 216, 224, 255))
    # Placa redondeada con borde metálico.
    d.rounded_rectangle([6, 7, 25, 25], radius=5, fill=(150, 156, 170, 255))
    d.rounded_rectangle([7, 8, 25, 25], radius=5, fill=(70, 74, 86, 255))
    d.rounded_rectangle([7, 8, 24, 24], radius=4, fill=(110, 116, 130, 255))
    d.rounded_rectangle([8, 9, 23, 23], radius=4, fill=(30, 28, 34, 255))
    for k in range(10):
        d.point((10 + k, 22 - k), fill=(46, 44, 52, 255))
    for x, y in ((9, 10), (22, 10), (9, 22), (22, 22)):
        d.point((x, y), fill=(226, 230, 236, 255))
    for k in range(0, 13, 2):
        d.point((10 + k, 11), fill=(88, 84, 94, 255))
    # Lente ámbar con carcasa y retícula.
    d.ellipse([11, 11, 20, 20], fill=(60, 64, 74, 255))
    d.ellipse([12, 12, 19, 19], fill=(230, 120, 16, 255))
    d.ellipse([13, 13, 18, 18], fill=(255, 196, 70, 255))
    d.ellipse([14, 14, 17, 17], fill=(255, 244, 200, 255))
    for p in ((15, 12), (15, 19), (12, 15), (19, 15)):
        d.point(p, fill=(40, 30, 24, 255))
    d.point((14, 14), fill=(255, 255, 255, 255))
    d.rectangle([21, 10, 22, 11], fill=(255, 70, 46, 255))
    # Módulo y antena.
    d.rectangle([2, 15, 5, 22], fill=(70, 74, 86, 255))
    d.line([(2, 15), (2, 22)], fill=(130, 136, 150, 255))
    for y in (17, 19):
        d.line([(3, y), (4, y)], fill=(20, 20, 24, 255))
    d.line([(4, 14), (4, 4)], fill=(140, 146, 160, 255))
    d.rectangle([3, 2, 5, 4], fill=(255, 210, 90, 255))
    d.point((3, 2), fill=(255, 255, 230, 255))
    img = outline(img)
    img = soft_glow(img, (255, 170, 40), (15.5, 15.5), 6, 90)
    return soft_glow(img, (255, 190, 60), (4, 3), 3, 110)


def icon_mano():
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    hi, mid, lo = (222, 228, 238, 255), (160, 168, 182, 255), (92, 100, 114, 255)
    for k, top in enumerate((6, 4, 5, 8)):
        x = 9 + k * 4
        d.rectangle([x, top, x + 2, 13], fill=mid)
        d.line([(x, top), (x, 13)], fill=hi)
        d.line([(x + 2, top + 1), (x + 2, 13)], fill=lo)
        d.line([(x, top + 3), (x + 2, top + 3)], fill=(56, 60, 70, 255))
        d.line([(x, top), (x + 2, top)], fill=AMBER + (255,))
    d.polygon([(4, 15), (8, 12), (10, 16), (8, 21), (4, 19)], fill=mid)
    d.line([(4, 15), (8, 12)], fill=hi)
    d.rectangle([8, 12, 24, 23], fill=mid)
    d.line([(8, 12), (24, 12)], fill=hi)
    d.line([(8, 12), (8, 23)], fill=hi)
    d.line([(24, 13), (24, 23)], fill=lo)
    d.rectangle([9, 13, 23, 15], fill=(56, 60, 70, 255))
    for x in (10, 14, 18, 22):
        d.point((x, 14), fill=hi)
    d.ellipse([12, 16, 20, 24], fill=(60, 64, 74, 255))
    d.ellipse([13, 17, 19, 23], fill=(230, 120, 16, 255))
    d.ellipse([14, 18, 18, 22], fill=(255, 214, 110, 255))
    d.point((15, 19), fill=(255, 255, 235, 255))
    d.rectangle([8, 24, 24, 25], fill=AMBER_HOT + (255,))
    d.line([(8, 25), (24, 25)], fill=AMBER_DEEP + (255,))
    d.rectangle([9, 26, 23, 31], fill=(58, 62, 74, 255))
    d.line([(9, 26), (23, 26)], fill=(110, 116, 130, 255))
    d.line([(12, 27), (12, 31)], fill=(255, 200, 80, 255))
    d.line([(20, 27), (20, 31)], fill=(255, 200, 80, 255))
    d.line([(27, 2), (30, 5)], fill=(255, 90, 50, 255))
    d.point((26, 1), fill=(255, 220, 200, 255))
    img = outline(img)
    img = soft_glow(img, (255, 170, 40), (16, 20), 6, 90)
    return soft_glow(img, (255, 60, 30), (28, 3), 3, 120)


def badge(glyph):
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([1, 1, 30, 30], radius=6, fill=(30, 20, 10, 235), outline=AMBER + (255,), width=1)
    d.rounded_rectangle([3, 3, 28, 28], radius=5, outline=(90, 54, 14, 255), width=1)
    layer = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    glyph(ImageDraw.Draw(layer), AMBER_HOT + (255,), AMBER + (255,))
    halo = layer.filter(ImageFilter.GaussianBlur(1.2))
    img = Image.alpha_composite(img, halo)
    return Image.alpha_composite(img, layer)


def glyph_escudo(d, hot, amb):
    d.polygon([(16, 6), (25, 9), (24, 18), (16, 26), (8, 18), (7, 9)], outline=hot, width=2)
    d.polygon([(16, 10), (21, 12), (20, 17), (16, 22), (12, 17), (11, 12)], fill=amb)


def glyph_archivos(d, hot, amb):
    d.polygon([(6, 10), (13, 10), (15, 12), (26, 12), (26, 24), (6, 24)], fill=amb, outline=hot)
    d.line([(6, 15), (26, 15)], fill=(120, 60, 8, 255))
    d.ellipse([16, 16, 22, 22], outline=(40, 20, 0, 255), width=2)
    d.line([(21, 21), (24, 24)], fill=(40, 20, 0, 255), width=2)


def glyph_ajustes(d, hot, amb):
    for k in range(8):
        a = math.radians(k * 45)
        d.line([(16 + 7 * math.cos(a), 16 + 7 * math.sin(a)), (16 + 10 * math.cos(a), 16 + 10 * math.sin(a))],
               fill=hot, width=3)
    d.ellipse([9, 9, 23, 23], outline=hot, width=3)
    d.ellipse([14, 14, 18, 18], fill=amb)


def glyph_vision(d, hot, amb):
    d.ellipse([5, 10, 27, 22], outline=hot, width=2)
    d.ellipse([12, 11, 20, 21], fill=amb)
    d.ellipse([14, 14, 18, 18], fill=(40, 20, 0, 255))


def glyph_volver(d, hot, amb):
    d.polygon([(7, 16), (16, 8), (16, 12), (25, 12), (25, 20), (16, 20), (16, 24)], fill=amb, outline=hot)


def glyph_carpeta(d, hot, amb):
    d.polygon([(6, 10), (13, 10), (15, 12), (26, 12), (26, 24), (6, 24)], fill=amb, outline=hot)
    d.line([(6, 15), (26, 15)], fill=(120, 60, 8, 255))


def glyph_amenaza(d, hot, amb):
    d.polygon([(16, 6), (27, 25), (5, 25)], outline=hot, width=2)
    d.line([(16, 12), (16, 19)], fill=amb, width=3)
    d.rectangle([15, 21, 17, 23], fill=amb)


def glyph_jugador(d, hot, amb):
    d.ellipse([11, 6, 21, 16], outline=hot, width=2)
    d.pieslice([7, 16, 25, 34], 180, 360, fill=amb)


def pack_icon():
    s = 256
    img = Image.new("RGBA", (s, s), (0, 0, 0, 255))
    px = img.load()
    for y in range(s):
        for x in range(s):
            d = math.hypot(x - s / 2, y - s / 2) / (s / 2)
            px[x, y] = rgba(lerp((54, 30, 10), (10, 6, 4), min(1, d)))
    glow = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    g.ellipse([70, 70, 186, 186], fill=(255, 150, 30, 150))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(30)))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([58, 64, 198, 192], radius=34, fill=(150, 156, 170, 255))
    d.rounded_rectangle([66, 72, 190, 184], radius=28, fill=(30, 28, 34, 255))
    for a in range(0, 360, 12):
        d.point((128 + 54 * math.cos(math.radians(a)), 128 + 50 * math.sin(math.radians(a))), fill=(110, 106, 118, 255))
    d.ellipse([88, 88, 168, 168], fill=(60, 64, 74, 255))
    d.ellipse([98, 98, 158, 158], fill=(230, 120, 16, 255))
    d.ellipse([110, 110, 146, 146], fill=(255, 200, 80, 255))
    d.ellipse([120, 120, 136, 136], fill=(255, 248, 220, 255))
    for a in (0, 90, 180, 270):
        c, sn = math.cos(math.radians(a)), math.sin(math.radians(a))
        d.line([(128 + 34 * c, 128 + 34 * sn), (128 + 46 * c, 128 + 46 * sn)], fill=(40, 26, 14, 255), width=5)
    for (x, y, sx, sy) in ((16, 16, 1, 1), (240, 16, -1, 1), (16, 240, 1, -1), (240, 240, -1, -1)):
        d.line([(x, y), (x + sx * 46, y)], fill=AMBER + (255,), width=5)
        d.line([(x, y), (x, y + sy * 46)], fill=AMBER + (255,), width=5)
    return img.resize((128, 128), Image.LANCZOS)


# =================================================================================
# JSON de render que dependen de los modelos.
# =================================================================================

def render_controllers():
    worn = "!(c.item_slot == 'main_hand' || c.item_slot == 'off_hand')"
    held = "c.item_slot == 'main_hand' || c.item_slot == 'off_hand'"
    glow = lambda bones: [{"*": "Material.default"}] + [{b: "Material.glow"} for b in bones]
    return {"format_version": "1.8.0", "render_controllers": {
        # Si c.item_slot no existiera, el parche se seguiría viendo puesto en la cabeza.
        "controller.render.evilmorty_parche": {
            "geometry": "Geometry.default", "materials": glow(PATCH_GLOW), "textures": ["Texture.default"],
            "part_visibility": [{"*": True}] + [{b: worn} for b in PATCH_WORN] + [{b: held} for b in PATCH_HELD]},
        "controller.render.evilmorty_mano": {
            "geometry": "Geometry.default", "materials": glow(GLOVE_GLOW), "textures": ["Texture.default"],
            "part_visibility": [{"*": True}] + [{b: "c.is_first_person"} for b in GLOVE_FP]},
        "controller.render.evilmorty_rayo": {
            "geometry": "Geometry.default", "materials": glow(["brillo_interno", "brillo_externo", "espiral"]),
            "textures": ["Texture.default"]},
    }}


def attachable(identifier, name, controller, animation):
    return {"format_version": "1.10.0", "minecraft:attachable": {"description": {
        "identifier": identifier,
        "materials": {"default": "entity_alphatest", "glow": "entity_emissive_alpha"},
        "textures": {"default": f"textures/models/evilmorty/{name}"},
        "geometry": {"default": f"geometry.evilmorty.{name}"},
        "animations": {"idle": animation}, "scripts": {"animate": ["idle"]},
        "render_controllers": [controller]}}}


def client_entity(identifier, name, materials, controller, animation):
    return {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": identifier, "materials": materials,
        "textures": {"default": f"textures/entity/evilmorty/{name}"},
        "geometry": {"default": f"geometry.evilmorty.{name}"},
        "animations": {"idle": animation}, "scripts": {"animate": ["idle"]},
        "render_controllers": [controller]}}}


def main():
    models = RP / "models/entity"
    write_json(models / "parche.geo.json", patch_geometry())
    write_json(models / "mano_laser.geo.json", glove_geometry())
    write_json(models / "escudo_domo.geo.json", dome_geometry())
    write_json(models / "rayo_laser.geo.json", beam_geometry())
    save(patch_texture(), RP / "textures/models/evilmorty/parche.png")
    save(glove_texture(), RP / "textures/models/evilmorty/mano_laser.png")
    save(dome_texture(), RP / "textures/entity/evilmorty/escudo_domo.png")
    save(beam_texture(), RP / "textures/entity/evilmorty/rayo_laser.png")

    write_json(RP / "animations/parche.animation.json", patch_animations())
    write_json(RP / "animations/mano_laser.animation.json", glove_animations())
    write_json(RP / "animations/escudo_domo.animation.json", dome_animations())
    write_json(RP / "animations/rayo_laser.animation.json", beam_animations())
    write_json(RP / "render_controllers/evilmorty.render_controllers.json", render_controllers())
    write_json(RP / "attachables/parche.attachable.json", attachable(
        "evilmorty:parche", "parche", "controller.render.evilmorty_parche", "animation.evilmorty.parche.idle"))
    write_json(RP / "attachables/mano_laser.attachable.json", attachable(
        "evilmorty:mano_laser", "mano_laser", "controller.render.evilmorty_mano", "animation.evilmorty.mano_laser.idle"))
    write_json(RP / "entity/escudo_domo.entity.json", client_entity(
        "evilmorty:escudo_domo", "escudo_domo", {"default": "entity_alphablend"},
        "controller.render.default", "animation.evilmorty.escudo_domo.idle"))
    write_json(RP / "entity/rayo_laser.entity.json", client_entity(
        "evilmorty:rayo_laser", "rayo_laser", {"default": "entity_emissive_alpha", "glow": "entity_alphablend"},
        "controller.render.evilmorty_rayo", "animation.evilmorty.rayo_laser.idle"))

    save(particle_atlas(), RP / "textures/particle/evilmorty.png")
    write_particles()

    ui = RP / "textures/ui/evilmorty"
    corner = hud_corner()
    save(corner, ui / "hud_esquina_si.png")
    save(corner.transpose(Image.FLIP_LEFT_RIGHT), ui / "hud_esquina_sd.png")
    save(corner.transpose(Image.FLIP_TOP_BOTTOM), ui / "hud_esquina_ii.png")
    save(corner.transpose(Image.ROTATE_180), ui / "hud_esquina_id.png")
    save(hud_reticle(), ui / "hud_reticula.png")
    save(hud_signal(), ui / "hud_senal.png")
    save(hud_scanlines(), ui / "hud_lineas.png")
    save(hud_vignette(), ui / "hud_vineta.png")
    write_json(RP / "ui/hud_screen.json", hud_json())

    save(icon_parche(), RP / "textures/items/evilmorty/parche.png")
    save(icon_mano(), RP / "textures/items/evilmorty/mano_laser.png")
    glyphs = {"escudo": glyph_escudo, "archivos": glyph_archivos, "ajustes": glyph_ajustes,
              "vision": glyph_vision, "volver": glyph_volver, "carpeta": glyph_carpeta,
              "amenaza": glyph_amenaza, "jugador": glyph_jugador}
    for name, glyph in glyphs.items():
        save(badge(glyph), ui / f"{name}.png")
    save(pack_icon(), RP / "pack_icon.png")
    save(pack_icon(), BP / "pack_icon.png")
    print("Recursos generados en", ROOT)


if __name__ == "__main__":
    main()
