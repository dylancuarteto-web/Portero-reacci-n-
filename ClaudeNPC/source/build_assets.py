"""Genera el arte del NPC Claude, Claude Maestro y Claude Golden: modelos, skins,
animaciones, partículas, entidades de cliente y render controllers.

Uso (desde ClaudeNPC):  python source/build_assets.py   (requiere Pillow)
Personajes originales: Claude es naranja, solo ojos y un emblema de estrella propio;
Claude Maestro lleva lentes, cabello formal peinado de lado, saco de tweed con coderas,
camisa, corbata y un libro; Claude Golden es la versión dorada y luminosa. La danza de
fusión es una coreografía propia.
"""
import json
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RP = ROOT / "RP"

NARANJA = (217, 119, 87)
NARANJA_CLARO = (236, 150, 114)
NARANJA_OSCURO = (168, 84, 58)
CREMA = (245, 236, 220)
OJO = (40, 27, 21)
ORO = (255, 214, 92)
ORO_CLARO = (255, 240, 170)
ORO_OSCURO = (206, 146, 34)
BLANCO = (255, 252, 240)

# Claude Maestro
TWEED = (116, 84, 58)
TWEED_OSC = (92, 66, 46)
TWEED_CLARO = (140, 104, 72)
PARCHE = (74, 54, 38)
CAMISA = (240, 232, 214)
CAMISA_SOMBRA = (212, 202, 184)
CORBATA = (36, 92, 122)
CORBATA_RAYA = (82, 152, 178)
PANTALON = (64, 66, 76)
PANTALON_CLARO = (84, 86, 98)
ZAPATO = (74, 48, 32)
SUELA = (40, 28, 20)
PELO = (70, 46, 32)
PELO_CLARO = (100, 68, 46)
CANA = (180, 174, 164)
MARCO = (52, 36, 28)
MARCO_BRILLO = (196, 160, 90)
VIDRIO = (196, 228, 255)
TAPA = (122, 34, 44)
TAPA_OSC = (92, 24, 32)
TAPA_ORO = (222, 178, 84)
HOJAS = (242, 234, 214)
HOJAS_LINEA = (210, 198, 176)
BOTON = (198, 158, 72)


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def clamp(v):
    return max(0, min(255, int(round(v))))


def k(*pairs):
    return {f"{t:.2f}": v for t, v in sorted(pairs, key=lambda par: par[0])}


Z = [0, 0, 0]


# =============================================================================
# Geometría humanoide (UV de skin clásica 64x64) + piezas extra con UV por cara.
# La zona y 32-48 de la textura queda libre para ojos, emblema, aura y halo.
# =============================================================================

REG = {
    "ojo": (0, 32, 2, 3), "ojo_lado": (2, 32, 1, 1), "emblema": (8, 32, 8, 8), "emblema_lado": (3, 32, 1, 1),
    "aura": (16, 32, 8, 8), "halo": (24, 32, 4, 4), "orbe": (28, 32, 4, 4),
    # Solo en la textura de Claude Maestro (zona libre 0-16 x 48-64).
    "pelo": (0, 48, 4, 4), "marco": (4, 48, 2, 2), "vidrio": (6, 48, 2, 3), "corbata": (8, 48, 2, 2),
    "corbata_larga": (10, 48, 2, 6), "cuello": (12, 48, 2, 2), "libro_tapa": (0, 52, 6, 7),
    "libro_hojas": (6, 52, 2, 7), "libro_lomo": (8, 52, 2, 7), "libro_canto": (10, 52, 6, 2),
}
FACES = ("north", "south", "east", "west", "up", "down")


def per_face(front, rest):
    uv = {}
    for face in FACES:
        u, v, w, h = REG[front if face == "north" else rest]
        uv[face] = {"uv": [u, v], "uv_size": [w, h]}
    return uv


def caras(**por_cara):
    """UV por cara con regiones de REG: caras(north="a", south="b", resto="c")."""
    resto = por_cara.get("resto")
    uv = {}
    for face in FACES:
        u, v, w, h = REG[por_cara.get(face, resto)]
        uv[face] = {"uv": [u, v], "uv_size": [w, h]}
    return uv


def bone(name, pivot, parent=None, cubes=None, rotation=None):
    data = {"name": name, "pivot": pivot}
    if parent:
        data["parent"] = parent
    if rotation:
        data["rotation"] = rotation
    if cubes:
        data["cubes"] = cubes
    return data


def box(origin, size, uv, inflate=None):
    data = {"origin": origin, "size": size, "uv": uv}
    if inflate:
        data["inflate"] = inflate
    return data


def humanoide():
    return [
        bone("root", [0, 0, 0]),
        bone("waist", [0, 12, 0], "root"),
        bone("body", [0, 24, 0], "waist", [box([-4, 12, -2], [8, 12, 4], [16, 16])]),
        bone("head", [0, 24, 0], "body", [box([-4, 24, -4], [8, 8, 8], [0, 0])]),
        bone("ojos", [0, 27.5, -4.05], "head", [
            {"origin": [-3, 26, -4.1], "size": [2, 3, 0.1], "uv": per_face("ojo", "ojo_lado")},
            {"origin": [1, 26, -4.1], "size": [2, 3, 0.1], "uv": per_face("ojo", "ojo_lado")},
        ]),
        bone("emblema", [0, 19, -2.05], "body", [
            {"origin": [-2, 17, -2.1], "size": [4, 4, 0.1], "uv": per_face("emblema", "emblema_lado")},
        ]),
        bone("rightArm", [-5, 22, 0], "body", [box([-8, 12, -2], [4, 12, 4], [40, 16])]),
        bone("rightItem", [-6, 15, 1], "rightArm"),
        bone("leftArm", [5, 22, 0], "body", [box([4, 12, -2], [4, 12, 4], [32, 48])]),
        bone("leftItem", [6, 15, 1], "leftArm"),
        bone("rightLeg", [-1.9, 12, 0], "root", [box([-3.9, 0, -2], [4, 12, 4], [0, 16])]),
        bone("leftLeg", [1.9, 12, 0], "root", [box([-0.1, 0, -2], [4, 12, 4], [16, 48])]),
    ]


def geo(identifier, bones, bounds=(2, 3, 1.5)):
    return {"format_version": "1.16.0", "minecraft:geometry": [{
        "description": {"identifier": identifier, "texture_width": 64, "texture_height": 64,
                        "visible_bounds_width": bounds[0], "visible_bounds_height": bounds[1],
                        "visible_bounds_offset": [0, bounds[2], 0]},
        "bones": bones}]}


AURA_BONES = ["aura_head", "aura_body", "aura_rarm", "aura_larm", "aura_rleg", "aura_lleg"]


def golden_geometry():
    bones = humanoide()
    aura = per_face("aura", "aura")
    shells = [("aura_head", "head", [0, 24, 0], [-4, 24, -4], [8, 8, 8]),
              ("aura_body", "body", [0, 24, 0], [-4, 12, -2], [8, 12, 4]),
              ("aura_rarm", "rightArm", [-5, 22, 0], [-8, 12, -2], [4, 12, 4]),
              ("aura_larm", "leftArm", [5, 22, 0], [4, 12, -2], [4, 12, 4]),
              ("aura_rleg", "rightLeg", [-1.9, 12, 0], [-3.9, 0, -2], [4, 12, 4]),
              ("aura_lleg", "leftLeg", [1.9, 12, 0], [-0.1, 0, -2], [4, 12, 4])]
    for name, parent, pivot, origin, size in shells:
        bones.append(bone(name, pivot, parent, [box(origin, size, aura, inflate=0.8)]))
    halo = []
    for i in range(12):
        a = i * 30
        halo.append({"origin": [-0.8, 34.2, -5.0], "size": [1.6, 0.5, 0.5], "uv": per_face("halo", "halo"),
                     "pivot": [0, 34.45, 0], "rotation": [0, a, 0]})
    bones.append(bone("halo", [0, 34.45, 0], "head", halo))
    orbes = []
    for i in range(3):
        a = math.radians(i * 120)
        orbes.append({"origin": [round(10 * math.cos(a) - 0.75, 3), 15, round(10 * math.sin(a) - 0.75, 3)],
                      "size": [1.5, 1.5, 1.5], "uv": per_face("orbe", "orbe")})
    bones.append(bone("orbes", [0, 15.75, 0], "root", orbes))
    return geo("geometry.claudenpc.golden", bones, bounds=(3, 3.5, 1.6))


def maestro_geometry():
    """Claude con saco (capa 3D sobre cuerpo y brazos), cabello formal, lentes,
    corbata, insignia luminosa y un libro en la mano izquierda."""
    bones = [b for b in humanoide() if b["name"] != "emblema"]
    por_nombre = {b["name"]: b for b in bones}
    por_nombre["body"]["cubes"].append(box([-4, 12, -2], [8, 12, 4], [16, 32], inflate=0.25))
    por_nombre["rightArm"]["cubes"].append(box([-8, 12, -2], [4, 12, 4], [40, 32], inflate=0.25))
    por_nombre["leftArm"]["cubes"].append(box([4, 12, -2], [4, 12, 4], [48, 48], inflate=0.25))
    pelo = caras(resto="pelo")
    bones.append(bone("cabello", [0, 24, 0], "head", [
        box([-4, 24, -4], [8, 8, 8], [32, 0], inflate=0.45),
        {"origin": [-4.55, 31.55, -4.6], "size": [5.6, 1.2, 4.4], "uv": pelo},   # copete peinado de lado
        {"origin": [-4.6, 30.2, -4.6], "size": [2.2, 1.6, 1.0], "uv": pelo},     # mechón sobre la raya
    ]))
    marco = caras(resto="marco")
    lentes = []
    for x0 in (-3.6, 0.6):
        lentes += [
            {"origin": [x0, 29.0, -4.65], "size": [3.0, 0.6, 0.3], "uv": marco},
            {"origin": [x0, 25.4, -4.65], "size": [3.0, 0.6, 0.3], "uv": marco},
            {"origin": [x0, 26.0, -4.65], "size": [0.6, 3.0, 0.3], "uv": marco},
            {"origin": [x0 + 2.4, 26.0, -4.65], "size": [0.6, 3.0, 0.3], "uv": marco},
        ]
    lentes += [
        {"origin": [-0.6, 28.2, -4.65], "size": [1.2, 0.5, 0.3], "uv": marco},     # puente
        {"origin": [-4.8, 28.4, -4.65], "size": [0.3, 0.45, 4.6], "uv": marco},    # patillas
        {"origin": [4.5, 28.4, -4.65], "size": [0.3, 0.45, 4.6], "uv": marco},
    ]
    bones.append(bone("lentes", [0, 27.5, -4.5], "head", lentes))
    u, v, w, h = REG["vidrio"]
    vidrio = {"north": {"uv": [u, v], "uv_size": [w, h]}}  # una sola cara: vidrio fino
    bones.append(bone("vidrio", [0, 27.5, -4.5], "lentes", [
        {"origin": [-3.0, 26.0, -4.5], "size": [1.8, 3.0, 0], "uv": vidrio},
        {"origin": [1.2, 26.0, -4.5], "size": [1.8, 3.0, 0], "uv": vidrio},
    ]))
    bones.append(bone("corbata", [0, 22, -2.3], "body", [
        {"origin": [-0.75, 22.3, -2.55], "size": [1.5, 1.2, 0.45], "uv": caras(resto="corbata")},             # nudo
        {"origin": [-0.6, 16.6, -2.4], "size": [1.2, 5.8, 0.3], "uv": caras(north="corbata_larga", resto="corbata")},
        {"origin": [-0.4, 15.8, -2.4], "size": [0.8, 0.8, 0.3], "uv": caras(resto="corbata")},              # punta
        {"origin": [-2.3, 22.9, -2.5], "size": [1.5, 1.1, 0.4], "uv": caras(resto="cuello")},               # cuello
        {"origin": [0.8, 22.9, -2.5], "size": [1.5, 1.1, 0.4], "uv": caras(resto="cuello")},
    ]))
    bones.append(bone("pin", [2.5, 20.6, -2.4], "body", [
        {"origin": [1.9, 20.0, -2.5], "size": [1.3, 1.3, 0.25], "uv": per_face("emblema", "emblema_lado")},
    ]))
    # Libro sujeto contra el pecho: la tapa mira al frente, el lomo a la izquierda.
    bones.append(bone("libro", [6, 13, -2], "leftArm", [
        {"origin": [3.2, 8.4, -3.9], "size": [5.6, 7.0, 1.6],
         "uv": caras(north="libro_tapa", south="libro_tapa", west="libro_lomo", east="libro_hojas", resto="libro_canto")},
    ]))
    return geo("geometry.claudenpc.maestro", bones, bounds=(2, 3, 1.5))


def sphere_geometry(identifier, radius, center_y, bands, n_lon, region="panel"):
    reg = {"panel": (0, 0, 32, 32)}
    half = (bands[1] - bands[0]) / 2
    h = 2 * radius * math.tan(math.radians(half)) * 1.02
    bones = [bone("esfera", [0, center_y, 0])]
    for i in range(n_lon):
        cubes = []
        for lat in bands:
            edge = max(0.0, abs(lat) - half)
            w = 2 * radius * math.cos(math.radians(edge)) * math.tan(math.pi / n_lon) * 1.02
            uv = {f: {"uv": list(reg[region][:2]), "uv_size": list(reg[region][2:])} for f in FACES}
            cubes.append({"origin": [round(-w / 2, 3), round(center_y - h / 2, 3), -radius],
                          "size": [round(w, 3), round(h, 3), 0], "uv": uv,
                          "pivot": [0, center_y, 0], "rotation": [-lat, 0, 0]})
        bones.append(bone(f"gajo_{i}", [0, center_y, 0], "esfera", cubes, rotation=[0, i * 360 / n_lon, 0]))
    ring = []
    rr = radius * 1.04
    w = 2 * rr * math.tan(math.pi / 32) * 1.03
    for j in range(32):
        uv = {f: {"uv": [32, 0], "uv_size": [32, 4]} for f in FACES}
        ring.append({"origin": [round(-w / 2, 3), center_y - 0.6, -rr], "size": [round(w, 3), 1.2, 0], "uv": uv,
                     "pivot": [0, center_y, 0], "rotation": [0, j * 360 / 32, 0]})
    bones.append(bone("anillo", [0, center_y, 0], None, ring))
    return {"format_version": "1.16.0", "minecraft:geometry": [{
        "description": {"identifier": identifier, "texture_width": 64, "texture_height": 32,
                        "visible_bounds_width": radius / 4, "visible_bounds_height": radius / 4,
                        "visible_bounds_offset": [0, center_y / 16, 0]},
        "bones": bones}]}


# =============================================================================
# Texturas
# =============================================================================

def box_regions(u, v, w, h, d):
    return {
        "up": (u + d, v, w, d), "down": (u + d + w, v, w, d),
        "east": (u, v + d, d, h), "north": (u + d, v + d, w, h),
        "west": (u + d + w, v + d, d, h), "south": (u + 2 * d + w, v + d, w, h),
    }


PARTES = ((0, 0, 8, 8, 8), (16, 16, 8, 12, 4), (40, 16, 4, 12, 4), (32, 48, 4, 12, 4),
          (0, 16, 4, 12, 4), (16, 48, 4, 12, 4))


def pintar_cuerpo(px, claro, base, oscuro, alpha=255, ruido=2):
    for spec in PARTES:
        for face, (x0, y0, w, h) in box_regions(*spec).items():
            for y in range(h):
                for x in range(w):
                    t = y / max(h - 1, 1)
                    c = [claro[i] + (base[i] - claro[i]) * t for i in range(3)]
                    if face in ("east", "west"):
                        c = [v * 0.92 for v in c]
                    if face == "south":
                        c = [v * 0.88 for v in c]
                    if face == "down":
                        c = list(oscuro)
                    if face == "up":
                        c = [min(255, v * 1.06) for v in c]
                    n = ((x * 7 + y * 13 + x * y) % 5 - 2) * ruido / 2
                    px[x0 + x, y0 + y] = (clamp(c[0] + n), clamp(c[1] + n), clamp(c[2] + n), alpha)


def oscurecer_extremos(px, factor=0.82):
    # Manos y pies un poco más oscuros; cinturón en la parte baja del cuerpo.
    for spec in ((40, 16, 4, 12, 4), (32, 48, 4, 12, 4), (0, 16, 4, 12, 4), (16, 48, 4, 12, 4)):
        for face, (rx, ry, rw, rh) in box_regions(*spec).items():
            if face in ("up", "down"):
                continue
            for y in range(rh - 2, rh):
                for x in range(rw):
                    r, g, b, a = px[rx + x, ry + y]
                    px[rx + x, ry + y] = (int(r * factor), int(g * factor), int(b * factor), a)
    for face, (rx, ry, rw, rh) in box_regions(16, 16, 8, 12, 4).items():
        if face in ("north", "south", "east", "west"):
            for x in range(rw):
                r, g, b, a = px[rx + x, ry + rh - 3]
                px[rx + x, ry + rh - 3] = (int(r * 0.78), int(g * 0.78), int(b * 0.78), a)


def estrella(px, cx, cy, color, alpha, x0, y0, x1, y1):
    puntos = [(0, -3), (0, -2), (0, 2), (0, 3), (-3, 0), (-2, 0), (2, 0), (3, 0),
              (-1, -1), (1, -1), (-1, 1), (1, 1), (0, -1), (0, 1), (-1, 0), (1, 0), (0, 0)]
    for dx, dy in puntos:
        x, y = cx + dx, cy + dy
        if x0 <= x < x1 and y0 <= y < y1:
            px[x, y] = color + (alpha,)


def claude_skin():
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    px = img.load()
    pintar_cuerpo(px, NARANJA_CLARO, NARANJA, NARANJA_OSCURO)
    oscurecer_extremos(px)
    for ex in (1, 5):  # ojos pintados (debajo de los ojos 3D)
        for dy in range(3):
            for dx in range(2):
                px[8 + ex + dx, 8 + 3 + dy] = OJO + (255,)
    estrella(px, 24, 25, CREMA, 255, 20, 20, 28, 32)
    # Ojos 3D: oscuros con un brillo.
    u, v, w, h = REG["ojo"]
    for y in range(h):
        for x in range(w):
            px[u + x, v + y] = OJO + (255,)
    px[u, v] = (110, 80, 64, 255)
    px[REG["ojo_lado"][0], REG["ojo_lado"][1]] = OJO + (255,)
    # Emblema: placa naranja con estrella crema luminosa (alfa 0 = brilla).
    u, v, w, h = REG["emblema"]
    for y in range(h):
        for x in range(w):
            px[u + x, v + y] = NARANJA + (255,)
    estrella(px, u + 4, v + 4, CREMA, 0, u, v, u + w, v + h)
    px[REG["emblema_lado"][0], REG["emblema_lado"][1]] = NARANJA_OSCURO + (255,)
    return img


def golden_skin(alpha_cuerpo=205):
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    px = img.load()
    pintar_cuerpo(px, ORO_CLARO, ORO, ORO_OSCURO, alpha=alpha_cuerpo, ruido=3)
    # Líneas de circuito doradas claras (diseño propio) en cuerpo y brazos.
    rand = random.Random(4)
    for _ in range(40):
        spec = PARTES[rand.randrange(1, len(PARTES))]
        x0, y0, w, h = box_regions(*spec)["north"]
        x, y = x0 + rand.randrange(w), y0 + rand.randrange(h)
        px[x, y] = BLANCO + (0,)
    for ex in (1, 5):
        for dy in range(3):
            for dx in range(2):
                px[8 + ex + dx, 8 + 3 + dy] = BLANCO + (0,)
    estrella(px, 24, 25, BLANCO, 0, 20, 20, 28, 32)
    u, v, w, h = REG["ojo"]
    for y in range(h):
        for x in range(w):
            px[u + x, v + y] = BLANCO + (0,)
    px[REG["ojo_lado"][0], REG["ojo_lado"][1]] = BLANCO + (0,)
    u, v, w, h = REG["emblema"]
    for y in range(h):
        for x in range(w):
            px[u + x, v + y] = ORO + (alpha_cuerpo,)
    estrella(px, u + 4, v + 4, BLANCO, 0, u, v, u + w, v + h)
    px[REG["emblema_lado"][0], REG["emblema_lado"][1]] = ORO_OSCURO + (255,)
    u, v, w, h = REG["aura"]
    for y in range(h):
        for x in range(w):
            edge = min(x, y, w - 1 - x, h - 1 - y)
            px[u + x, v + y] = ORO_CLARO + (90 if edge == 0 else 45,)
    for name in ("halo", "orbe"):
        u, v, w, h = REG[name]
        for y in range(h):
            for x in range(w):
                px[u + x, v + y] = BLANCO + (0,)
    return img


def eco_skin():
    img = golden_skin(alpha_cuerpo=255)
    px = img.load()
    for y in range(64):
        for x in range(64):
            r, g, b, a = px[x, y]
            if a or (r or g or b):
                px[x, y] = (r, g, b, 120)
    return img


def region(px, x0, y0, w, h, fn):
    for y in range(h):
        for x in range(w):
            c = fn(x, y, w, h)
            if c is not None:
                px[x0 + x, y0 + y] = c


def tweed(x, y, alpha=255):
    if (x + y * 2) % 5 == 0:
        c = TWEED_CLARO
    elif (x - y) % 4 == 0:
        c = TWEED_OSC
    else:
        c = TWEED
    return c + (alpha,)


def maestro_skin():
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    px = img.load()
    pintar_cuerpo(px, NARANJA_CLARO, NARANJA, NARANJA_OSCURO)
    for ex in (1, 5):  # ojos pintados (debajo de los ojos 3D)
        for dy in range(3):
            for dx in range(2):
                px[8 + ex + dx, 8 + 3 + dy] = OJO + (255,)
    u, v, w, h = REG["ojo"]
    region(px, u, v, w, h, lambda x, y, w, h: OJO + (255,))
    px[u, v] = (110, 80, 64, 255)
    px[REG["ojo_lado"][0], REG["ojo_lado"][1]] = OJO + (255,)
    # Insignia (pin) con la estrella luminosa.
    u, v, w, h = REG["emblema"]
    region(px, u, v, w, h, lambda x, y, w, h: NARANJA + (255,))
    estrella(px, u + 4, v + 4, CREMA, 0, u, v, u + w, v + h)
    px[REG["emblema_lado"][0], REG["emblema_lado"][1]] = NARANJA_OSCURO + (255,)

    # Camisa (capa base del cuerpo) con corbata pintada y cinturón.
    for face, (x0, y0, w, h) in box_regions(16, 16, 8, 12, 4).items():
        def camisa(x, y, w, h, face=face):
            if y >= 10:
                if face == "north" and y == 10 and x in (3, 4):
                    return BOTON + (255,)
                return (PANTALON if y == 11 else (58, 40, 30)) + (255,)
            c = CAMISA_SOMBRA if face in ("south", "east", "west") else CAMISA
            if face == "north" and x in (3, 4) and 1 <= y <= 8:
                c = CORBATA_RAYA if (y + x) % 3 == 0 else CORBATA
            return c + (255,)
        region(px, x0, y0, w, h, camisa)
    # Saco de tweed (capa exterior): abierto por delante, botones y bolsillo con pluma.
    for face, (x0, y0, w, h) in box_regions(16, 32, 8, 12, 4).items():
        def saco(x, y, w, h, face=face):
            if face == "north":
                abierto = (2 <= x <= 5) if y <= 2 else (3 <= x <= 4)
                if abierto:
                    return (0, 0, 0, 0)
                if (x in (2, 5) and y <= 6) or (x in (1, 6) and y <= 1):
                    return TWEED_OSC + (255,)  # solapas
                if x == 2 and y in (7, 9):
                    return BOTON + (255,)
                if x in (5, 6) and y == 3:
                    return TWEED_OSC + (255,)  # bolsillo
                if x == 6 and y == 2:
                    return (60, 90, 200, 255)  # pluma
            if face == "south" and x in (3, 4) and y >= 8:
                return TWEED_OSC + (255,)
            return tweed(x, y)
        region(px, x0, y0, w, h, saco)
    # Mangas del saco con coderas; las 3 filas de abajo quedan abiertas (puño y mano).
    for base_u, base_v in ((40, 32), (48, 48)):
        for face, (x0, y0, w, h) in box_regions(base_u, base_v, 4, 12, 4).items():
            def manga(x, y, w, h, face=face):
                if face == "down" or (face != "up" and y >= 9):
                    return (0, 0, 0, 0)
                if face == "south" and 4 <= y <= 6 and 1 <= x <= 2:
                    return PARCHE + (255,)
                if face != "up" and y == 8:
                    return TWEED_OSC + (255,)
                return tweed(x, y)
            region(px, x0, y0, w, h, manga)
    # Brazos base: manga de camisa, puño blanco y mano naranja.
    for base_u, base_v in ((40, 16), (32, 48)):
        for face, (x0, y0, w, h) in box_regions(base_u, base_v, 4, 12, 4).items():
            def brazo(x, y, w, h, face=face):
                if face == "down" or y >= 10:
                    return NARANJA + (255,) if face != "down" else NARANJA_OSCURO + (255,)
                if y == 9:
                    return BLANCO + (255,)
                return (CAMISA_SOMBRA if face in ("south", "east", "west") else CAMISA) + (255,)
            region(px, x0, y0, w, h, brazo)
    # Pantalón gris con raya y zapatos marrones.
    for base_u, base_v in ((0, 16), (16, 48)):
        for face, (x0, y0, w, h) in box_regions(base_u, base_v, 4, 12, 4).items():
            def pierna(x, y, w, h, face=face):
                if face == "down":
                    return SUELA + (255,)
                if face == "up":
                    return PANTALON + (255,)
                if y == 11:
                    return SUELA + (255,)
                if y == 10:
                    return ZAPATO + (255,)
                if face == "north" and x == 1:
                    return PANTALON_CLARO + (255,)
                return PANTALON + (255,)
            region(px, x0, y0, w, h, pierna)
    # Cabello formal (capa de la cabeza): raya al costado, nuca recta y algunas canas.
    reg = box_regions(32, 0, 8, 8, 8)
    region(px, *reg["up"], lambda x, y, w, h: (PELO_CLARO if x == 2 or (x + y) % 4 == 0 else PELO) + (255,))
    region(px, *reg["down"], lambda x, y, w, h: (0, 0, 0, 0))

    def frente(x, y, w, h):
        if y == 0 or (y == 1 and x <= 4):
            return (PELO_CLARO if x == 2 else PELO) + (255,)
        return (0, 0, 0, 0)

    def lado(atras_izq):
        def f(x, y, w, h):
            atras = x if atras_izq else w - 1 - x  # 0 = nuca
            if y <= 2:
                return PELO + (255,)
            if y <= 5 and atras <= 4:
                return (CANA if atras == 4 and y >= 4 else PELO) + (255,)
            if y <= 4 and atras == 5:
                return CANA + (255,)  # patilla
            return (0, 0, 0, 0)
        return f

    region(px, *reg["north"], frente)
    region(px, *reg["east"], lado(True))
    region(px, *reg["west"], lado(False))
    region(px, *reg["south"], lambda x, y, w, h: (PELO + (255,)) if y <= 5 or (y == 6 and 1 <= x <= 6) else (0, 0, 0, 0))
    # Piezas 3D: pelo, lentes, vidrio, corbata, cuello y libro.
    region(px, *REG["pelo"], lambda x, y, w, h: (PELO_CLARO if (x + y) % 3 == 0 else PELO) + (255,))
    region(px, *REG["marco"], lambda x, y, w, h: (MARCO_BRILLO if x == 0 and y == 0 else MARCO) + (255,))
    region(px, *REG["vidrio"], lambda x, y, w, h: (BLANCO + (150,)) if x == 0 and y == 0 else VIDRIO + (52,))
    region(px, *REG["corbata"], lambda x, y, w, h: CORBATA + (255,))
    region(px, *REG["corbata_larga"], lambda x, y, w, h: (CORBATA_RAYA if y % 2 == 0 else CORBATA) + (255,))
    region(px, *REG["cuello"], lambda x, y, w, h: CAMISA + (255,))

    def tapa(x, y, w, h):
        if x in (0, w - 1) or y in (0, h - 1):
            return TAPA_ORO + (255,)
        if (x, y) in ((2, 3), (3, 3), (2, 2), (3, 4), (1, 3), (4, 3)):
            return TAPA_ORO + (255,)  # estrella dorada
        return TAPA + (255,)

    region(px, *REG["libro_tapa"], tapa)
    region(px, *REG["libro_hojas"], lambda x, y, w, h: (HOJAS_LINEA if x % 2 else HOJAS) + (255,))
    region(px, *REG["libro_lomo"], lambda x, y, w, h: (TAPA_ORO if y in (1, 5) else TAPA_OSC) + (255,))
    region(px, *REG["libro_canto"], lambda x, y, w, h: (HOJAS_LINEA if x % 2 else HOJAS) + (255,))
    return img


def sphere_texture(color=(255, 214, 110)):
    img = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
    px = img.load()
    for y in range(32):
        for x in range(32):
            edge = min(x, y, 31 - x, 31 - y)
            a = {0: 170, 1: 110, 2: 70}.get(edge, 22 + 40 * max(0.0, 1 - (edge - 3) / 8))
            px[x, y] = color + (clamp(a),)
    for y in range(4):
        for x in range(32, 64):
            px[x, y] = (255, 250, 220, (200, 255, 255, 200)[y])
    return img


# =============================================================================
# Atlas de partículas propio (blanco; cada efecto lo tiñe)
# =============================================================================

ATLAS = {"brillo": (0, 0, 16, 16), "anillo": (16, 0, 16, 16), "estrella": (32, 0, 16, 16),
         "chispa": (48, 0, 8, 8), "cuadro": (56, 0, 8, 8), "humo": (0, 16, 16, 16), "nota": (16, 16, 16, 16),
         "z": (32, 16, 16, 16)}


def particle_atlas():
    img = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
    px = img.load()

    def region(name, fn):
        u, v, w, h = ATLAS[name]
        for y in range(h):
            for x in range(w):
                a = fn((x + 0.5) / w * 2 - 1, (y + 0.5) / h * 2 - 1)
                px[u + x, v + y] = (255, 255, 255, clamp(a * 255))

    region("brillo", lambda x, y: math.exp(-((x * x + y * y) * 4.5)))
    region("anillo", lambda x, y: math.exp(-((math.hypot(x, y) - 0.72) ** 2) * 160))
    region("estrella", lambda x, y: min(1, math.exp(-abs(x) * 9) * math.exp(-abs(y) * 1.6)
                                        + math.exp(-abs(y) * 9) * math.exp(-abs(x) * 1.6)
                                        + math.exp(-(x * x + y * y) * 10)))
    region("chispa", lambda x, y: min(1, math.exp(-(x * x + y * y) * 6)))
    region("cuadro", lambda x, y: 1.0 if max(abs(x), abs(y)) < 0.75 else 0.0)
    rand = random.Random(9)
    blobs = [(rand.uniform(-0.4, 0.4), rand.uniform(-0.4, 0.4), rand.uniform(0.25, 0.45)) for _ in range(6)]
    region("humo", lambda x, y: min(0.85, sum(math.exp(-(((x - bx) ** 2 + (y - by) ** 2) / (s * s)) * 2)
                                              for bx, by, s in blobs) * 0.45))

    def nota(x, y):  # corchea simple de diseño propio
        cabeza = math.exp(-(((x + 0.25) ** 2) * 9 + ((y - 0.45) ** 2) * 14))
        palo = 1.0 if 0.0 < x + 0.02 < 0.16 and -0.7 < y < 0.45 else 0.0
        bandera = 1.0 if 0.1 < x < 0.55 and -0.72 < y < -0.45 + (x - 0.1) * 0.4 else 0.0
        return min(1, cabeza * 1.4 + palo + bandera)

    region("nota", nota)

    def letra_z(x, y):  # una "Z" para cuando duermen
        if abs(y + 0.62) < 0.16 or abs(y - 0.62) < 0.16:
            return 1.0 if abs(x) < 0.62 else 0.0
        return 1.0 if abs(x + y) < 0.2 and abs(x) < 0.62 else 0.0

    region("z", letra_z)
    return img


def write_particles():
    def p(name, sprite, comps, color, size, material="particles_add"):
        u, v, w, h = ATLAS[sprite]
        billboard = {"size": size, "facing_camera_mode": "lookat_xyz",
                     "uv": {"texture_width": 64, "texture_height": 32, "uv": [u, v], "uv_size": [w, h]}}
        write_json(RP / f"particles/{name}.particle.json", {"format_version": "1.10.0", "particle_effect": {
            "description": {"identifier": f"claudenpc:{name}",
                            "basic_render_parameters": {"material": material, "texture": "textures/particle/claudenpc"}},
            "components": {"minecraft:emitter_lifetime_once": {"active_time": 0.1},
                           "minecraft:particle_appearance_billboard": billboard,
                           "minecraft:particle_appearance_tinting": {"color": {"gradient": color,
                               "interpolant": "variable.particle_age / variable.particle_lifetime"}},
                           **comps}}})

    fade = lambda a, b: f"({a} + ({b} - {a}) * variable.particle_age / variable.particle_lifetime)"
    sz = lambda a, b=None: [a, a] if b is None else [fade(a, b), fade(a, b)]
    inst = lambda n: {"minecraft:emitter_rate_instant": {"num_particles": n}}
    life = lambda t: {"minecraft:particle_lifetime_expression": {"max_lifetime": t}}
    spd = lambda s: {"minecraft:particle_initial_speed": s}
    mot = lambda **kw: {"minecraft:particle_motion_dynamic": kw}

    p("cambio", "estrella", {**inst(8), "minecraft:emitter_shape_sphere": {"radius": 0.3, "direction": "outwards"},
                             **life(0.4), **spd(1.5), **mot(linear_drag_coefficient=4)},
      {"0.0": "#FFF5ECDC", "1.0": "#00D97757"}, sz(0.18, 0.02))
    p("onda", "anillo", {**inst(3), "minecraft:emitter_shape_point": {}, **life(0.5), **spd(0), **mot()},
      {"0.0": "#FFFFD9B0", "1.0": "#00D97757"}, sz(0.5, 4.0))
    p("teletransporte", "brillo", {**inst(26), "minecraft:emitter_shape_box": {"half_dimensions": [0.4, 1.0, 0.4],
                                                                              "direction": "outwards"},
                                   **life(0.8), **spd(0.6), **mot(linear_acceleration=[0, 1, 0])},
      {"0.0": "#FFC77DFF", "1.0": "#004B1C8C"}, sz(0.2, 0.02))
    p("crafteo", "estrella", {**inst(6), "minecraft:emitter_shape_box": {"half_dimensions": [0.35, 0.05, 0.35]},
                              **life(0.7), **spd(0), **mot(linear_acceleration=[0, 1.4, 0])},
      {"0.0": "#FFFFE9A0", "1.0": "#00D97757"}, sz(0.14, 0.02))
    p("construir", "humo", {**inst(8), "minecraft:emitter_shape_box": {"half_dimensions": [0.5, 0.5, 0.5],
                                                                       "surface_only": True},
                            **life(0.5), **spd(0.2), **mot(linear_drag_coefficient=2)},
      {"0.0": "#AAD8CFC0", "1.0": "#00D8CFC0"}, sz(0.25, 0.4), "particles_alpha")
    p("cohete", "chispa", {**inst(16), "minecraft:emitter_shape_point": {}, **life(0.6), **spd(1.2),
                           **mot(linear_acceleration=[0, -2, 0], linear_drag_coefficient=2)},
      {"0.0": "#FFFFF0C8", "0.5": "#FFFF8C3C", "1.0": "#00808080"}, sz(0.14, 0.02))
    p("idea", "estrella", {**inst(5), "minecraft:emitter_shape_sphere": {"radius": 0.25, "direction": "outwards"},
                           **life(0.8), **spd(0.5), **mot(linear_acceleration=[0, 0.8, 0])},
      {"0.0": "#FFB4F0FF", "1.0": "#00FFD25A"}, sz(0.2, 0.03))
    p("remo", "chispa", {**inst(6), "minecraft:emitter_shape_disc": {"radius": 0.3, "plane_normal": "y"},
                         **life(0.4), **spd(0.8), **mot(linear_acceleration=[0, -6, 0])},
      {"0.0": "#DDBEE6FF", "1.0": "#004682C8"}, sz(0.1, 0.04))
    # Escudo, polvo de bloques, tiza de la pizarra y sueño.
    p("bloqueo", "chispa", {**inst(10), "minecraft:emitter_shape_sphere": {"radius": 0.2, "direction": "outwards"},
                            **life(0.3), **spd(3), **mot(linear_drag_coefficient=4)},
      {"0.0": "#FFFFFFFF", "0.5": "#FFFFE08C", "1.0": "#00FFC850"}, sz(0.12, 0.02))
    p("polvo", "humo", {**inst(5), "minecraft:emitter_shape_box": {"half_dimensions": [0.45, 0.45, 0.45], "surface_only": True},
                        **life(0.4), **spd(0.4), **mot(linear_drag_coefficient=2, linear_acceleration=[0, -1, 0])},
      {"0.0": "#B4A08C78", "1.0": "#00A08C78"}, sz(0.14, 0.26), "particles_alpha")
    p("tiza", "cuadro", {**inst(6), "minecraft:emitter_shape_box": {"half_dimensions": [0.45, 0.25, 0.08]},
                         **life(0.9), **spd(0.05), **mot(linear_acceleration=[0, -0.7, 0])},
      {"0.0": "#FFFFFFFF", "1.0": "#00FFFFFF"}, sz(0.05), "particles_alpha")
    p("zzz", "z", {**inst(1), "minecraft:emitter_shape_point": {}, **life(1.8), **spd(0.15),
                   **mot(linear_acceleration=[0.15, 0.45, 0])},
      {"0.0": "#FFE6F0FF", "0.7": "#CCB4D2FF", "1.0": "#00B4D2FF"}, sz(0.14, 0.32), "particles_alpha")
    # Fusión y Claude Golden.
    p("aura_dorada", "estrella", {**inst(6), "minecraft:emitter_shape_box": {"half_dimensions": [0.45, 1.0, 0.45]},
                                  **life("0.8 + variable.particle_random_1 * 0.6"), **spd(0),
                                  **mot(linear_acceleration=[0, 1.2, 0])},
      {"0.0": "#FFFFF5C8", "0.5": "#FFFFD25A", "1.0": "#00FFAA1E"}, sz(0.16, 0.02))
    p("fusion_anillo", "anillo", {**inst(2), "minecraft:emitter_shape_point": {}, **life(0.9), **spd(0), **mot()},
      {"0.0": "#FFFFF5C8", "1.0": "#00FFAA1E"}, sz(1.0, 14.0))
    p("fusion_destello", "brillo", {**inst(3), "minecraft:emitter_shape_point": {}, **life(0.7), **spd(0), **mot()},
      {"0.0": "#FFFFFFFF", "0.4": "#FFFFE6A0", "1.0": "#00FFAA1E"}, sz(2.0, 16.0))
    p("fusion_espiral", "estrella", {**inst(40), "minecraft:emitter_shape_sphere": {"radius": 5, "surface_only": True,
                                                                                    "direction": "inwards"},
                                     **life(1.0), **spd(5), **mot(linear_drag_coefficient=1)},
      {"0.0": "#FFFFE6A0", "1.0": "#FFFFFFFF"}, sz(0.25, 0.05))
    p("reloj", "anillo", {**inst(4), "minecraft:emitter_shape_box": {"half_dimensions": [0.3, 0.9, 0.3]},
                          **life(0.8), **spd(0), **mot(linear_acceleration=[0, 0.6, 0])},
      {"0.0": "#FF8CF0FF", "1.0": "#004682FF"}, sz(1.6, 0.1))
    p("gravedad", "brillo", {**inst(14), "minecraft:emitter_shape_disc": {"radius": 3, "plane_normal": "y"},
                             **life(1.2), **spd(0), **mot(linear_acceleration=[0, 2.5, 0])},
      {"0.0": "#FFD2A0FF", "1.0": "#00783CC8"}, sz(0.25, 0.05))
    p("confeti", "cuadro", {**inst(30), "minecraft:emitter_shape_sphere": {"radius": 0.3, "direction": "outwards"},
                            **life("1.2 + variable.particle_random_1"), **spd("2 + variable.particle_random_2 * 3"),
                            **mot(linear_acceleration=[0, -4, 0], linear_drag_coefficient=1.5),
                            "minecraft:particle_appearance_tinting": {"color": [
                                "variable.particle_random_1", "variable.particle_random_2",
                                "variable.particle_random_3", 1]}},
      {"0.0": "#FFFFFFFF", "1.0": "#FFFFFFFF"}, sz(0.1))
    p("midas", "estrella", {**inst(4), "minecraft:emitter_shape_box": {"half_dimensions": [0.5, 0.1, 0.5]},
                            **life(0.6), **spd(0), **mot(linear_acceleration=[0, 1, 0])},
      {"0.0": "#FFFFFFFF", "1.0": "#00FFD25A"}, sz(0.18, 0.02))
    p("notas", "nota", {**inst(3), "minecraft:emitter_shape_sphere": {"radius": 1.2, "direction": "outwards"},
                        **life(1.2), **spd(0.6), **mot(linear_acceleration=[0, 0.6, 0]),
                        "minecraft:particle_appearance_tinting": {"color": [
                            "0.6 + variable.particle_random_1 * 0.4", "0.4 + variable.particle_random_2 * 0.6",
                            "0.5 + variable.particle_random_3 * 0.5", 1]}},
      {"0.0": "#FFFFFFFF", "1.0": "#FFFFFFFF"}, sz(0.3))


# =============================================================================
# Animaciones
# =============================================================================

def claude_animations():
    swing = "math.cos(query.modified_distance_moved * 38.17) * 57.3 * math.min(query.modified_move_speed, 1)"
    beats = [(t * 0.5, None) for t in range(17)]
    danza = {
        "root": {"rotation": k((0, Z), (2.0, Z), (3.0, [0, 360, 0]), (6.0, [0, 360, 0]), (7.0, [0, 1080, 0]), (8.0, [0, 1080, 0])),
                 "position": k(*[(t, [0, 3 if i % 2 else 0, 0]) for i, (t, _) in enumerate(beats)])},
        "rightArm": {"rotation": k((0, Z), (0.5, [0, 0, 85]), (1.5, [-170, 0, 10]), (2.0, [-170, 0, 10]), (3.0, [0, 0, 90]),
                                   (3.5, [0, 0, 130]), (4.0, [0, 0, 60]), (4.5, [-60, 40, 0]), (5.0, [-60, 40, 0]),
                                   (5.5, [0, 0, 150]), (6.0, [0, 0, 150]), (7.0, [0, 0, 90]), (7.5, [-90, 0, 0]), (8.0, [-90, 0, 0]))},
        "leftArm": {"rotation": k((0, Z), (0.5, [0, 0, -85]), (1.5, [-170, 0, -10]), (2.0, [-170, 0, -10]), (3.0, [0, 0, -90]),
                                  (3.5, [0, 0, -60]), (4.0, [0, 0, -130]), (4.5, [-60, -40, 0]), (5.0, [-60, -40, 0]),
                                  (5.5, [0, 0, -150]), (6.0, [0, 0, -150]), (7.0, [0, 0, -90]), (7.5, [0, 0, -150]), (8.0, [0, 0, -150]))},
        "rightLeg": {"rotation": k((0, Z), (1.0, [0, 0, 12]), (1.5, Z), (4.5, [-30, 0, 0]), (5.0, [-30, 0, 0]), (5.5, [0, 0, 15]),
                                   (6.0, [0, 0, 15]), (6.5, Z), (8.0, Z))},
        "leftLeg": {"rotation": k((0, Z), (1.0, [0, 0, -12]), (1.5, Z), (4.5, [-30, 0, 0]), (5.0, [-30, 0, 0]), (5.5, [0, 0, -15]),
                                  (6.0, [0, 0, -15]), (6.5, Z), (8.0, Z))},
        "head": {"rotation": k((0, Z), (0.5, [-20, 0, 0]), (3.5, [0, 0, 12]), (4.0, [0, 0, -12]), (4.5, [35, 0, 0]),
                               (5.0, [35, 0, 0]), (5.5, [-30, 0, 0]), (7.5, [0, -20, 0]), (8.0, [0, -20, 0]))},
        "body": {"rotation": k((0, Z), (3.5, [0, 0, 10]), (4.0, [0, 0, -10]), (4.5, [25, 0, 0]), (5.0, [25, 0, 0]),
                               (5.5, Z), (7.5, [0, 0, 8]), (8.0, [0, 0, 8]))},
    }
    return {"format_version": "1.8.0", "animations": {
        "animation.claudenpc.mirar": {"loop": True, "bones": {
            "head": {"rotation": ["query.target_x_rotation", "query.target_y_rotation", 0]}}},
        "animation.claudenpc.caminar": {"loop": True, "bones": {
            "rightArm": {"rotation": [f"-({swing}) * 0.6 - 8", 0, 0]},
            "leftArm": {"rotation": [f"({swing}) * 0.6", 0, 0]},
            "rightLeg": {"rotation": [f"({swing}) * 0.8", 0, 0]},
            "leftLeg": {"rotation": [f"-({swing}) * 0.8", 0, 0]}}},
        "animation.claudenpc.respirar": {"loop": True, "bones": {
            "body": {"scale": [1, "1 + math.sin(query.life_time * 120) * 0.01", 1]},
            "rightArm": {"rotation": [0, 0, "math.sin(query.life_time * 90) * 2 + 2"]},
            "leftArm": {"rotation": [0, 0, "-math.sin(query.life_time * 90) * 2 - 2"]}}},
        "animation.claudenpc.parpadeo": {"loop": True, "animation_length": 4.2, "bones": {
            "ojos": {"scale": k((0, [1, 1, 1]), (3.9, [1, 1, 1]), (4.0, [1, 0.1, 1]), (4.1, [1, 1, 1]))}}},
        "animation.claudenpc.golpe": {"animation_length": 0.35, "bones": {
            "rightArm": {"rotation": k((0, Z), (0.1, [-120, 20, 0]), (0.22, [20, -10, 0]), (0.35, Z))},
            "body": {"rotation": k((0, Z), (0.12, [0, -15, 0]), (0.35, Z))}}},
        "animation.claudenpc.martillazo": {"animation_length": 0.9, "bones": {
            "rightArm": {"rotation": k((0, Z), (0.3, [-170, 0, 0]), (0.7, [-170, 0, 0]), (0.8, [-20, 0, 0]), (0.9, Z))},
            "leftArm": {"rotation": k((0, Z), (0.3, [-160, 0, 0]), (0.7, [-160, 0, 0]), (0.8, [-20, 0, 0]), (0.9, Z))}}},
        # Ataques con arma (cada golpe cuerpo a cuerpo) y escudo contra flechas.
        "animation.claudenpc.espadazo": {"animation_length": 0.32, "bones": {
            "rightArm": {"rotation": k((0, Z), (0.07, [-150, 0, -35]), (0.17, [-40, 0, 30]), (0.32, Z))},
            "body": {"rotation": k((0, Z), (0.07, [0, -15, 0]), (0.17, [0, 20, 0]), (0.32, Z))}}},
        "animation.claudenpc.espadazo2": {"animation_length": 0.32, "bones": {
            "rightArm": {"rotation": k((0, Z), (0.08, [-95, 0, 40]), (0.18, [-80, 0, -40]), (0.32, Z))},
            "body": {"rotation": k((0, Z), (0.08, [0, 18, 0]), (0.18, [0, -20, 0]), (0.32, Z))}}},
        "animation.claudenpc.hachazo": {"animation_length": 0.45, "bones": {
            "rightArm": {"rotation": k((0, Z), (0.14, [-170, 0, -8]), (0.26, [-30, 0, 5]), (0.45, Z))},
            "body": {"rotation": k((0, Z), (0.14, [-6, 0, 0]), (0.26, [12, 0, 0]), (0.45, Z))}}},
        "animation.claudenpc.estocada": {"animation_length": 0.4, "bones": {
            "rightArm": {"rotation": k((0, Z), (0.12, [-70, 0, -10]), (0.2, [-95, 0, 4]), (0.4, Z))},
            "body": {"rotation": k((0, Z), (0.12, [0, -12, 0]), (0.2, [8, 14, 0]), (0.4, Z))}}},
        # Postura con el escudo arriba (la activa la propiedad claudenpc:escudo).
        "animation.claudenpc.cubrirse": {"loop": True, "bones": {
            "leftArm": {"rotation": [-72, 0, -22]}, "rightArm": {"rotation": [-12, 0, 0]},
            "body": {"rotation": [6, 0, 0]}, "head": {"rotation": [4, 0, 0]}}},
        "animation.claudenpc.bloqueo": {"animation_length": 0.25, "bones": {
            "leftArm": {"rotation": k((0, Z), (0.06, [14, 0, 0]), (0.25, Z))},
            "body": {"rotation": k((0, Z), (0.06, [-5, 0, 0]), (0.25, Z))}}},
        # En clase: sentado (propiedad claudenpc:sentado), apuntes, mano arriba, aplausos.
        "animation.claudenpc.sentado": {"loop": True, "bones": {
            "root": {"position": [0, -10, 0]},
            "rightLeg": {"rotation": [-90, 0, -6]}, "leftLeg": {"rotation": [-90, 0, 6]},
            "rightArm": {"rotation": [-38, 0, 6]}, "leftArm": {"rotation": [-38, 0, -6]}}},
        "animation.claudenpc.tomar_notas": {"animation_length": 2.0, "bones": {
            "rightArm": {"rotation": k((0, Z), (0.3, [-22, 0, 10]), (0.6, [-18, 0, 4]), (0.9, [-24, 0, 12]),
                                      (1.2, [-18, 0, 3]), (1.6, [-22, 0, 10]), (2.0, Z))},
            "head": {"rotation": k((0, Z), (0.25, [24, 0, 0]), (1.75, [24, 0, 0]), (2.0, Z))}}},
        "animation.claudenpc.levantar_mano": {"animation_length": 2.4, "bones": {
            "rightArm": {"rotation": k((0, Z), (0.25, [-135, 0, 10]), (2.1, [-135, 0, 10]), (2.4, Z))},
            "head": {"rotation": k((0, Z), (0.25, [-8, 0, 0]), (2.1, [-8, 0, 0]), (2.4, Z))}}},
        "animation.claudenpc.aplaudir": {"animation_length": 1.4, "bones": {
            "rightArm": {"rotation": k(*[(t * 0.15, [-55, 0, -18 if t % 2 == 0 else 12]) for t in range(1, 7)], (0, Z), (1.4, Z))},
            "leftArm": {"rotation": k(*[(t * 0.15, [-55, 0, 18 if t % 2 == 0 else -12]) for t in range(1, 7)], (0, Z), (1.4, Z))}}},
        # Pesca: lanzar, esperar con la caña al frente y recoger.
        "animation.claudenpc.pescar": {"animation_length": 6.0, "bones": {
            "rightArm": {"rotation": k((0, Z), (0.2, [-160, 0, -10]), (0.45, [-65, 0, 0]),
                                      *[(0.45 + i * 0.5, [-65 + (3 if i % 2 else 0), 0, 0]) for i in range(1, 11)], (6.0, [-65, 0, 0]))}}},
        "animation.claudenpc.pescar_espera": {"animation_length": 5.5, "bones": {
            "rightArm": {"rotation": k(*[(i * 0.5, [-65 + (3 if i % 2 else 0), 0, 0]) for i in range(12)])}}},
        "animation.claudenpc.recoger": {"animation_length": 0.7, "bones": {
            "rightArm": {"rotation": k((0, [-65, 0, 0]), (0.25, [-150, 0, 0]), (0.7, Z))}}},
        "animation.claudenpc.mirar_alrededor": {"animation_length": 3.0, "bones": {
            "head": {"rotation": k((0, Z), (0.6, [0, -55, 0]), (1.4, [-10, -55, 0]), (1.9, [0, 50, 0]), (2.6, [0, 50, 0]), (3.0, Z))},
            "body": {"rotation": k((0, Z), (1.0, [0, -10, 0]), (2.0, [0, 10, 0]), (3.0, Z))}}},
        "animation.claudenpc.lanzar": {"animation_length": 0.5, "bones": {
            "rightArm": {"rotation": k((0, Z), (0.15, [-170, 0, 0]), (0.3, [-60, 0, 0]), (0.5, Z))}}},
        "animation.claudenpc.colocar": {"animation_length": 0.35, "bones": {
            "rightArm": {"rotation": k((0, Z), (0.12, [-65, -8, 0]), (0.22, [-40, 0, 0]), (0.35, Z))},
            "body": {"rotation": k((0, Z), (0.12, [0, -6, 0]), (0.35, Z))}}},
        "animation.claudenpc.crafteo": {"animation_length": 3.0, "bones": {
            "rightArm": {"rotation": k(*[(t * 0.3, [-50 if t % 2 == 0 else -85, 10 * (t % 2), 0]) for t in range(11)])},
            "leftArm": {"rotation": k(*[(t * 0.3, [-40 if t % 2 == 0 else -28, -10 * (t % 2), 0]) for t in range(11)])},
            "head": {"rotation": k((0, Z), (0.2, [25, 0, 0]), (2.8, [25, 0, 0]), (3.0, Z))}}},
        "animation.claudenpc.minar": {"animation_length": 0.8, "bones": {
            "rightArm": {"rotation": k((0, [-60, 0, 0]), (0.2, [-110, 0, 0]), (0.4, [-60, 0, 0]), (0.6, [-110, 0, 0]), (0.8, Z))}}},
        "animation.claudenpc.arco": {"animation_length": 1.4, "bones": {
            "rightArm": {"rotation": k((0, Z), (0.2, [-90, -10, 0]), (1.15, [-90, -10, 0]), (1.25, [-80, -5, 0]), (1.4, Z))},
            "leftArm": {"rotation": k((0, Z), (0.2, [-90, 35, 0]), (1.15, [-90, 35, 0]), (1.4, Z))},
            "body": {"rotation": k((0, Z), (0.2, [0, 15, 0]), (1.15, [0, 15, 0]), (1.4, Z))}}},
        "animation.claudenpc.planeo": {"animation_length": 1.0, "bones": {
            "body": {"rotation": [60, 0, 0], "position": [0, -4, -6]},
            "rightArm": {"rotation": [20, 0, 30]}, "leftArm": {"rotation": [20, 0, -30]},
            "rightLeg": {"rotation": [10, 0, 5]}, "leftLeg": {"rotation": [10, 0, -5]},
            "head": {"rotation": [-45, 0, 0]}}},
        "animation.claudenpc.cubeta": {"animation_length": 1.5, "bones": {
            "head": {"rotation": k((0, Z), (0.15, [60, 0, 0]), (1.3, [60, 0, 0]), (1.5, Z))},
            "rightArm": {"rotation": k((0, Z), (0.15, [-30, 0, 0]), (1.3, [-30, 0, 0]), (1.5, Z))}}},
        # Agachado mirando el borde (puente), como un jugador al hacer sneak-bridge.
        "animation.claudenpc.agachado": {"animation_length": 1.0, "bones": {
            "body": {"rotation": [28, 0, 0], "position": [0, -1.5, 0]},
            "head": {"rotation": [55, 0, 0], "position": [0, -1.5, 0]},
            "rightArm": {"rotation": [-25, 0, 0], "position": [0, -1.5, 0]},
            "leftArm": {"rotation": [-15, 0, 0], "position": [0, -1.5, 0]},
            "rightLeg": {"position": [0, 0, 3]}, "leftLeg": {"position": [0, 0, 3]}}},
        "animation.claudenpc.colocar_abajo": {"animation_length": 0.4, "bones": {
            "rightArm": {"rotation": k((0, [-25, 0, 0]), (0.15, [-55, -10, 0]), (0.3, [-30, 0, 0]), (0.4, [-25, 0, 0]))}}},
        # Torre: mira hacia abajo y coloca en el punto alto del salto.
        "animation.claudenpc.torre": {"animation_length": 0.55, "bones": {
            "head": {"rotation": k((0, [40, 0, 0]), (0.1, [75, 0, 0]), (0.45, [75, 0, 0]), (0.55, [40, 0, 0]))},
            "rightArm": {"rotation": k((0, Z), (0.2, [-20, 0, 0]), (0.3, [-55, 0, 0]), (0.45, [-20, 0, 0]), (0.55, Z))}}},
        "animation.claudenpc.remar": {"animation_length": 1.2, "bones": {
            "rightArm": {"rotation": k((0, [-40, 0, 15]), (0.3, [-80, 0, 30]), (0.6, [-30, 0, 15]), (0.9, [-15, 0, 10]), (1.2, [-40, 0, 15]))},
            "leftArm": {"rotation": k((0, [-40, 0, -15]), (0.3, [-80, 0, -30]), (0.6, [-30, 0, -15]), (0.9, [-15, 0, -10]), (1.2, [-40, 0, -15]))},
            "rightLeg": {"rotation": [-85, 10, 0]}, "leftLeg": {"rotation": [-85, -10, 0]}}},
        "animation.claudenpc.celebrar": {"animation_length": 1.6, "bones": {
            "rightArm": {"rotation": k((0, Z), (0.2, [-170, 0, 10]), (0.6, [-150, 0, 25]), (1.0, [-170, 0, 10]), (1.6, Z))},
            "leftArm": {"rotation": k((0, Z), (0.2, [-170, 0, -10]), (0.6, [-150, 0, -25]), (1.0, [-170, 0, -10]), (1.6, Z))},
            "root": {"position": k((0, Z), (0.3, [0, 4, 0]), (0.6, Z), (0.9, [0, 4, 0]), (1.2, Z))}}},
        "animation.claudenpc.danza": {"animation_length": 8.0, "bones": danza},
        "animation.claudenpc.fusion": {"animation_length": 3.0, "bones": {
            "rightArm": {"rotation": [0, 0, 90]}, "leftArm": {"rotation": [0, 0, -90]},
            "head": {"rotation": [-30, 0, 0]},
            "root": {"rotation": k((0, Z), (3.0, [0, 720, 0]))}}},
    }}


def maestro_animations():
    m = "animation.claudenpc.maestro."
    return {"format_version": "1.8.0", "animations": {
        # Siempre: sostiene el libro contra el pecho.
        m + "libro": {"loop": True, "bones": {"leftArm": {"rotation": [-32, 0, -10]}}},
        m + "leer": {"animation_length": 3.0, "bones": {
            "leftArm": {"rotation": k((0, Z), (0.3, [-38, 0, -16]), (2.7, [-38, 0, -16]), (3.0, Z))},
            "rightArm": {"rotation": k((0, Z), (0.3, [-62, 0, 24]), (1.4, [-62, 0, 24]), (1.6, [-75, 0, 30]),
                                      (1.8, [-62, 0, 24]), (2.7, [-62, 0, 24]), (3.0, Z))},
            "head": {"rotation": k((0, Z), (0.3, [24, 0, 0]), (1.5, [24, 0, -6]), (2.7, [24, 0, 4]), (3.0, Z))}}},
        m + "explicar": {"animation_length": 2.4, "bones": {
            "rightArm": {"rotation": k((0, Z), (0.3, [-80, 0, -15]), (0.8, [-65, 0, 10]), (1.3, [-95, 0, -25]),
                                      (1.8, [-70, 0, 5]), (2.4, Z))},
            "head": {"rotation": k((0, Z), (0.4, [0, 12, 0]), (1.2, [0, -12, 0]), (2.0, [-5, 0, 0]), (2.4, Z))},
            "body": {"rotation": k((0, Z), (0.6, [0, 8, 0]), (1.6, [0, -8, 0]), (2.4, Z))}}},
        m + "escribir": {"animation_length": 2.0, "bones": {
            "rightArm": {"rotation": k((0, Z), (0.2, [-150, 0, 0]), (0.45, [-150, 0, -12]), (0.7, [-140, 0, 8]),
                                      (0.95, [-155, 0, -6]), (1.2, [-145, 0, 12]), (1.45, [-150, 0, -10]),
                                      (1.7, [-140, 0, 6]), (2.0, Z))},
            "head": {"rotation": k((0, Z), (0.2, [-12, 0, 0]), (1.8, [-12, 0, 0]), (2.0, Z))}}},
        m + "senalar": {"animation_length": 1.4, "bones": {
            "rightArm": {"rotation": k((0, Z), (0.25, [-95, 0, -8]), (1.1, [-95, 0, -8]), (1.4, Z))},
            "head": {"rotation": k((0, Z), (0.25, [-5, 0, 0]), (1.1, [-5, 0, 0]), (1.4, Z))}}},
        m + "lentes": {"animation_length": 1.2, "bones": {
            "rightArm": {"rotation": k((0, Z), (0.3, [-150, 0, 28]), (0.7, [-148, 0, 24]), (1.2, Z))},
            "head": {"rotation": k((0, Z), (0.3, [10, 0, 0]), (0.7, [10, 0, 0]), (1.2, Z))}}},
        m + "campana": {"animation_length": 0.7, "bones": {
            "rightArm": {"rotation": k((0, Z), (0.15, [-120, 0, -10]), (0.3, [-70, 0, 0]), (0.45, [-110, 0, -8]), (0.7, Z))}}},
        m + "aplaudir": {"animation_length": 1.4, "bones": {
            "rightArm": {"rotation": k(*[(t * 0.15, [-60, 0, -18 if t % 2 == 0 else 12]) for t in range(1, 7)], (0, Z), (1.4, Z))},
            "leftArm": {"rotation": k(*[(t * 0.15, [-28, 0, 18 if t % 2 == 0 else -6]) for t in range(1, 7)], (0, Z), (1.4, Z))}}},
        m + "pensar": {"animation_length": 2.0, "bones": {
            "rightArm": {"rotation": k((0, Z), (0.3, [-130, 0, 30]), (1.7, [-130, 0, 30]), (2.0, Z))},
            "head": {"rotation": k((0, Z), (0.3, [-10, 0, 8]), (1.7, [-10, 0, 8]), (2.0, Z))}}},
        m + "saludar": {"animation_length": 1.4, "bones": {
            "rightArm": {"rotation": k((0, Z), (0.2, [-170, 0, -20]), (0.45, [-170, 0, 10]), (0.7, [-170, 0, -20]),
                                      (0.95, [-170, 0, 10]), (1.4, Z))}}},
    }}


def golden_animations():
    return {"format_version": "1.8.0", "animations": {
        "animation.claudenpc.golden.flotar": {"loop": True, "bones": {
            "root": {"position": [0, "math.sin(query.life_time * 120) * 1.2 + 1", 0]},
            "rightArm": {"rotation": [0, 0, "8 + math.sin(query.life_time * 90) * 4"]},
            "leftArm": {"rotation": [0, 0, "-8 - math.sin(query.life_time * 90) * 4"]},
            "rightLeg": {"rotation": [-10, 0, 3]}, "leftLeg": {"rotation": [5, 0, -3]}}},
        "animation.claudenpc.golden.halo": {"loop": True, "bones": {
            "halo": {"rotation": [0, "query.life_time * 60", 0]},
            "orbes": {"rotation": [0, "query.life_time * -120", 0],
                      "position": [0, "math.sin(query.life_time * 200) * 1.5", 0]}}},
        "animation.claudenpc.golden.aura": {"loop": True, "bones": {
            b: {"scale": "1 + math.sin(query.life_time * 300) * 0.04"} for b in AURA_BONES}},
        "animation.claudenpc.golden.poder": {"animation_length": 1.2, "bones": {
            "rightArm": {"rotation": k((0, Z), (0.3, [-160, 0, 20]), (0.9, [-160, 0, 20]), (1.2, Z))},
            "leftArm": {"rotation": k((0, Z), (0.3, [-160, 0, -20]), (0.9, [-160, 0, -20]), (1.2, Z))},
            "head": {"rotation": k((0, Z), (0.3, [-25, 0, 0]), (0.9, [-25, 0, 0]), (1.2, Z))}}},
        "animation.claudenpc.golden.chasquido": {"animation_length": 0.8, "bones": {
            "rightArm": {"rotation": k((0, Z), (0.2, [-110, -30, 0]), (0.35, [-120, -20, 10]), (0.8, Z))}}},
        "animation.claudenpc.golden.dirigir": {"animation_length": 4.0, "bones": {
            "rightArm": {"rotation": k(*[(t * 0.25, [-100 + 30 * math.sin(t), 20 * math.cos(t), 0]) for t in range(17)])},
            "leftArm": {"rotation": k(*[(t * 0.25, [-90 + 25 * math.cos(t), -20 * math.sin(t), 0]) for t in range(17)])},
            "head": {"rotation": k(*[(t * 0.5, [0, 0, 8 * math.sin(t * 1.5)]) for t in range(9)])}}},
        "animation.claudenpc.golden.pensar": {"animation_length": 3.0, "bones": {
            "rightArm": {"rotation": k((0, Z), (0.3, [-120, 40, 0]), (2.7, [-120, 40, 0]), (3.0, Z))},
            "head": {"rotation": k((0, Z), (0.3, [10, 0, 10]), (2.7, [10, 0, 10]), (3.0, Z))}}},
    }}


def aura_animations():
    return {"format_version": "1.8.0", "animations": {
        "animation.claudenpc.aura.idle": {"loop": True, "bones": {
            "esfera": {"rotation": [0, "query.life_time * 40", 0],
                       "scale": "math.min(query.life_time * 0.8, 1) * (1 + math.sin(query.life_time * 400) * 0.03)"},
            "anillo": {"rotation": ["math.sin(query.life_time * 90) * 25", "-query.life_time * 120", 0],
                       "scale": "math.min(query.life_time * 0.8, 1)"}}}}}


# =============================================================================
# Entidades de cliente y render controllers
# =============================================================================

def render_controllers():
    return {"format_version": "1.8.0", "render_controllers": {
        "controller.render.claudenpc": {
            "geometry": "Geometry.default", "textures": ["Texture.default"],
            "materials": [{"*": "Material.default"}, {"emblema": "Material.glow"}]},
        "controller.render.claudenpc_golden": {
            "geometry": "Geometry.default", "textures": ["Texture.default"],
            "materials": [{"*": "Material.default"}] + [{b: "Material.aura"} for b in AURA_BONES]},
        "controller.render.claudenpc_maestro": {
            "geometry": "Geometry.default", "textures": ["Texture.default"],
            "materials": [{"*": "Material.default"}, {"pin": "Material.glow"}, {"vidrio": "Material.vidrio"}]},
    }}


def client_entities():
    base_anims = {
        "mirar": "animation.claudenpc.mirar", "caminar": "animation.claudenpc.caminar",
        "respirar": "animation.claudenpc.respirar", "parpadeo": "animation.claudenpc.parpadeo",
    }
    claude_anims = dict(base_anims)
    for name in ("golpe", "espadazo", "espadazo2", "hachazo", "estocada", "cubrirse", "bloqueo", "martillazo",
                 "lanzar", "colocar", "crafteo", "minar", "arco", "planeo", "cubeta", "agachado", "colocar_abajo",
                 "torre", "remar", "celebrar", "sentado", "tomar_notas", "levantar_mano", "aplaudir", "pescar",
                 "pescar_espera", "recoger", "mirar_alrededor", "danza", "fusion"):
        claude_anims[name] = f"animation.claudenpc.{name}"
    write_json(RP / "entity/claude.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": "claudenpc:claude",
        "materials": {"default": "entity_alphatest", "glow": "entity_emissive_alpha"},
        "textures": {"default": "textures/entity/claudenpc/claude"},
        "geometry": {"default": "geometry.claudenpc.claude"},
        "animations": claude_anims,
        "scripts": {"animate": ["mirar", "caminar", "respirar", "parpadeo",
                                {"cubrirse": "query.property('claudenpc:escudo')"},
                                {"sentado": "query.property('claudenpc:sentado')"}]},
        "render_controllers": ["controller.render.claudenpc"],
        "enable_attachables": True,
        "spawn_egg": {"base_color": "#D97757", "overlay_color": "#F5ECDC"}}}})
    maestro_anims = dict(base_anims)
    for name in ("libro", "leer", "explicar", "escribir", "senalar", "lentes", "campana", "aplaudir", "pensar", "saludar"):
        maestro_anims[name] = f"animation.claudenpc.maestro.{name}"
    write_json(RP / "entity/maestro.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": "claudenpc:maestro",
        "materials": {"default": "entity_alphatest", "glow": "entity_emissive_alpha", "vidrio": "entity_alphablend"},
        "textures": {"default": "textures/entity/claudenpc/maestro"},
        "geometry": {"default": "geometry.claudenpc.maestro"},
        "animations": maestro_anims,
        "scripts": {"animate": ["mirar", "caminar", "respirar", "parpadeo", "libro"]},
        "render_controllers": ["controller.render.claudenpc_maestro"],
        "enable_attachables": True,
        "spawn_egg": {"base_color": "#74543A", "overlay_color": "#D97757"}}}})
    golden_anims = dict(base_anims)
    for name in ("flotar", "halo", "aura", "poder", "chasquido", "dirigir", "pensar"):
        golden_anims[name] = f"animation.claudenpc.golden.{name}"
    write_json(RP / "entity/claude_golden.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": "claudenpc:claude_golden",
        "materials": {"default": "entity_emissive_alpha", "aura": "entity_alphablend"},
        "textures": {"default": "textures/entity/claudenpc/golden"},
        "geometry": {"default": "geometry.claudenpc.golden"},
        "animations": golden_anims,
        "scripts": {"animate": ["mirar", "respirar", "parpadeo", "flotar", "halo", "aura"]},
        "render_controllers": ["controller.render.claudenpc_golden"],
        "enable_attachables": True}}})
    write_json(RP / "entity/eco.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": "claudenpc:eco",
        "materials": {"default": "entity_alphablend", "glow": "entity_alphablend"},
        "textures": {"default": "textures/entity/claudenpc/eco"},
        "geometry": {"default": "geometry.claudenpc.claude"},
        "animations": dict(base_anims, celebrar="animation.claudenpc.celebrar"),
        "scripts": {"animate": ["mirar", "caminar", "respirar"]},
        "render_controllers": ["controller.render.claudenpc"]}}})
    write_json(RP / "entity/aura.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": "claudenpc:aura",
        "materials": {"default": "entity_alphablend"},
        "textures": {"default": "textures/entity/claudenpc/aura"},
        "geometry": {"default": "geometry.claudenpc.aura"},
        "animations": {"idle": "animation.claudenpc.aura.idle"},
        "scripts": {"animate": ["idle"]},
        "render_controllers": ["controller.render.default"]}}})


def main():
    write_json(RP / "models/entity/claude.geo.json", geo("geometry.claudenpc.claude", humanoide()))
    write_json(RP / "models/entity/golden.geo.json", golden_geometry())
    write_json(RP / "models/entity/maestro.geo.json", maestro_geometry())
    write_json(RP / "models/entity/aura.geo.json", sphere_geometry(
        "geometry.claudenpc.aura", 80, 40, [-67.5, -52.5, -37.5, -22.5, -7.5, 7.5, 22.5, 37.5, 52.5, 67.5, 82.5], 20))
    tex = RP / "textures/entity/claudenpc"
    tex.mkdir(parents=True, exist_ok=True)
    claude_skin().save(tex / "claude.png")
    golden_skin().save(tex / "golden.png")
    maestro_skin().save(tex / "maestro.png")
    eco_skin().save(tex / "eco.png")
    sphere_texture().save(tex / "aura.png")
    (RP / "textures/particle").mkdir(parents=True, exist_ok=True)
    particle_atlas().save(RP / "textures/particle/claudenpc.png")
    write_particles()
    write_json(RP / "animations/claude.animation.json", claude_animations())
    write_json(RP / "animations/golden.animation.json", golden_animations())
    write_json(RP / "animations/maestro.animation.json", maestro_animations())
    write_json(RP / "animations/aura.animation.json", aura_animations())
    write_json(RP / "render_controllers/claudenpc.render_controllers.json", render_controllers())
    client_entities()

    icon = Image.new("RGBA", (128, 128), NARANJA + (255,))
    d = ImageDraw.Draw(icon)
    d.rectangle([0, 96, 128, 128], fill=ORO + (255,))
    for x in (34, 74):
        d.rounded_rectangle([x, 34, x + 20, 66], radius=8, fill=OJO + (255,))
    for a in range(4):
        ang = math.radians(a * 90)
        d.line([(64, 82), (64 + 12 * math.cos(ang), 82 + 12 * math.sin(ang))], fill=CREMA + (255,), width=5)
    icon.save(RP / "pack_icon.png")
    icon.save(ROOT / "BP/pack_icon.png")
    print("Recursos generados en", ROOT)


if __name__ == "__main__":
    main()
