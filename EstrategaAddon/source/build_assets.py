"""Genera la geometría y las texturas originales del Parche del Estratega.

Uso: python source/build_assets.py   (desde la carpeta EstrategaAddon)
Requiere Pillow. Sobrescribe solo los archivos listados en OUTPUTS.
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RP = ROOT / "RP"
BP = ROOT / "BP"

# Regiones de la textura del modelo (16x16): nombre -> (u, v, ancho, alto).
REGIONS = {
    "strap": (0, 0, 2, 2),
    "side": (2, 0, 2, 2),
    "led": (4, 0, 1, 1),
    "front": (0, 4, 8, 6),
}


def faces(front="side", rest="side"):
    out = {}
    for face in ("north", "south", "east", "west", "up", "down"):
        u, v, w, h = REGIONS[front if face == "north" else rest]
        out[face] = {"uv": [u, v], "uv_size": [w, h]}
    return out


def cube(origin, size, front="side", rest="side"):
    return {"origin": origin, "size": size, "uv": faces(front, rest)}


def geometry():
    strap_y, strap_h, t = 28.6, 0.5, 0.3
    worn_strap = [
        cube([-0.5, strap_y, -4.35], [4.85, strap_h, t], "strap", "strap"),
        cube([-4.35, strap_y, -4.35], [0.85, strap_h, t], "strap", "strap"),
        cube([4.05, strap_y, -4.35], [t, strap_h, 8.7], "strap", "strap"),
        cube([-4.35, strap_y, -4.35], [t, strap_h, 8.7], "strap", "strap"),
        cube([-4.35, strap_y, 4.05], [8.7, strap_h, t], "strap", "strap"),
    ]
    bones = [
        {"name": "worn_root", "parent": "head", "pivot": [0, 24, 0]},
        {"name": "worn_strap", "parent": "worn_root", "pivot": [0, 28.85, 0], "cubes": worn_strap},
        {
            "name": "worn_lens",
            "parent": "worn_root",
            "pivot": [-2, 27.7, -4.5],
            # Ojo derecho del personaje (x negativa en el espacio del modelo).
            "cubes": [cube([-3.6, 26.3, -4.75], [3.2, 2.8, 0.45], "front", "side")],
        },
        {
            "name": "worn_led",
            "parent": "worn_lens",
            "pivot": [-2.2, 28.6, -4.8],
            "cubes": [cube([-2.4, 28.4, -4.85], [0.4, 0.4, 0.15], "led", "led")],
        },
        {"name": "held_root", "parent": "rightItem", "pivot": [-6, 15, 1]},
        {
            "name": "held_lens",
            "parent": "held_root",
            "pivot": [-6, 15, 1],
            "cubes": [
                cube([-7.6, 14, -0.4], [3.2, 2.8, 0.45], "front", "side"),
                cube([-8.6, 15.2, -0.35], [5.2, 0.5, 0.3], "strap", "strap"),
            ],
        },
    ]
    return {
        "format_version": "1.16.0",
        "minecraft:geometry": [
            {
                "description": {
                    "identifier": "geometry.estr.parche",
                    "texture_width": 16,
                    "texture_height": 16,
                    "visible_bounds_width": 2,
                    "visible_bounds_height": 3,
                    "visible_bounds_offset": [0, 1.5, 0],
                },
                "bones": bones,
            }
        ],
    }


def model_texture():
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    px = img.load()
    fill = lambda region, color: [px.__setitem__((x, y), color)
                                  for x in range(region[0], region[0] + region[2])
                                  for y in range(region[1], region[1] + region[3])]
    fill(REGIONS["strap"], (22, 22, 24, 255))
    px[1, 0] = (48, 48, 52, 255)
    fill(REGIONS["side"], (12, 12, 14, 255))
    fill(REGIONS["led"], (230, 40, 40, 255))
    u, v, w, h = REGIONS["front"]
    for x in range(w):
        for y in range(h):
            edge = x in (0, w - 1) or y in (0, h - 1)
            px[u + x, v + y] = (40, 40, 44, 255) if edge else (16, 16, 18, 255)
    # Costura y brillo, diseño propio.
    for x in (2, 4):
        px[u + x, v + h - 1] = (70, 70, 76, 255)
    px[u + 2, v + 1] = (58, 58, 64, 255)
    px[u + 3, v + 1] = (58, 58, 64, 255)
    return img


def icon(pixels, palette):
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y, row in enumerate(pixels):
        for x, ch in enumerate(row):
            if ch != ".":
                img.putpixel((x, y), palette[ch])
    return img


PATCH_ICON = [
    "................",
    "................",
    "ss..............",
    "..ss............",
    "....ss..........",
    ".....kkkkkk.....",
    "....kkhhkkkk....",
    "...kkhkkkkkkk...",
    "...kkkkkkkkrks..",
    "...kkkkkkkkkk.ss",
    "....kkkkkkkk....",
    ".....kkkkkk.....",
    "................",
    "................",
    "................",
    "................",
]

TRANSMITTER_ICON = [
    "..........a.....",
    ".........a......",
    "........a.......",
    ".....gggggg.....",
    ".....gddddg.....",
    ".....gdyydg.....",
    ".....gddddg.....",
    ".....gggggg.....",
    ".....glrrlg.....",
    ".....grrrrg.....",
    ".....glrrlg.....",
    ".....gggggg.....",
    ".....gllllg.....",
    ".....gllllg.....",
    ".....gggggg.....",
    "................",
]

PACK_ICON = [
    "kkkkkkkkkkkkkkkk",
    "kppppppppppppppk",
    "kpssppppppppppsk",
    "kppsspppppppsspk",
    "kppppkkkkkkspppk",
    "kpppkkhhkkkkpppk",
    "kppkkhkkkkkkkppk",
    "kppkkkkkkkkrkppk",
    "kppkkkkkkkkkkppk",
    "kpppkkkkkkkkpppk",
    "kppppkkkkkkppppk",
    "kppppppppppppppk",
    "kpyyyyyyyyyyyypk",
    "kpyyyyyyyyyyyypk",
    "kppppppppppppppk",
    "kkkkkkkkkkkkkkkk",
]

PALETTE = {
    "s": (40, 40, 44, 255),
    "k": (16, 16, 18, 255),
    "h": (70, 70, 78, 255),
    "r": (230, 40, 40, 255),
    "g": (110, 116, 124, 255),
    "d": (30, 34, 40, 255),
    "y": (240, 200, 40, 255),
    "l": (150, 156, 164, 255),
    "a": (190, 196, 204, 255),
    "p": (80, 200, 90, 255),
}


def main():
    (RP / "models/entity").mkdir(parents=True, exist_ok=True)
    (RP / "textures/models").mkdir(parents=True, exist_ok=True)
    (RP / "textures/items").mkdir(parents=True, exist_ok=True)
    (RP / "models/entity/estr_parche.geo.json").write_text(json.dumps(geometry(), indent=2) + "\n", encoding="utf-8")
    model_texture().save(RP / "textures/models/estr_parche.png")
    icon(PATCH_ICON, PALETTE).save(RP / "textures/items/estr_parche.png")
    icon(TRANSMITTER_ICON, PALETTE).save(RP / "textures/items/estr_transmisor.png")
    pack = icon(PACK_ICON, PALETTE).resize((128, 128), Image.NEAREST)
    pack.save(RP / "pack_icon.png")
    pack.save(BP / "pack_icon.png")
    print("Recursos generados en", ROOT)


if __name__ == "__main__":
    main()
