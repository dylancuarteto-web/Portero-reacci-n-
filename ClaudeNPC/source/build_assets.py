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
    # Ojo derecho de Claude Golden (núcleo y rayos del destello).
    "nucleo": (32, 32, 4, 4), "rayo": (32, 40, 16, 1), "rayo_v": (48, 32, 1, 16),
    # Solo en la textura de Claude Maestro (zona libre 0-16 x 48-64).
    "pelo": (0, 48, 4, 4), "marco": (4, 48, 2, 2), "vidrio": (6, 48, 2, 3), "corbata": (8, 48, 2, 2),
    "corbata_larga": (10, 48, 2, 6), "cuello": (12, 48, 2, 2), "libro_tapa": (0, 52, 6, 7),
    "libro_hojas": (6, 52, 2, 7), "libro_lomo": (8, 52, 2, 7), "libro_canto": (10, 52, 6, 2),
    "bigote": (56, 32, 4, 2), "falda": (56, 36, 8, 8),
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
    # Ojo derecho (el del lado del brazo derecho, x negativo) con un esplendor
    # reluciente: núcleo que late y rayos en cruz que giran. Brillan (material emisivo).
    def plano(region):
        u, v, w, h = REG[region]
        return {"north": {"uv": [u, v], "uv_size": [w, h]}, "south": {"uv": [u, v], "uv_size": [w, h]}}
    ojo = [-2.0, 27.5, -4.55]
    nucleo = bone("ojo_brillo", ojo, "head", [
        {"origin": [-3.15, 25.95, -4.45], "size": [2.3, 3.1, 0.2], "uv": caras(resto="nucleo")}])
    nucleo["locators"] = {"ojo_derecho": [-2.0, 27.5, -5.0]}
    bones.append(nucleo)
    rayos = [
        {"origin": [-8.0, 27.25, -4.6], "size": [12.0, 0.5, 0], "uv": plano("rayo")},
        {"origin": [-2.25, 21.5, -4.6], "size": [0.5, 12.0, 0], "uv": plano("rayo_v")},
    ]
    for ang in (45, -45):
        rayos.append({"origin": [-5.5, 27.32, -4.62], "size": [7.0, 0.36, 0], "uv": plano("rayo"),
                      "pivot": ojo, "rotation": [0, 0, ang]})
    bones.append(bone("ojo_rayos", ojo, "head", rayos))
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
    ]))
    bones.append(bone("cuello", [0, 23, -2.3], "body", [
        {"origin": [-2.3, 22.9, -2.5], "size": [1.5, 1.1, 0.4], "uv": caras(resto="cuello")},
        {"origin": [0.8, 22.9, -2.5], "size": [1.5, 1.1, 0.4], "uv": caras(resto="cuello")},
    ]))
    # Piezas de los maestros genios (se muestran según la variante).
    pelo = caras(resto="pelo")
    bones.append(bone("bigote", [0, 25, -4.5], "head", [
        {"origin": [-2.6, 24.7, -4.7], "size": [5.2, 1.1, 0.5], "uv": caras(resto="bigote")},
        {"origin": [-3.3, 24.1, -4.65], "size": [1.1, 0.9, 0.45], "uv": caras(resto="bigote")},
        {"origin": [2.2, 24.1, -4.65], "size": [1.1, 0.9, 0.45], "uv": caras(resto="bigote")},
    ]))
    bones.append(bone("pelo_alborotado", [0, 28, 0], "head", [
        {"origin": [-5.5, 26.5, -2.5], "size": [1.4, 4.5, 6.5], "uv": pelo},
        {"origin": [4.1, 26.5, -2.5], "size": [1.4, 4.5, 6.5], "uv": pelo},
        {"origin": [-4.5, 25.8, 4.0], "size": [9.0, 5.8, 1.5], "uv": pelo},
        {"origin": [-3.6, 32.3, -3.0], "size": [2.6, 1.5, 5.5], "uv": pelo},
        {"origin": [0.4, 32.5, -1.6], "size": [3.0, 1.8, 5.2], "uv": pelo},
        {"origin": [-1.2, 32.2, 1.6], "size": [2.2, 1.3, 3.0], "uv": pelo},
    ]))
    bones.append(bone("mono", [0, 31, 4], "head", [{"origin": [-1.7, 29.8, 4.1], "size": [3.4, 3.4, 2.2], "uv": pelo}]))
    bones.append(bone("peluca", [0, 28, 0], "head", [
        {"origin": [-5.4, 19.0, -2.8], "size": [1.5, 11.0, 6.0], "uv": pelo},
        {"origin": [3.9, 19.0, -2.8], "size": [1.5, 11.0, 6.0], "uv": pelo},
        {"origin": [-4.6, 20.0, 3.9], "size": [9.2, 10.0, 1.4], "uv": pelo},
        {"origin": [-4.6, 31.7, -4.0], "size": [9.2, 1.3, 8.6], "uv": pelo},
    ]))
    bones.append(bone("rizos", [0, 26, 0], "head", [
        {"origin": [-5.1, 23.0, -2.0], "size": [1.3, 5.0, 1.6], "uv": pelo},
        {"origin": [-5.1, 22.2, -0.2], "size": [1.3, 5.0, 1.6], "uv": pelo},
        {"origin": [3.8, 23.0, -2.0], "size": [1.3, 5.0, 1.6], "uv": pelo},
        {"origin": [3.8, 22.2, -0.2], "size": [1.3, 5.0, 1.6], "uv": pelo},
    ]))
    falda = caras(resto="falda")
    bones.append(bone("falda", [0, 12, 0], "waist", [
        {"origin": [-4.7, 5.0, -2.7], "size": [9.4, 7.6, 5.4], "uv": falda},
        {"origin": [-5.1, 3.0, -3.1], "size": [10.2, 2.2, 6.2], "uv": falda},
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
    brillo = {f: {"uv": [32, 8], "uv_size": [8, 2]} for f in FACES}

    def anillo_horizontal(rr, ancho, segs=32):
        w = 2 * rr * math.tan(math.pi / segs) * 1.04
        return [{"origin": [round(-w / 2, 3), round(center_y - ancho / 2, 3), round(-rr, 3)], "size": [round(w, 3), ancho, 0],
                 "uv": brillo, "pivot": [0, center_y, 0], "rotation": [0, j * 360 / segs, 0]} for j in range(segs)]

    # Meridianos luminosos (giran con la esfera): 8 círculos que pasan por los polos.
    rm = radius * 1.01
    h = 2 * rm * math.tan(math.pi / 24) * 1.05
    for i in range(8):
        cubos = [{"origin": [-0.6, round(center_y - h / 2, 3), round(-rm, 3)], "size": [1.2, round(h, 3), 0], "uv": brillo,
                  "pivot": [0, center_y, 0], "rotation": [k * 15, 0, 0]} for k in range(24)]
        bones.append(bone(f"brillo_meridiano_{i}", [0, center_y, 0], "esfera", cubos, rotation=[0, i * 22.5, 0]))
    # Ecuador y dos órbitas inclinadas, más anchas.
    bones.append(bone("brillo_anillo", [0, center_y, 0], None, anillo_horizontal(radius * 1.04, 2.0)))
    bones.append(bone("brillo_orbita_a", [0, center_y, 0], None, anillo_horizontal(radius * 1.12, 1.4), rotation=[35, 0, 0]))
    bones.append(bone("brillo_orbita_b", [0, center_y, 0], None, anillo_horizontal(radius * 1.12, 1.4), rotation=[-35, 0, 0]))
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
    # Ojo derecho: núcleo blanco que se vuelve oro hacia el borde; rayos que se apagan en las puntas.
    u, v, w, h = REG["nucleo"]
    for y in range(h):
        for x in range(w):
            r = math.hypot(x - (w - 1) / 2, y - (h - 1) / 2) / (w / 2)
            c = [BLANCO[i] + (ORO_CLARO[i] - BLANCO[i]) * min(1, r) for i in range(3)]
            px[u + x, v + y] = tuple(clamp(k) for k in c) + (0,)
    def gradiente(t):  # 0 centro, 1 punta
        if t < 0.35:
            a, b, k = BLANCO, ORO_CLARO, t / 0.35
        else:
            a, b, k = ORO_CLARO, ORO_OSCURO, (t - 0.35) / 0.65
        return tuple(clamp(a[i] + (b[i] - a[i]) * k) for i in range(3)) + (0,)
    u, v, w, h = REG["rayo"]
    for x in range(w):
        px[u + x, v] = gradiente(abs(x - (w - 1) / 2) / ((w - 1) / 2))
    u, v, w, h = REG["rayo_v"]
    for y in range(h):
        px[u, v + y] = gradiente(abs(y - (h - 1) / 2) / ((h - 1) / 2))
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


# Estilos de los maestros: el normal y los genios (pelo, ropa de su época, bigote, falda).
ESTILOS = {
    "maestro": dict(pelo=PELO, pelo_claro=PELO_CLARO, cana=CANA, peinado="formal",
                    saco=(TWEED, TWEED_OSC, TWEED_CLARO), patron="tweed", abierto=True, coderas=True, boton=BOTON,
                    camisa=CAMISA, corbata=(CORBATA, CORBATA_RAYA), pantalon=(PANTALON, PANTALON_CLARO), zapato=ZAPATO,
                    medias=None, bigote=None, falda=None),
    "einstein": dict(pelo=(222, 222, 218), pelo_claro=(250, 250, 246), cana=None, peinado="salvaje",
                     saco=((124, 116, 104), (100, 92, 82), (148, 140, 126)), patron="punto", abierto=True, coderas=False,
                     boton=(70, 60, 50), camisa=(236, 232, 224), corbata=None, pantalon=((96, 80, 62), (116, 98, 78)),
                     zapato=(70, 50, 36), medias=None, bigote=(236, 236, 232), falda=None),
    "tesla": dict(pelo=(26, 24, 28), pelo_claro=(64, 62, 72), cana=None, peinado="engominado",
                  saco=((40, 40, 48), (28, 28, 34), (62, 62, 72)), patron="raya", abierto=True, coderas=False,
                  boton=(20, 20, 24), camisa=(244, 242, 236), corbata=((30, 30, 36), (90, 26, 40)),
                  pantalon=((40, 40, 48), (56, 56, 66)), zapato=(18, 18, 20), medias=None, bigote=(30, 28, 30), falda=None),
    "curie": dict(pelo=(66, 44, 32), pelo_claro=(96, 66, 48), cana=None, peinado="recogido",
                  saco=((36, 34, 38), (24, 22, 26), (56, 54, 60)), patron="liso", abierto=False, coderas=False,
                  boton=(120, 120, 128), camisa=(236, 232, 224), corbata=None, pantalon=((30, 28, 32), (44, 42, 48)),
                  zapato=(24, 22, 22), medias=None, bigote=None, falda=(36, 34, 38)),
    "newton": dict(pelo=(224, 222, 214), pelo_claro=(248, 246, 238), cana=None, peinado="peluca",
                   saco=((104, 40, 38), (78, 28, 28), (130, 58, 52)), patron="liso", abierto=True, coderas=False,
                   boton=(214, 170, 80), camisa=(246, 244, 238), corbata=((246, 244, 238), (222, 218, 208)),
                   pantalon=((62, 40, 34), (80, 54, 46)), zapato=(26, 22, 20), medias=(236, 234, 228), bigote=None, falda=None),
    "lovelace": dict(pelo=(58, 38, 30), pelo_claro=(88, 60, 46), cana=None, peinado="rizos",
                     saco=((84, 56, 128), (62, 40, 98), (112, 82, 158)), patron="liso", abierto=False, coderas=False,
                     boton=(226, 216, 236), camisa=(242, 238, 246), corbata=None, pantalon=((70, 46, 108), (92, 64, 136)),
                     zapato=(40, 30, 40), medias=None, bigote=None, falda=(84, 56, 128)),
}


def tela(e, x, y, alpha=255):
    base, osc, claro = e["saco"]
    if e["patron"] == "tweed":
        return tweed(x, y, alpha)
    if e["patron"] == "punto":  # cárdigan de punto: canalé vertical
        c = osc if x % 2 else base
        if (y + x // 2) % 4 == 0:
            c = claro
        return c + (alpha,)
    if e["patron"] == "raya":  # traje con raya diplomática
        return (claro if x % 3 == 0 else base) + (alpha,)
    return (claro if (x * 7 + y * 3) % 11 == 0 else base) + (alpha,)


def maestro_skin(e=None):
    e = e or ESTILOS["maestro"]
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

    camisa = e["camisa"]
    sombra = tuple(int(c * 0.88) for c in camisa)
    corbata = e["corbata"]
    pant, pant_claro = e["pantalon"]
    # Camisa (capa base del cuerpo) con corbata pintada y cinturón.
    for face, (x0, y0, w, h) in box_regions(16, 16, 8, 12, 4).items():
        def base(x, y, w, h, face=face):
            if y >= 10:
                if face == "north" and y == 10 and x in (3, 4):
                    return e["boton"] + (255,)
                return (pant if y == 11 else (58, 40, 30)) + (255,)
            c = sombra if face in ("south", "east", "west") else camisa
            if corbata and face == "north" and x in (3, 4) and 1 <= y <= 8:
                c = corbata[1] if (y + x) % 3 == 0 else corbata[0]
            return c + (255,)
        region(px, x0, y0, w, h, base)
    # Saco, cárdigan, levita o vestido (capa exterior).
    for face, (x0, y0, w, h) in box_regions(16, 32, 8, 12, 4).items():
        def saco(x, y, w, h, face=face):
            osc = e["saco"][1] + (255,)
            if face == "north":
                if e["abierto"]:
                    abierto = (2 <= x <= 5) if y <= 2 else (3 <= x <= 4)
                    if abierto:
                        return (0, 0, 0, 0)
                    if (x in (2, 5) and y <= 6) or (x in (1, 6) and y <= 1):
                        return osc  # solapas
                    if x == 2 and y in (7, 9):
                        return e["boton"] + (255,)
                    if e["patron"] == "tweed" and x in (5, 6) and y == 3:
                        return osc  # bolsillo
                    if e["patron"] == "tweed" and x == 6 and y == 2:
                        return (60, 90, 200, 255)  # pluma
                else:
                    if y == 0 and 1 <= x <= 6:
                        return camisa + (255,)  # cuello de encaje
                    if y == 1 and 2 <= x <= 5:
                        return camisa + (255,)
                    if x in (3, 4) and y in (3, 5, 7):
                        return e["boton"] + (255,)
            if face == "south" and x in (3, 4) and y >= 8:
                return osc
            return tela(e, x, y)
        region(px, x0, y0, w, h, saco)
    # Mangas (las 3 filas de abajo quedan abiertas: puño y mano), con coderas si es de tweed.
    for base_u, base_v in ((40, 32), (48, 48)):
        for face, (x0, y0, w, h) in box_regions(base_u, base_v, 4, 12, 4).items():
            def manga(x, y, w, h, face=face):
                if face == "down" or (face != "up" and y >= 9):
                    return (0, 0, 0, 0)
                if e["coderas"] and face == "south" and 4 <= y <= 6 and 1 <= x <= 2:
                    return PARCHE + (255,)
                if face != "up" and y == 8:
                    return e["saco"][1] + (255,)
                return tela(e, x, y)
            region(px, x0, y0, w, h, manga)
    # Brazos base: manga de camisa, puño claro y mano naranja.
    for base_u, base_v in ((40, 16), (32, 48)):
        for face, (x0, y0, w, h) in box_regions(base_u, base_v, 4, 12, 4).items():
            def brazo(x, y, w, h, face=face):
                if face == "down" or y >= 10:
                    return NARANJA + (255,) if face != "down" else NARANJA_OSCURO + (255,)
                if y == 9:
                    return BLANCO + (255,)
                return (sombra if face in ("south", "east", "west") else camisa) + (255,)
            region(px, x0, y0, w, h, brazo)
    # Pantalón (o medias bajo la falda) y zapatos; Newton lleva calzas y medias blancas.
    for base_u, base_v in ((0, 16), (16, 48)):
        for face, (x0, y0, w, h) in box_regions(base_u, base_v, 4, 12, 4).items():
            def pierna(x, y, w, h, face=face):
                if face == "down":
                    return SUELA + (255,)
                if face == "up":
                    return pant + (255,)
                if y == 11:
                    return SUELA + (255,)
                if y == 10:
                    if e["medias"] and face == "north" and x in (1, 2):
                        return e["boton"] + (255,)  # hebilla
                    return e["zapato"] + (255,)
                if e["medias"] and y >= 6:
                    return e["medias"] + (255,)
                if face == "north" and x == 1 and not e["falda"]:
                    return pant_claro + (255,)
                return pant + (255,)
            region(px, x0, y0, w, h, pierna)
    # Cabello (capa de la cabeza) según el peinado.
    pelo, claro, cana = e["pelo"] + (255,), e["pelo_claro"] + (255,), (e["cana"] or e["pelo"]) + (255,)
    nada = (0, 0, 0, 0)
    peinado = e["peinado"]
    reg = box_regions(32, 0, 8, 8, 8)
    region(px, *reg["down"], lambda x, y, w, h: nada)
    if peinado == "formal":
        region(px, *reg["up"], lambda x, y, w, h: claro if x == 2 or (x + y) % 4 == 0 else pelo)
    elif peinado in ("engominado", "rizos"):
        region(px, *reg["up"], lambda x, y, w, h: claro if x in (3, 4) and peinado == "rizos" else (claro if (x + y) % 5 == 0 or x in (3, 4) else pelo))
    elif peinado == "peluca":
        region(px, *reg["up"], lambda x, y, w, h: claro if (x + 2 * y) % 3 == 0 else pelo)
    else:  # salvaje y recogido
        region(px, *reg["up"], lambda x, y, w, h: claro if (x * 5 + y * 3) % 4 == 0 else pelo)

    def frente(x, y, w, h):
        if peinado == "formal":
            return (claro if x == 2 else pelo) if y == 0 or (y == 1 and x <= 4) else nada
        if peinado == "salvaje":
            return (claro if (x + y) % 2 else pelo) if y == 0 or (y == 1 and x not in (3, 4)) or (y == 2 and x in (0, 7)) else nada
        if peinado in ("engominado", "recogido"):
            return pelo if y == 0 or (y == 1 and x not in (3, 4)) else nada
        if peinado == "peluca":
            return (claro if x % 2 else pelo) if y == 0 or (y <= 2 and x in (0, 1, 6, 7)) else nada
        return pelo if y == 0 or (y == 1 and x not in (3, 4)) or (y == 2 and x in (0, 7)) else nada  # rizos

    def lado(atras_izq):
        def f(x, y, w, h):
            atras = x if atras_izq else w - 1 - x  # 0 = nuca
            if peinado == "peluca":
                return (claro if (x + y) % 2 else pelo) if atras <= 6 or y <= 2 else nada
            if peinado == "salvaje":
                return (claro if (x + y) % 3 == 0 else pelo) if y <= 5 or atras <= 5 else nada
            if y <= 2:
                return pelo
            if y <= 5 and atras <= 4:
                return cana if e["cana"] and atras == 4 and y >= 4 else pelo
            if peinado == "formal" and y <= 4 and atras == 5:
                return cana  # patilla
            return nada
        return f

    region(px, *reg["north"], frente)
    region(px, *reg["east"], lado(True))
    region(px, *reg["west"], lado(False))
    largo = 7 if peinado in ("peluca", "salvaje", "rizos") else 5
    region(px, *reg["south"], lambda x, y, w, h: pelo if y <= largo or (y == largo + 1 and 1 <= x <= 6) else nada)
    # Piezas 3D: pelo, lentes, vidrio, corbata, cuello, bigote, falda y libro.
    region(px, *REG["pelo"], lambda x, y, w, h: claro if (x + y) % 3 == 0 else pelo)
    region(px, *REG["marco"], lambda x, y, w, h: (MARCO_BRILLO if x == 0 and y == 0 else MARCO) + (255,))
    region(px, *REG["vidrio"], lambda x, y, w, h: (BLANCO + (150,)) if x == 0 and y == 0 else VIDRIO + (52,))
    corb = corbata or (CORBATA, CORBATA_RAYA)
    region(px, *REG["corbata"], lambda x, y, w, h: corb[0] + (255,))
    region(px, *REG["corbata_larga"], lambda x, y, w, h: (corb[1] if y % 2 == 0 else corb[0]) + (255,))
    region(px, *REG["cuello"], lambda x, y, w, h: camisa + (255,))
    bigote = e["bigote"] or (0, 0, 0)
    region(px, *REG["bigote"], lambda x, y, w, h: (tuple(int(c * 0.85) for c in bigote) if y == h - 1 else bigote) + (255,))
    falda = e["falda"] or e["saco"][0]
    region(px, *REG["falda"], lambda x, y, w, h: (tuple(int(c * 0.82) for c in falda) if x % 3 == 0 else falda) + (255,))

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


def sphere_texture(color=(255, 196, 64)):
    """Cáscara dorada translúcida (más intensa en los bordes de cada gajo) y el
    color de los anillos luminosos (alfa 0 = brillo total con el material emisivo)."""
    img = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
    px = img.load()
    for y in range(32):
        for x in range(32):
            edge = min(x, y, 31 - x, 31 - y)
            a = {0: 230, 1: 170, 2: 120}.get(edge, 60 + 50 * max(0.0, 1 - (edge - 3) / 9))
            brillo = 1 + 0.25 * math.exp(-((x - 10) ** 2 + (y - 9) ** 2) / 40)  # reflejo
            px[x, y] = tuple(clamp(c * brillo) for c in color) + (clamp(a),)
    for y in range(8, 10):
        for x in range(32, 40):
            px[x, y] = ((255, 255, 236) if x in (35, 36) else (255, 214, 92)) + (0,)
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
    def p(name, sprite, comps, color, size, material="particles_add", facing="lookat_xyz"):
        u, v, w, h = ATLAS[sprite]
        billboard = {"size": size, "facing_camera_mode": facing,
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
    # Poderes de Claude Golden.
    p("aviso", "anillo", {**inst(1), "minecraft:emitter_shape_point": {}, **life(0.32), **spd(0), **mot()},
      {"0.0": "#FFFF5040", "0.5": "#FFFFD25A", "1.0": "#00FFD25A"}, sz(1.0), facing="emitter_transform_xz")
    p("estallido", "brillo", {**inst(2), "minecraft:emitter_shape_point": {}, **life(0.35), **spd(0), **mot()},
      {"0.0": "#FFFFFFFF", "0.4": "#FFFFE08C", "1.0": "#00FFAA1E"}, sz(0.3, 2.2))
    p("chispa_cae", "brillo", {**inst(1), "minecraft:emitter_shape_point": {}, **life(0.15), **spd(0), **mot()},
      {"0.0": "#FFFFFFFF", "1.0": "#80FFD25A"}, sz(0.45))
    p("onda_chispa", "chispa", {**inst(1), "minecraft:emitter_shape_point": {}, **life(0.25), **spd(0),
                                **mot(linear_acceleration=[0, 1.5, 0])},
      {"0.0": "#FFFFF0B4", "1.0": "#00FFAA1E"}, sz(0.22, 0.05))
    p("sol", "brillo", {**inst(1), "minecraft:emitter_shape_point": {}, **life(0.18), **spd(0), **mot()},
      {"0.0": "#FFFFF5C8", "1.0": "#00FF9628"}, sz(2.4, 2.8))
    p("sol_rayo", "chispa", {**inst(5), "minecraft:emitter_shape_box": {"half_dimensions": [0.8, 0.2, 0.8]},
                             **life(0.6), **spd(0), **mot(linear_acceleration=[0, -14, 0])},
      {"0.0": "#FFFFDC78", "1.0": "#00FF8C28"}, sz(0.12))
    p("agujero", "brillo", {**inst(1), "minecraft:emitter_shape_point": {}, **life(0.14), **spd(0), **mot()},
      {"0.0": "#F014081E", "1.0": "#0014081E"}, sz(1.1), "particles_alpha")
    p("nota", "nota", {**inst(1), "minecraft:emitter_shape_point": {}, **life(0.1), **spd(0), **mot(),
                       "minecraft:particle_appearance_tinting": {"color": [
                           "0.6 + variable.particle_random_1 * 0.4", "0.4 + variable.particle_random_2 * 0.6",
                           "0.5 + variable.particle_random_3 * 0.5", 1]}},
      {"0.0": "#FFFFFFFF", "1.0": "#FFFFFFFF"}, sz(0.32))
    p("espejo", "estrella", {**inst(1), "minecraft:emitter_shape_point": {}, **life(0.3), **spd(0), **mot()},
      {"0.0": "#FFE6F5FF", "1.0": "#00A0DCFF"}, sz(0.16, 0.04))
    # Firmas de los maestros genios.
    p("chispa_electrica", "chispa", {**inst(6), "minecraft:emitter_shape_sphere": {"radius": 0.25, "direction": "outwards"},
                                     **life(0.25), **spd(2.2), **mot(linear_drag_coefficient=5)},
      {"0.0": "#FFFFFFFF", "0.5": "#FFA0E6FF", "1.0": "#005AA0FF"}, sz(0.08, 0.02))
    p("brillo_verde", "brillo", {**inst(5), "minecraft:emitter_shape_box": {"half_dimensions": [0.4, 0.8, 0.4]},
                                 **life(1.0), **spd(0), **mot(linear_acceleration=[0, 0.5, 0])},
      {"0.0": "#C8B4FF8C", "1.0": "#0050FF64"}, sz(0.14, 0.04))
    p("binario", "cuadro", {**inst(8), "minecraft:emitter_shape_box": {"half_dimensions": [0.5, 0.2, 0.5]},
                            **life(1.0), **spd(0), **mot(linear_acceleration=[0, 0.7, 0])},
      {"0.0": "#FF78FFDC", "1.0": "#0050C8FF"}, sz(0.05))
    # Robot: láser del visor y carga.
    p("laser", "brillo", {**inst(1), "minecraft:emitter_shape_point": {}, **life(0.09), **spd(0), **mot()},
      {"0.0": "#FFFFFFFF", "0.4": "#FFFF6E46", "1.0": "#00FF2814"}, sz(0.32))
    p("carga", "chispa", {**inst(8), "minecraft:emitter_shape_sphere": {"radius": 0.9, "surface_only": True, "direction": "inwards"},
                          **life(0.3), **spd(2.4), **mot(linear_drag_coefficient=1)},
      {"0.0": "#FFFFFFFF", "1.0": "#FFFF4632"}, sz(0.1, 0.03))
    # Humo y llama del misil, vapor del robot: emisores en bucle pegados a un localizador.
    def rastro(name, sprite, rate, vida, color, size, material, accel, local):
        u, v, w, h = ATLAS[sprite]
        write_json(RP / f"particles/{name}.particle.json", {"format_version": "1.10.0", "particle_effect": {
            "description": {"identifier": f"claudenpc:{name}",
                            "basic_render_parameters": {"material": material, "texture": "textures/particle/claudenpc"}},
            "components": {
                "minecraft:emitter_local_space": {"position": local, "rotation": local},
                "minecraft:emitter_rate_steady": {"spawn_rate": rate, "max_particles": 60},
                "minecraft:emitter_lifetime_looping": {"active_time": 1},
                "minecraft:emitter_shape_sphere": {"radius": 0.08},
                "minecraft:particle_lifetime_expression": {"max_lifetime": vida},
                "minecraft:particle_initial_speed": 0,
                "minecraft:particle_motion_dynamic": {"linear_acceleration": accel, "linear_drag_coefficient": 1},
                "minecraft:particle_appearance_billboard": {"size": size, "facing_camera_mode": "lookat_xyz",
                    "uv": {"texture_width": 64, "texture_height": 32, "uv": [u, v], "uv_size": [w, h]}},
                "minecraft:particle_appearance_tinting": {"color": {"gradient": color,
                    "interpolant": "variable.particle_age / variable.particle_lifetime"}}}}})
    edad = "variable.particle_age / variable.particle_lifetime"
    rastro("humo_misil", "humo", 40, 0.9, {"0.0": "#C8B4B4B4", "1.0": "#00646464"},
           [f"0.12 + {edad} * 0.35", f"0.12 + {edad} * 0.35"], "particles_alpha", [0, 0.6, 0], False)
    rastro("llama_misil", "brillo", 50, 0.14, {"0.0": "#FFFFF0C8", "0.5": "#FFFFA03C", "1.0": "#00FF5014"},
           [f"0.22 - {edad} * 0.15", f"0.22 - {edad} * 0.15"], "particles_add", [0, 0, 0], False)
    rastro("vapor", "humo", 6, 1.4, {"0.0": "#78E6E6F0", "1.0": "#00C8C8D2"},
           [f"0.15 + {edad} * 0.4", f"0.15 + {edad} * 0.4"], "particles_alpha", [0, 1.2, 0], False)
    # Esplendor del ojo derecho: emisores en bucle pegados al localizador del ojo.
    def ojo(name, sprite, rate, vida, color, size, spin):
        u, v, w, h = ATLAS[sprite]
        write_json(RP / f"particles/{name}.particle.json", {"format_version": "1.10.0", "particle_effect": {
            "description": {"identifier": f"claudenpc:{name}",
                            "basic_render_parameters": {"material": "particles_add", "texture": "textures/particle/claudenpc"}},
            "components": {
                "minecraft:emitter_local_space": {"position": True, "rotation": True},
                "minecraft:emitter_rate_steady": {"spawn_rate": rate, "max_particles": 16},
                "minecraft:emitter_lifetime_looping": {"active_time": 1},
                "minecraft:emitter_shape_point": {},
                "minecraft:particle_lifetime_expression": {"max_lifetime": vida},
                "minecraft:particle_initial_spin": {"rotation": "variable.particle_random_1 * 360", "rotation_rate": spin},
                "minecraft:particle_initial_speed": 0,
                "minecraft:particle_motion_dynamic": {},
                "minecraft:particle_appearance_billboard": {"size": size, "facing_camera_mode": "rotate_xyz",
                    "uv": {"texture_width": 64, "texture_height": 32, "uv": [u, v], "uv_size": [w, h]}},
                "minecraft:particle_appearance_tinting": {"color": {"gradient": color,
                    "interpolant": "variable.particle_age / variable.particle_lifetime"}}}}})
    pulso = "(0.32 + math.sin(variable.particle_age * 1400) * 0.06)"
    ojo("ojo_golden", "estrella", 30, 0.22, {"0.0": "#FFFFFFFF", "0.5": "#FFFFE896", "1.0": "#00FFB43C"}, [pulso, pulso], 160)
    ojo("ojo_halo", "brillo", 14, 0.3, {"0.0": "#B4FFF0B4", "1.0": "#00FFC850"}, [0.42, 0.42], 0)
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
        "animation.claudenpc.pilotar": {"animation_length": 2.0, "bones": {
            "rightArm": {"rotation": k((0, [-55, 0, 8]), (0.5, [-62, 0, 4]), (1.0, [-55, 0, 8]), (1.5, [-50, 0, 10]), (2.0, [-55, 0, 8]))},
            "leftArm": {"rotation": k((0, [-55, 0, -8]), (0.5, [-50, 0, -10]), (1.0, [-55, 0, -8]), (1.5, [-62, 0, -4]), (2.0, [-55, 0, -8]))},
            "head": {"rotation": [6, 0, 0]}}},
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


# =============================================================================
# Robot de los Claudes (textura 128x128, frente hacia -z) y su misil
# =============================================================================

REG_ROBOT = {
    "metal": (0, 0, 16, 16), "metal_osc": (16, 0, 16, 16), "naranja": (32, 0, 16, 16), "junta": (48, 0, 8, 8),
    "rejilla": (56, 0, 8, 8), "peligro": (64, 0, 16, 4), "cristal": (64, 4, 8, 8), "cian": (72, 4, 4, 4),
    "brillo_naranja": (76, 4, 4, 4), "rojo": (80, 4, 4, 4), "emblema": (80, 8, 16, 16), "tubo": (96, 0, 8, 8),
    "lente": (104, 0, 8, 8), "canon": (112, 0, 8, 8),
}


def caras_r(**por_cara):
    resto = por_cara.get("resto")
    uv = {}
    for face in FACES:
        u, v, w, h = REG_ROBOT[por_cara.get(face, resto)]
        uv[face] = {"uv": [u, v], "uv_size": [w, h]}
    return uv


def cubo(origin, size, **uv):
    return {"origin": origin, "size": size, "uv": caras_r(**uv)}


def espejo_x(c):
    """Copia un cubo al otro lado (x → -x)."""
    o, sz = c["origin"], c["size"]
    return {**c, "origin": [round(-(o[0] + sz[0]), 3), o[1], o[2]]}


def robot_geometry():
    bones = [bone("root", [0, 0, 0])]
    for lado, sx in (("der", -1), ("izq", 1)):
        def c(cb):
            return cb if sx < 0 else espejo_x(cb)
        bones.append(bone(f"pierna_{lado}", [8 * sx, 36, 0], "root", [
            c(cubo([-13, 22, -5], [10, 14, 10], resto="metal_osc")),
            c(cubo([-12, 33, -6], [8, 3, 12], resto="junta"))]))
        bones.append(bone(f"espinilla_{lado}", [8 * sx, 22, 0], f"pierna_{lado}", [
            c(cubo([-13.5, 6, -6], [11, 16, 12], north="naranja", resto="metal")),
            c(cubo([-12, 18, -7.2], [8, 6, 1.2], resto="metal_osc"))]))
        bones.append(bone(f"pie_{lado}", [8 * sx, 4, 0], f"espinilla_{lado}", [
            c(cubo([-15, 0, -11], [14, 6, 18], up="metal", north="peligro", resto="metal_osc"))]))
    bones.append(bone("cadera", [0, 36, 0], "root", [cubo([-12, 33, -8], [24, 8, 16], resto="junta")]))
    torso = bone("torso", [0, 41, 0], "cadera", [
        cubo([-16, 41, -10], [32, 26, 20], north="naranja", resto="metal"),
        cubo([-11, 46, -11], [22, 16, 1], resto="metal"),
        cubo([-5, 50, -11.8], [10, 10, 0.8], resto="emblema"),
        cubo([-12, 63, -10.7], [24, 3, 0.7], resto="cian"),
        cubo([-11, 48, 10], [22, 12, 1], resto="rejilla"),
        cubo([-16, 41, -10.5], [32, 3, 0.5], resto="peligro")])
    torso["locators"] = {"visor": [0, 64.5, -11.5], "nucleo": [0, 55, -12.5], "escape_der": [-7, 55, 11.5], "escape_izq": [7, 55, 11.5]}
    bones.append(torso)
    bones.append(bone("cabina", [0, 67, 0], "torso", [cubo([-10, 67, -8], [20, 3, 16], resto="metal_osc")]))
    bones.append(bone("cupula", [0, 70, 0], "cabina", [cubo([-8.5, 70, -7], [17, 12, 14], resto="cristal")]))
    for lado, sx in (("der", -1), ("izq", 1)):
        def c(cb):
            return cb if sx < 0 else espejo_x(cb)
        bones.append(bone(f"hombro_{lado}", [20 * sx, 64, 0], "torso", [
            c(cubo([-27, 58, -8], [11, 10, 16], up="naranja", north="naranja", resto="metal"))]))
        tubos = [c(cubo([x, y, -7.6], [3.5, 3, 0.6], resto="tubo")) for x in (-26.5, -20.5) for y in (69, 72.5)]
        pod = bone(f"pod_{lado}", [21.5 * sx, 70, 0], f"hombro_{lado}", [c(cubo([-28, 68, -7], [13, 8, 14], resto="metal_osc"))] + tubos)
        pod["locators"] = {f"misil_{lado}": [21.5 * sx, 72, -8]}
        bones.append(pod)
        bones.append(bone(f"brazo_{lado}", [21 * sx, 60, 0], "torso", [
            c(cubo([-25, 45, -5], [8, 15, 10], resto="metal")),
            c(cubo([-24, 42.5, -4], [6, 3, 8], resto="junta"))]))
        bones.append(bone(f"antebrazo_{lado}", [21 * sx, 45, 0], f"brazo_{lado}", [
            c(cubo([-26.5, 27, -6.5], [11, 18, 13], north="naranja", resto="metal"))]))
    # Brazo derecho: minigun de tres cañones; brazo izquierdo: cañón láser.
    bones.append(bone("canones_der", [-21, 26, 0], "antebrazo_der", [
        cubo([-23.7, 18, -2.6], [2.2, 9, 2.2], down="canon", resto="metal_osc"),
        cubo([-20.3, 18, -2.6], [2.2, 9, 2.2], down="canon", resto="metal_osc"),
        cubo([-22.0, 18, 0.6], [2.2, 9, 2.2], down="canon", resto="metal_osc")]))
    bones.append(bone("laser_izq", [21, 25, 0], "antebrazo_izq", [
        cubo([17.5, 22.5, -4.5], [7, 4.5, 9], down="lente", north="rojo", resto="metal_osc")]))
    return {"format_version": "1.16.0", "minecraft:geometry": [{
        "description": {"identifier": "geometry.claudenpc.robot", "texture_width": 128, "texture_height": 128,
                        "visible_bounds_width": 6, "visible_bounds_height": 7, "visible_bounds_offset": [0, 3, 0]},
        "bones": bones}]}


def robot_texture():
    img = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    px = img.load()

    def panel(name, base, oscuro, claro, remaches=True):
        u, v, w, h = REG_ROBOT[name]
        for y in range(h):
            for x in range(w):
                c = [base[i] + (claro[i] - base[i]) * (1 - y / max(h - 1, 1)) * 0.5 for i in range(3)]
                if x in (0, w - 1) or y in (0, h - 1):
                    c = oscuro
                elif x == w // 2 and 2 < y < h - 3:
                    c = [k * 0.9 for k in c]  # línea de panel
                if remaches and (x, y) in ((2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3)):
                    c = claro
                n = ((x * 7 + y * 13) % 5 - 2) * 1.5
                px[u + x, v + y] = tuple(clamp(k + n) for k in c) + (255,)

    panel("metal", (150, 156, 166), (96, 100, 110), (196, 202, 212))
    panel("metal_osc", (86, 92, 104), (52, 56, 64), (122, 128, 140))
    panel("naranja", NARANJA, NARANJA_OSCURO, NARANJA_CLARO)
    u, v, w, h = REG_ROBOT["junta"]
    for y in range(h):
        for x in range(w):
            px[u + x, v + y] = ((54, 54, 60) if y % 2 else (36, 36, 42)) + (255,)
    u, v, w, h = REG_ROBOT["rejilla"]
    for y in range(h):
        for x in range(w):
            px[u + x, v + y] = ((24, 26, 30) if y % 2 else (110, 116, 126)) + (255,)
    u, v, w, h = REG_ROBOT["peligro"]
    for y in range(h):
        for x in range(w):
            px[u + x, v + y] = ((240, 196, 40) if ((x + y) // 2) % 2 else (30, 30, 30)) + (255,)
    u, v, w, h = REG_ROBOT["cristal"]
    for y in range(h):
        for x in range(w):
            borde = x in (0, w - 1) or y in (0, h - 1)
            px[u + x, v + y] = ((230, 245, 255, 200) if (x == 2 and y < 4) else ((140, 200, 240, 170) if borde else (150, 210, 245, 90)))
    for name, color in (("cian", (90, 240, 255)), ("brillo_naranja", (255, 170, 70)), ("rojo", (255, 70, 60))):
        u, v, w, h = REG_ROBOT[name]
        for y in range(h):
            for x in range(w):
                px[u + x, v + y] = color + (0,)
    u, v, w, h = REG_ROBOT["emblema"]
    for y in range(h):
        for x in range(w):
            px[u + x, v + y] = (NARANJA_OSCURO if x in (0, w - 1) or y in (0, h - 1) else NARANJA) + (255,)
    for dx, dy in [(0, -5), (0, -4), (0, -3), (0, -2), (0, 2), (0, 3), (0, 4), (0, 5), (-5, 0), (-4, 0), (-3, 0), (-2, 0),
                   (2, 0), (3, 0), (4, 0), (5, 0), (-1, -1), (1, -1), (-1, 1), (1, 1), (0, -1), (0, 1), (-1, 0), (1, 0), (0, 0)]:
        px[u + 8 + dx, v + 8 + dy] = CREMA + (0,)
    for name, color in (("tubo", (255, 150, 60)), ("lente", (255, 60, 50))):
        u, v, w, h = REG_ROBOT[name]
        for y in range(h):
            for x in range(w):
                r = math.hypot(x - (w - 1) / 2, y - (h - 1) / 2)
                if r < 1.6:
                    px[u + x, v + y] = (255, 240, 220, 0)
                elif r < 2.6:
                    px[u + x, v + y] = color + (0,)
                else:
                    px[u + x, v + y] = (40, 42, 48, 255)
    u, v, w, h = REG_ROBOT["canon"]
    for y in range(h):
        for x in range(w):
            r = math.hypot(x - (w - 1) / 2, y - (h - 1) / 2)
            px[u + x, v + y] = ((14, 14, 16) if r < 1.8 else (70, 74, 82)) + (255,)
    return img


def misil_geometry():
    return {"format_version": "1.16.0", "minecraft:geometry": [{
        "description": {"identifier": "geometry.claudenpc.misil", "texture_width": 32, "texture_height": 32,
                        "visible_bounds_width": 1.5, "visible_bounds_height": 1.5, "visible_bounds_offset": [0, 0.3, 0]},
        "bones": [{"name": "cuerpo", "pivot": [0, 4.5, 0], "locators": {"cola": [0, 4.5, 6]}, "cubes": [
            {"origin": [-1.5, 3, -5], "size": [3, 3, 10], "uv": {f: {"uv": [0, 0], "uv_size": [8, 8]} for f in FACES}},
            {"origin": [-1, 3.5, -7], "size": [2, 2, 2], "uv": {f: {"uv": [8, 0], "uv_size": [4, 4]} for f in FACES}},
            {"origin": [-3, 4.3, 3], "size": [6, 0.4, 2], "uv": {f: {"uv": [12, 0], "uv_size": [4, 4]} for f in FACES}},
            {"origin": [-0.2, 1.5, 3], "size": [0.4, 6, 2], "uv": {f: {"uv": [12, 0], "uv_size": [4, 4]} for f in FACES}},
            {"origin": [-1, 3.5, 5], "size": [2, 2, 1.5], "uv": {f: {"uv": [16, 0], "uv_size": [4, 4]} for f in FACES}},
        ]}]}]}


def misil_texture():
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    px = img.load()
    for y in range(8):
        for x in range(8):
            px[x, y] = ((236, 236, 240) if y not in (2, 5) else (217, 119, 87)) + (255,)
    for y in range(4):
        for x in range(4):
            px[8 + x, y] = (217, 119, 87, 255)
            px[12 + x, y] = (90, 96, 108, 255)
            px[16 + x, y] = (255, 190, 90, 0)  # llama luminosa
    return img


def robot_animations():
    paso = "query.modified_distance_moved * 22"
    fuerza = "math.min(query.modified_move_speed * 1.6, 1)"
    r = "animation.claudenpc.robot."
    return {"format_version": "1.8.0", "animations": {
        r + "caminar": {"loop": True, "bones": {
            "pierna_der": {"rotation": [f"math.sin({paso}) * 28 * {fuerza}", 0, 0]},
            "pierna_izq": {"rotation": [f"-math.sin({paso}) * 28 * {fuerza}", 0, 0]},
            "espinilla_der": {"rotation": [f"math.max(0, -math.sin({paso})) * 30 * {fuerza}", 0, 0]},
            "espinilla_izq": {"rotation": [f"math.max(0, math.sin({paso})) * 30 * {fuerza}", 0, 0]},
            "brazo_der": {"rotation": [f"-math.sin({paso}) * 12 * {fuerza}", 0, 0]},
            "brazo_izq": {"rotation": [f"math.sin({paso}) * 12 * {fuerza}", 0, 0]},
            "torso": {"position": [0, f"math.abs(math.cos({paso})) * 1.2 * {fuerza}", 0],
                      "rotation": [0, f"math.sin({paso}) * 4 * {fuerza}", 0]}}},
        r + "reposo": {"loop": True, "bones": {
            "torso": {"position": [0, "math.sin(query.life_time * 90) * 0.4", 0]},
            "pod_der": {"rotation": ["math.sin(query.life_time * 60) * 2", 0, 0]},
            "pod_izq": {"rotation": ["-math.sin(query.life_time * 60) * 2", 0, 0]}}},
        r + "misiles": {"animation_length": 1.2, "bones": {
            "pod_der": {"rotation": k((0, Z), (0.2, [-30, 0, 0]), (0.5, [-22, 0, 0]), (0.7, [-30, 0, 0]), (0.9, [-22, 0, 0]), (1.2, Z))},
            "pod_izq": {"rotation": k((0, Z), (0.2, [-30, 0, 0]), (0.5, [-22, 0, 0]), (0.7, [-30, 0, 0]), (0.9, [-22, 0, 0]), (1.2, Z))},
            "torso": {"rotation": k((0, Z), (0.3, [4, 0, 0]), (0.5, [-2, 0, 0]), (0.8, [4, 0, 0]), (1.2, Z))}}},
        r + "laser": {"animation_length": 3.2, "bones": {
            "torso": {"rotation": k((0, Z), (0.4, [8, 0, 0]), (2.8, [8, 0, 0]), (3.2, Z))},
            "brazo_izq": {"rotation": k((0, Z), (0.4, [-30, 0, -10]), (2.8, [-30, 0, -10]), (3.2, Z))},
            "brazo_der": {"rotation": k((0, Z), (0.4, [-30, 0, 10]), (2.8, [-30, 0, 10]), (3.2, Z))},
            "cabina": {"scale": k((0, [1, 1, 1]), (0.9, [1.06, 1.06, 1.06]), (1.0, [1, 1, 1]), (3.2, [1, 1, 1]))}}},
        r + "metralla": {"animation_length": 3.0, "bones": {
            "brazo_der": {"rotation": k((0, Z), (0.3, [-85, 0, 0]), (2.6, [-85, 0, 0]), (3.0, Z))},
            "canones_der": {"rotation": [0, "query.anim_time * 1440", 0]},
            "antebrazo_der": {"rotation": k(*[(0.4 + i * 0.1, [0, 0, 2 if i % 2 else -2]) for i in range(22)], (0, Z), (3.0, Z))}}},
        r + "pisoton": {"animation_length": 1.3, "bones": {
            "pierna_der": {"rotation": k((0, Z), (0.4, [-50, 0, 0]), (0.6, [5, 0, 0]), (0.8, Z), (1.3, Z))},
            "espinilla_der": {"rotation": k((0, Z), (0.4, [40, 0, 0]), (0.6, Z), (1.3, Z))},
            "torso": {"position": k((0, Z), (0.6, [0, -2, 0]), (0.8, Z), (1.3, Z))},
            "brazo_der": {"rotation": k((0, Z), (0.4, [-40, 0, 10]), (0.8, Z), (1.3, Z))},
            "brazo_izq": {"rotation": k((0, Z), (0.4, [-40, 0, -10]), (0.8, Z), (1.3, Z))}}},
        r + "golpe": {"animation_length": 0.7, "bones": {
            "brazo_izq": {"rotation": k((0, Z), (0.25, [-110, 0, -10]), (0.4, [-60, 0, 0]), (0.7, Z))},
            "torso": {"rotation": k((0, Z), (0.25, [0, -15, 0]), (0.7, Z))}}},
        r + "alarma": {"loop": True, "bones": {
            "root": {"rotation": [0, 0, "math.sin(query.life_time * 2400) * 1.5"]},
            "torso": {"position": ["math.sin(query.life_time * 3100) * 0.4", 0, 0]},
            "cabina": {"scale": "1 + math.sin(query.life_time * 1800) * 0.05"}}},
        r + "ensamblaje": {"animation_length": 1.6, "bones": {
            "root": {"scale": k((0, [0.6, 0.05, 0.6]), (0.6, [1.05, 1.1, 1.05]), (0.8, [1, 1, 1]), (1.6, [1, 1, 1]))},
            "hombro_der": {"scale": k((0, [0.01, 0.01, 0.01]), (0.6, [0.01, 0.01, 0.01]), (1.0, [1.1, 1.1, 1.1]), (1.2, [1, 1, 1]))},
            "hombro_izq": {"scale": k((0, [0.01, 0.01, 0.01]), (0.7, [0.01, 0.01, 0.01]), (1.1, [1.1, 1.1, 1.1]), (1.3, [1, 1, 1]))},
            "cabina": {"scale": k((0, [0.01, 0.01, 0.01]), (0.9, [0.01, 0.01, 0.01]), (1.4, [1.1, 1.1, 1.1]), (1.6, [1, 1, 1]))}}},
        "animation.claudenpc.misil.orientar": {"loop": True, "bones": {
            "cuerpo": {"rotation": ["query.target_x_rotation", 0, "query.life_time * 720"]}}},
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
        # Ojo derecho: el núcleo late y los rayos giran; en fase 2 (furia) brilla más grande.
        "animation.claudenpc.golden.ojo": {"loop": True, "bones": {
            "ojo_brillo": {"scale": "1.0 + math.sin(query.life_time * 720) * 0.12 + query.property('claudenpc:furia') * 0.25"},
            "ojo_rayos": {"rotation": [0, 0, "query.life_time * 50"],
                          "scale": "0.85 + math.sin(query.life_time * 430) * 0.2 + query.property('claudenpc:furia') * 0.55"}}},
        "animation.claudenpc.golden.golpe": {"animation_length": 0.5, "bones": {
            "rightArm": {"rotation": k((0, Z), (0.12, [-60, 0, -20]), (0.22, [-95, 0, 10]), (0.5, Z))},
            "leftArm": {"rotation": k((0, Z), (0.12, [-60, 0, 20]), (0.22, [-95, 0, -10]), (0.5, Z))},
            "body": {"rotation": k((0, Z), (0.15, [-10, 0, 0]), (0.25, [15, 0, 0]), (0.5, Z))}}},
        "animation.claudenpc.golden.aturdido": {"animation_length": 6.0, "bones": {
            "head": {"rotation": k(*[(t * 0.5, [12, 0, 15 if t % 2 else -15]) for t in range(12)], (6.0, Z))},
            "rightArm": {"rotation": [12, 0, 8]}, "leftArm": {"rotation": [12, 0, -8]},
            "body": {"rotation": k(*[(t * 0.5, [8, 0, 5 if t % 2 else -5]) for t in range(12)], (6.0, Z))}}},
        "animation.claudenpc.golden.risa": {"animation_length": 1.4, "bones": {
            "head": {"rotation": k((0, Z), (0.2, [-25, 0, 0]), (1.2, [-25, 0, 0]), (1.4, Z))},
            "body": {"rotation": k(*[(0.1 + t * 0.1, [-6 if t % 2 else 6, 0, 0]) for t in range(12)], (0, Z), (1.4, Z))},
            "rightArm": {"rotation": k((0, Z), (0.2, [-40, 0, 20]), (1.2, [-40, 0, 20]), (1.4, Z))},
            "leftArm": {"rotation": k((0, Z), (0.2, [-40, 0, -20]), (1.2, [-40, 0, -20]), (1.4, Z))}}},
        "animation.claudenpc.golden.picada": {"animation_length": 1.0, "bones": {
            "body": {"rotation": k((0, Z), (0.15, [50, 0, 0]), (0.8, [50, 0, 0]), (1.0, Z))},
            "head": {"rotation": k((0, Z), (0.15, [-35, 0, 0]), (0.8, [-35, 0, 0]), (1.0, Z))},
            "rightArm": {"rotation": k((0, Z), (0.15, [40, 0, 25]), (0.8, [40, 0, 25]), (1.0, Z))},
            "leftArm": {"rotation": k((0, Z), (0.15, [40, 0, -25]), (0.8, [40, 0, -25]), (1.0, Z))}}},
        "animation.claudenpc.golden.pensar": {"animation_length": 3.0, "bones": {
            "rightArm": {"rotation": k((0, Z), (0.3, [-120, 40, 0]), (2.7, [-120, 40, 0]), (3.0, Z))},
            "head": {"rotation": k((0, Z), (0.3, [10, 0, 10]), (2.7, [10, 0, 10]), (3.0, Z))}}},
    }}


def aura_animations():
    return {"format_version": "1.8.0", "animations": {
        "animation.claudenpc.aura.idle": {"loop": True, "bones": {
            "esfera": {"rotation": [0, "query.life_time * 40", 0],
                       "scale": "math.min(query.life_time * 0.8, 1) * (1 + math.sin(query.life_time * 400) * 0.03)"},
            "brillo_anillo": {"rotation": ["math.sin(query.life_time * 90) * 25", "-query.life_time * 120", 0],
                              "scale": "math.min(query.life_time * 0.8, 1)"},
            "brillo_orbita_a": {"rotation": [0, "query.life_time * 90", 0], "scale": "math.min(query.life_time * 0.8, 1)"},
            "brillo_orbita_b": {"rotation": [0, "-query.life_time * 70", 0], "scale": "math.min(query.life_time * 0.8, 1)"}}}}}


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
        "controller.render.claudenpc_robot": {
            "geometry": "Geometry.default", "textures": ["Texture.default"],
            "materials": [{"*": "Material.default"}, {"cupula": "Material.cristal"}]},
        "controller.render.claudenpc_aura": {
            "geometry": "Geometry.default", "textures": ["Texture.default"],
            "materials": [{"*": "Material.default"}, {"brillo*": "Material.brillo"}]},
        "controller.render.claudenpc_maestro": {
            "arrays": {"textures": {"Array.pieles": ["Texture.default", "Texture.einstein", "Texture.tesla", "Texture.curie",
                                                     "Texture.newton", "Texture.lovelace"]}},
            "geometry": "Geometry.default", "textures": ["Array.pieles[query.property('claudenpc:variante')]"],
            "materials": [{"*": "Material.default"}, {"pin": "Material.glow"}, {"vidrio": "Material.vidrio"}],
            "part_visibility": [{"*": True}, {"lentes": "query.property('claudenpc:variante') == 0"}, {"vidrio": "query.property('claudenpc:variante') == 0"},
                                {"corbata": "query.property('claudenpc:variante') == 0 || query.property('claudenpc:variante') == 2 || query.property('claudenpc:variante') == 4"}, {"bigote": "query.property('claudenpc:variante') == 1 || query.property('claudenpc:variante') == 2"},
                                {"pelo_alborotado": "query.property('claudenpc:variante') == 1"}, {"mono": "query.property('claudenpc:variante') == 3"}, {"peluca": "query.property('claudenpc:variante') == 4"},
                                {"rizos": "query.property('claudenpc:variante') == 5"}, {"falda": "query.property('claudenpc:variante') == 3 || query.property('claudenpc:variante') == 5"}]},
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
                 "pescar_espera", "recoger", "pilotar", "mirar_alrededor", "danza", "fusion"):
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
        "textures": {"default": "textures/entity/claudenpc/maestro", **{n: f"textures/entity/claudenpc/maestro_{n}"
                     for n in ("einstein", "tesla", "curie", "newton", "lovelace")}},
        "geometry": {"default": "geometry.claudenpc.maestro"},
        "animations": maestro_anims,
        "scripts": {"animate": ["mirar", "caminar", "respirar", "parpadeo", "libro"]},
        "render_controllers": ["controller.render.claudenpc_maestro"],
        "enable_attachables": True,
        "spawn_egg": {"base_color": "#74543A", "overlay_color": "#D97757"}}}})
    golden_anims = dict(base_anims)
    for name in ("flotar", "halo", "aura", "poder", "chasquido", "dirigir", "pensar", "ojo", "golpe", "aturdido", "risa", "picada"):
        golden_anims[name] = f"animation.claudenpc.golden.{name}"
    golden_anims["ctrl_ojo"] = "controller.animation.claudenpc.golden.ojo"
    for ident, archivo in (("claudenpc:claude_golden", "claude_golden"), ("claudenpc:espejismo", "espejismo")):
        write_json(RP / f"entity/{archivo}.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
            "identifier": ident,
            "materials": {"default": "entity_emissive_alpha", "aura": "entity_alphablend"},
            "textures": {"default": "textures/entity/claudenpc/golden"},
            "geometry": {"default": "geometry.claudenpc.golden"},
            "animations": golden_anims,
            "particle_effects": {"ojo": "claudenpc:ojo_golden", "halo_ojo": "claudenpc:ojo_halo"},
            "scripts": {"animate": ["mirar", "respirar", "parpadeo", "flotar", "halo", "aura", "ojo", "ctrl_ojo"]},
            "render_controllers": ["controller.render.claudenpc_golden"],
            "enable_attachables": True}}})
    write_json(RP / "entity/eco.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": "claudenpc:eco",
        "materials": {"default": "entity_alphablend", "glow": "entity_alphablend"},
        "textures": {"default": "textures/entity/claudenpc/eco"},
        "geometry": {"default": "geometry.claudenpc.claude"},
        "animations": dict(base_anims, celebrar="animation.claudenpc.celebrar", golpe="animation.claudenpc.golpe"),
        "scripts": {"animate": ["mirar", "caminar", "respirar"]},
        "render_controllers": ["controller.render.claudenpc"]}}})
    write_json(RP / "entity/aura.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": "claudenpc:aura",
        "materials": {"default": "entity_alphablend", "brillo": "entity_emissive_alpha"},
        "textures": {"default": "textures/entity/claudenpc/aura"},
        "geometry": {"default": "geometry.claudenpc.aura"},
        "animations": {"idle": "animation.claudenpc.aura.idle"},
        "scripts": {"animate": ["idle"]},
        "render_controllers": ["controller.render.claudenpc_aura"]}}})
    robot_anims = {n: f"animation.claudenpc.robot.{n}" for n in
                   ("caminar", "reposo", "misiles", "laser", "metralla", "pisoton", "golpe", "alarma", "ensamblaje")}
    robot_anims["ctrl_vapor"] = "controller.animation.claudenpc.robot.vapor"
    write_json(RP / "entity/robot.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": "claudenpc:robot",
        "materials": {"default": "entity_emissive_alpha", "cristal": "entity_alphablend"},
        "textures": {"default": "textures/entity/claudenpc/robot"},
        "geometry": {"default": "geometry.claudenpc.robot"},
        "animations": robot_anims,
        "particle_effects": {"vapor": "claudenpc:vapor"},
        "scripts": {"animate": ["caminar", "reposo", {"alarma": "query.property('claudenpc:alarma')"}, "ctrl_vapor"]},
        "render_controllers": ["controller.render.claudenpc_robot"]}}})
    write_json(RP / "entity/misil.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": "claudenpc:misil",
        "materials": {"default": "entity_emissive_alpha"},
        "textures": {"default": "textures/entity/claudenpc/misil"},
        "geometry": {"default": "geometry.claudenpc.misil"},
        "animations": {"orientar": "animation.claudenpc.misil.orientar", "ctrl_humo": "controller.animation.claudenpc.misil.humo"},
        "particle_effects": {"humo": "claudenpc:humo_misil", "llama": "claudenpc:llama_misil"},
        "scripts": {"animate": ["orientar", "ctrl_humo"]},
        "render_controllers": ["controller.render.default"]}}})
    write_json(RP / "animation_controllers/robot.animation_controllers.json", {"format_version": "1.10.0", "animation_controllers": {
        "controller.animation.claudenpc.robot.vapor": {"initial_state": "humea", "states": {"humea": {
            "particle_effects": [{"effect": "vapor", "locator": "escape_der"}, {"effect": "vapor", "locator": "escape_izq"}]}}},
        "controller.animation.claudenpc.misil.humo": {"initial_state": "vuela", "states": {"vuela": {
            "particle_effects": [{"effect": "humo", "locator": "cola"}, {"effect": "llama", "locator": "cola"}]}}}}})
    write_json(RP / "animation_controllers/golden.animation_controllers.json", {"format_version": "1.10.0", "animation_controllers": {
        "controller.animation.claudenpc.golden.ojo": {"initial_state": "brillar", "states": {"brillar": {
            "particle_effects": [{"effect": "ojo", "locator": "ojo_derecho"}, {"effect": "halo_ojo", "locator": "ojo_derecho"}]}}}}})


def main():
    write_json(RP / "models/entity/claude.geo.json", geo("geometry.claudenpc.claude", humanoide()))
    write_json(RP / "models/entity/golden.geo.json", golden_geometry())
    write_json(RP / "models/entity/maestro.geo.json", maestro_geometry())
    write_json(RP / "models/entity/robot.geo.json", robot_geometry())
    write_json(RP / "models/entity/misil.geo.json", misil_geometry())
    write_json(RP / "models/entity/aura.geo.json", sphere_geometry(
        "geometry.claudenpc.aura", 80, 40, [-67.5, -52.5, -37.5, -22.5, -7.5, 7.5, 22.5, 37.5, 52.5, 67.5, 82.5], 20))
    tex = RP / "textures/entity/claudenpc"
    tex.mkdir(parents=True, exist_ok=True)
    claude_skin().save(tex / "claude.png")
    golden_skin().save(tex / "golden.png")
    maestro_skin().save(tex / "maestro.png")
    for nombre in ("einstein", "tesla", "curie", "newton", "lovelace"):
        maestro_skin(ESTILOS[nombre]).save(tex / f"maestro_{nombre}.png")
    robot_texture().save(tex / "robot.png")
    misil_texture().save(tex / "misil.png")
    eco_skin().save(tex / "eco.png")
    sphere_texture().save(tex / "aura.png")
    (RP / "textures/particle").mkdir(parents=True, exist_ok=True)
    particle_atlas().save(RP / "textures/particle/claudenpc.png")
    write_particles()
    write_json(RP / "animations/claude.animation.json", claude_animations())
    write_json(RP / "animations/golden.animation.json", golden_animations())
    write_json(RP / "animations/maestro.animation.json", maestro_animations())
    write_json(RP / "animations/robot.animation.json", robot_animations())
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
