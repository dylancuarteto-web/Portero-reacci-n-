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


# --- Parche (casco) ---------------------------------------------------------

PATCH_REG = {"strap": (0, 0, 2, 2), "side": (2, 0, 2, 2), "led": (4, 0, 1, 1), "front": (0, 4, 8, 6)}


def patch_geometry():
    r = PATCH_REG
    y, h, t = 28.6, 0.5, 0.3
    strap = [
        cube(r, [-0.5, y, -4.35], [4.85, h, t], "strap"),
        cube(r, [-4.35, y, -4.35], [0.85, h, t], "strap"),
        cube(r, [4.05, y, -4.35], [t, h, 8.7], "strap"),
        cube(r, [-4.35, y, -4.35], [t, h, 8.7], "strap"),
        cube(r, [-4.35, y, 4.05], [8.7, h, t], "strap"),
    ]
    bones = [
        {"name": "worn_root", "parent": "head", "pivot": [0, 24, 0]},
        {"name": "worn_strap", "parent": "worn_root", "pivot": [0, 28.85, 0], "cubes": strap},
        # Ojo derecho del personaje (x negativa en el espacio del modelo).
        {"name": "worn_lens", "parent": "worn_root", "pivot": [-2, 27.7, -4.5],
         "cubes": [cube(r, [-3.6, 26.3, -4.75], [3.2, 2.8, 0.45], "front", "side")]},
        {"name": "worn_led", "parent": "worn_lens", "pivot": [-2.2, 28.6, -4.8],
         "cubes": [cube(r, [-2.4, 28.4, -4.85], [0.4, 0.4, 0.15], "led")]},
        {"name": "held_root", "parent": "rightItem", "pivot": [-6, 15, 1]},
        {"name": "held_lens", "parent": "held_root", "pivot": [-6, 15, 1], "cubes": [
            cube(r, [-7.6, 14, -0.4], [3.2, 2.8, 0.45], "front", "side"),
            cube(r, [-8.6, 15.2, -0.35], [5.2, 0.5, 0.3], "strap"),
        ]},
    ]
    return geo("geometry.evilmorty.parche", 16, 16, bones)


def patch_texture():
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    px = img.load()
    fill(px, PATCH_REG["strap"], (22, 22, 24, 255))
    px[1, 0] = (48, 48, 52, 255)
    fill(px, PATCH_REG["side"], (12, 12, 14, 255))
    fill(px, PATCH_REG["led"], (255, 150, 20, 255))
    u, v, w, h = PATCH_REG["front"]
    for x in range(w):
        for y in range(h):
            edge = x in (0, w - 1) or y in (0, h - 1)
            px[u + x, v + y] = (40, 40, 44, 255) if edge else (16, 16, 18, 255)
    for x in (2, 4):
        px[u + x, v + h - 1] = (70, 70, 76, 255)
    px[u + 2, v + 1] = px[u + 3, v + 1] = (58, 58, 64, 255)
    return img


# --- Mano de Rayo Láser (guante en el brazo derecho) ------------------------

GLOVE_REG = {"metal": (0, 0, 4, 4), "dark": (4, 0, 4, 4), "accent": (8, 0, 4, 4), "lens": (12, 0, 2, 2)}


def glove_geometry():
    r = GLOVE_REG
    bones = [
        {"name": "guante", "parent": "rightArm", "pivot": [-5, 22, 0], "cubes": [
            cube(r, [-8.4, 15.5, -2.4], [4.8, 1.5, 4.8], "dark"),
            cube(r, [-8.3, 11.6, -2.3], [4.6, 4.0, 4.6], "metal"),
            cube(r, [-8.6, 12.4, -1.5], [0.3, 3.0, 3.0], "accent"),
            cube(r, [-6.5, 12.4, -2.6], [2.0, 3.0, 0.3], "accent"),
            cube(r, [-7.0, 10.6, -1.0], [2.0, 1.0, 2.0], "dark"),
        ]},
        {"name": "lente", "parent": "guante", "pivot": [-6, 10.45, 0], "cubes": [
            cube(r, [-6.75, 10.3, -0.75], [1.5, 0.3, 1.5], "lens"),
        ]},
    ]
    return geo("geometry.evilmorty.mano_laser", 16, 16, bones)


def glove_texture():
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    px = img.load()
    fill(px, GLOVE_REG["metal"], (120, 128, 140, 255))
    fill(px, GLOVE_REG["dark"], (44, 48, 56, 255))
    fill(px, GLOVE_REG["accent"], AMBER + (255,))
    fill(px, GLOVE_REG["lens"], (255, 60, 30, 255))
    px[1, 1] = px[2, 2] = (160, 168, 180, 255)
    px[9, 1] = AMBER_HOT + (255,)
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


# --- Iconos de inventario ---------------------------------------------------

PALETTE = {
    "s": (40, 40, 44, 255), "k": (16, 16, 18, 255), "h": (70, 70, 78, 255),
    "o": AMBER + (255,), "y": AMBER_HOT + (255,), "r": (255, 60, 30, 255),
    "g": (120, 128, 140, 255), "d": (44, 48, 56, 255), "l": (170, 178, 190, 255),
}


def pixel_icon(rows):
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != ".":
                img.putpixel((x, y), PALETTE[ch])
    return img


ICON_PARCHE = [
    "................", "................", "ss..............", "..ss............",
    "....ss..........", ".....kkkkkk.....", "....kkhhkkkk....", "...kkhkkkkkkk...",
    "...kkkkkkkkoks..", "...kkkkkkkkkk.ss", "....kkkkkkkk....", ".....kkkkkk.....",
    "................", "................", "................", "................",
]
ICON_MANO = [
    "................", "......gg.gg.....", ".....gggggggg...", ".....gllgllgg...",
    ".....gggggggg...", "....ogggggggo...", "....ogggggggo...", ".....gggggggg...",
    ".....dddddddd...", ".....dddddddd...", "......dddddd....", ".......dddd.....",
    ".......drrd.....", "........rr......", "........rr......", "................",
]
ICON_CONTROL = [
    "..........y.....", ".........y......", "........y.......", ".....oooooo.....",
    ".....odddddo....", ".....odyydo.....", ".....odddddo....", ".....oooooo.....",
    ".....oorrooo....", ".....orrrroo....", ".....oorrooo....", ".....oooooo.....",
    ".....oddddoo....", ".....oddddoo....", ".....oooooo.....", "................",
]


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


def main():
    write_json(RP / "models/entity/parche.geo.json", patch_geometry())
    write_json(RP / "models/entity/mano_laser.geo.json", glove_geometry())
    write_json(RP / "models/entity/escudo_domo.geo.json", dome_geometry())
    write_json(RP / "models/entity/rayo_laser.geo.json", beam_geometry())
    save(patch_texture(), RP / "textures/models/evilmorty/parche.png")
    save(glove_texture(), RP / "textures/models/evilmorty/mano_laser.png")
    save(dome_texture(), RP / "textures/entity/evilmorty/escudo_domo.png")
    save(beam_texture(), RP / "textures/entity/evilmorty/rayo_laser.png")
    save(pixel_icon(ICON_PARCHE), RP / "textures/items/evilmorty/parche.png")
    save(pixel_icon(ICON_MANO), RP / "textures/items/evilmorty/mano_laser.png")
    save(pixel_icon(ICON_CONTROL), RP / "textures/items/evilmorty/control.png")
    for kind in ("escudo", "modo", "vision", "archivos", "ojo", "cerrar", "carpeta", "volver"):
        save(menu_icon(kind), RP / f"textures/ui/evilmorty/{kind}.png")
    save(hud_overlay(), RP / "textures/ui/evilmorty/ojo_hud.png")
    save(pack_icon(), RP / "pack_icon.png")
    save(pack_icon(), BP / "pack_icon.png")
    print("Recursos generados en", ROOT)


if __name__ == "__main__":
    main()
