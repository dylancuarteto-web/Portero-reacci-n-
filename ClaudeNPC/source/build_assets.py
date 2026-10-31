"""Genera el arte del NPC Claude: modelo humanoide, skin, animaciones y partículas.

Uso (desde ClaudeNPC):  python source/build_assets.py   (requiere Pillow)
Personaje original: cuerpo naranja, solo ojos y un emblema de estrella de diseño propio.
"""
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RP = ROOT / "RP"

NARANJA = (217, 119, 87)
NARANJA_CLARO = (232, 146, 112)
NARANJA_OSCURO = (176, 88, 60)
CREMA = (245, 236, 220)
OJO = (43, 29, 22)


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


# --- Modelo: humanoide estándar con UV de skin clásica 64x64 --------------------

def geometry():
    bone = lambda name, pivot, parent=None, cubes=None: {
        k: v for k, v in (("name", name), ("parent", parent), ("pivot", pivot), ("cubes", cubes)) if v is not None}
    box = lambda origin, size, uv: {"origin": origin, "size": size, "uv": uv}
    bones = [
        bone("root", [0, 0, 0]),
        bone("waist", [0, 12, 0], "root"),
        bone("body", [0, 24, 0], "waist", [box([-4, 12, -2], [8, 12, 4], [16, 16])]),
        bone("head", [0, 24, 0], "body", [box([-4, 24, -4], [8, 8, 8], [0, 0])]),
        bone("rightArm", [-5, 22, 0], "body", [box([-8, 12, -2], [4, 12, 4], [40, 16])]),
        bone("rightItem", [-6, 15, 1], "rightArm"),
        bone("leftArm", [5, 22, 0], "body", [box([4, 12, -2], [4, 12, 4], [32, 48])]),
        bone("leftItem", [6, 15, 1], "leftArm"),
        bone("rightLeg", [-1.9, 12, 0], "root", [box([-3.9, 0, -2], [4, 12, 4], [0, 16])]),
        bone("leftLeg", [1.9, 12, 0], "root", [box([-0.1, 0, -2], [4, 12, 4], [16, 48])]),
    ]
    return {"format_version": "1.16.0", "minecraft:geometry": [{
        "description": {"identifier": "geometry.claudenpc.claude", "texture_width": 64, "texture_height": 64,
                        "visible_bounds_width": 2, "visible_bounds_height": 3, "visible_bounds_offset": [0, 1.5, 0]},
        "bones": bones}]}


def box_regions(u, v, w, h, d):
    """Regiones de una caja con UV automática: (x, y, ancho, alto) por cara."""
    return {
        "up": (u + d, v, w, d), "down": (u + d + w, v, w, d),
        "east": (u, v + d, d, h), "north": (u + d, v + d, w, h),
        "west": (u + d + w, v + d, d, h), "south": (u + 2 * d + w, v + d, w, h),
    }


def skin():
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    px = img.load()

    def paint(regions, front_light=1.0):
        for face, (x0, y0, w, h) in regions.items():
            for y in range(h):
                for x in range(w):
                    t = y / max(h - 1, 1)
                    base = [NARANJA_CLARO[i] + (NARANJA[i] - NARANJA_CLARO[i]) * t for i in range(3)]
                    if face in ("east", "west", "south"):
                        base = [c * 0.9 for c in base]
                    if face == "down":
                        base = list(NARANJA_OSCURO)
                    n = ((x * 7 + y * 13) % 5) - 2  # textura sutil y estable
                    px[x0 + x, y0 + y] = tuple(max(0, min(255, int(c + n))) for c in base) + (255,)

    for spec in ((0, 0, 8, 8, 8), (16, 16, 8, 12, 4), (40, 16, 4, 12, 4), (32, 48, 4, 12, 4),
                 (0, 16, 4, 12, 4), (16, 48, 4, 12, 4)):
        paint(box_regions(*spec))

    # Cara: solo dos ojos verticales redondeados, sin boca.
    fx, fy = 8, 8
    for ex in (1, 5):
        for dy in range(3):
            for dx in range(2):
                px[fx + ex + dx, fy + 3 + dy] = OJO + (255,)
        px[fx + ex, fy + 3] = (92, 64, 50, 255)  # brillo en la esquina
    # Emblema de estrella original en el pecho (cuatro puntas, en crema).
    cx, cy = 20 + 4, 20 + 5
    star = [(0, -4), (0, -3), (0, -2), (0, 2), (0, 3), (0, 4), (-4, 0), (-3, 0), (-2, 0), (2, 0), (3, 0), (4, 0),
            (-1, -1), (1, -1), (-1, 1), (1, 1), (0, -1), (0, 1), (-1, 0), (1, 0), (0, 0)]
    for dx, dy in star:
        x, y = cx + dx, cy + dy
        if 20 <= x < 28 and 20 <= y < 32:
            px[x, y] = CREMA + (255,)
    # Manos y pies un poco más oscuros.
    for (x0, y0, w, h, d) in ((40, 16, 4, 12, 4), (32, 48, 4, 12, 4)):
        for face, (rx, ry, rw, rh) in box_regions(x0, y0, w, h, d).items():
            if face in ("up", "down"):
                continue
            for y in range(rh - 2, rh):
                for x in range(rw):
                    r, g, b, a = px[rx + x, ry + y]
                    px[rx + x, ry + y] = (int(r * 0.85), int(g * 0.85), int(b * 0.85), a)
    return img


# --- Animaciones ----------------------------------------------------------------

def k(*pairs):
    return {f"{t:.2f}": v for t, v in pairs}


Z = [0, 0, 0]


def animations():
    swing = "math.cos(query.modified_distance_moved * 38.17) * 57.3 * math.min(query.modified_move_speed, 1)"
    return {"format_version": "1.8.0", "animations": {
        "animation.claudenpc.mirar": {"loop": True, "bones": {
            "head": {"rotation": ["query.target_x_rotation", "query.target_y_rotation", 0]}}},
        "animation.claudenpc.caminar": {"loop": True, "bones": {
            "rightArm": {"rotation": [f"-({swing}) * 0.6 - 10", 0, 0]},
            "leftArm": {"rotation": [f"({swing}) * 0.6", 0, 0]},
            "rightLeg": {"rotation": [f"({swing}) * 0.8", 0, 0]},
            "leftLeg": {"rotation": [f"-({swing}) * 0.8", 0, 0]}}},
        "animation.claudenpc.respirar": {"loop": True, "bones": {
            "body": {"scale": [1, "1 + math.sin(query.life_time * 120) * 0.01", 1]}}},
        "animation.claudenpc.golpe": {"animation_length": 0.35, "bones": {
            "rightArm": {"rotation": k((0, Z), (0.1, [-120, 20, 0]), (0.22, [20, -10, 0]), (0.35, Z))},
            "body": {"rotation": k((0, Z), (0.12, [0, -15, 0]), (0.35, Z))}}},
        "animation.claudenpc.martillazo": {"animation_length": 0.9, "bones": {
            "rightArm": {"rotation": k((0, Z), (0.3, [-170, 0, 0]), (0.7, [-170, 0, 0]), (0.8, [-20, 0, 0]), (0.9, Z))},
            "leftArm": {"rotation": k((0, Z), (0.3, [-160, 0, 0]), (0.7, [-160, 0, 0]), (0.8, [-20, 0, 0]), (0.9, Z))}}},
        "animation.claudenpc.escudo": {"animation_length": 0.6, "bones": {
            "leftArm": {"rotation": k((0, Z), (0.1, [-80, -30, 0]), (0.45, [-80, -30, 0]), (0.6, Z))},
            "body": {"rotation": k((0, Z), (0.15, [10, 0, 0]), (0.6, Z))}}},
        "animation.claudenpc.lanzar": {"animation_length": 0.5, "bones": {
            "rightArm": {"rotation": k((0, Z), (0.15, [-170, 0, 0]), (0.3, [-60, 0, 0]), (0.5, Z))}}},
        "animation.claudenpc.colocar": {"animation_length": 0.3, "bones": {
            "rightArm": {"rotation": k((0, Z), (0.12, [-60, 0, 0]), (0.3, Z))}}},
        "animation.claudenpc.crafteo": {"animation_length": 3.0, "bones": {
            "rightArm": {"rotation": k(*[(t * 0.3, [-50 if i % 2 == 0 else -85, 10 * (i % 2), 0]) for i, t in enumerate(range(11))])},
            "leftArm": {"rotation": k(*[(t * 0.3, [-40 if i % 2 == 0 else -28, -10 * (i % 2), 0]) for i, t in enumerate(range(11))])},
            "head": {"rotation": k((0, Z), (0.2, [25, 0, 0]), (2.8, [25, 0, 0]), (3.0, Z))}}},
        "animation.claudenpc.arco": {"animation_length": 1.4, "bones": {
            "rightArm": {"rotation": k((0, Z), (0.2, [-90, -10, 0]), (1.15, [-90, -10, 0]), (1.25, [-80, -5, 0]), (1.4, Z))},
            "leftArm": {"rotation": k((0, Z), (0.2, [-90, 35, 0]), (1.15, [-90, 35, 0]), (1.4, Z))},
            "body": {"rotation": k((0, Z), (0.2, [0, 15, 0]), (1.15, [0, 15, 0]), (1.4, Z))}}},
        "animation.claudenpc.planeo": {"animation_length": 1.0, "bones": {
            "body": {"rotation": [60, 0, 0], "position": [0, -4, -6]},
            "rightArm": {"rotation": [20, 0, 30]},
            "leftArm": {"rotation": [20, 0, -30]},
            "rightLeg": {"rotation": [10, 0, 5]},
            "leftLeg": {"rotation": [10, 0, -5]},
            "head": {"rotation": [-45, 0, 0]}}},
        "animation.claudenpc.cubeta": {"animation_length": 1.5, "bones": {
            "head": {"rotation": k((0, Z), (0.15, [60, 0, 0]), (1.3, [60, 0, 0]), (1.5, Z))},
            "rightArm": {"rotation": k((0, Z), (0.15, [-30, 0, 0]), (1.3, [-30, 0, 0]), (1.5, Z))}}},
        "animation.claudenpc.minar": {"animation_length": 0.8, "bones": {
            "rightArm": {"rotation": k((0, [-60, 0, 0]), (0.2, [-110, 0, 0]), (0.4, [-60, 0, 0]),
                                       (0.6, [-110, 0, 0]), (0.8, Z))}}},
    }}


# --- Partículas (sprite genérico del atlas vanilla) ------------------------------

def particles():
    uv = {"texture_width": 128, "texture_height": 128,
          "flipbook": {"base_UV": [56, 0], "size_UV": [8, 8], "step_UV": [-8, 0], "frames_per_second": 8,
                       "max_frame": 8, "stretch_to_lifetime": True, "loop": False}}

    def p(name, comps, color, size=0.15, material="particles_add"):
        write_json(RP / f"particles/{name}.particle.json", {"format_version": "1.10.0", "particle_effect": {
            "description": {"identifier": f"claudenpc:{name}",
                            "basic_render_parameters": {"material": material, "texture": "textures/particle/particles"}},
            "components": {"minecraft:emitter_lifetime_once": {"active_time": 0.1},
                           "minecraft:particle_appearance_billboard": {"size": [size, size],
                                                                       "facing_camera_mode": "lookat_xyz", "uv": uv},
                           "minecraft:particle_appearance_tinting": {"color": {"gradient": color,
                               "interpolant": "variable.particle_age / variable.particle_lifetime"}},
                           **comps}}})

    p("cambio", {"minecraft:emitter_rate_instant": {"num_particles": 10},
                 "minecraft:emitter_shape_sphere": {"radius": 0.3, "direction": "outwards"},
                 "minecraft:particle_lifetime_expression": {"max_lifetime": 0.4},
                 "minecraft:particle_initial_speed": 1.5,
                 "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 4}},
      {"0.0": "#FFF5ECDC", "1.0": "#00D97757"}, 0.12)
    p("onda", {"minecraft:emitter_rate_instant": {"num_particles": 40},
               "minecraft:emitter_shape_disc": {"radius": 0.4, "plane_normal": "y", "surface_only": True,
                                                "direction": "outwards"},
               "minecraft:particle_lifetime_expression": {"max_lifetime": 0.6},
               "minecraft:particle_initial_speed": 9,
               "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 4}},
      {"0.0": "#FFFFD9B0", "1.0": "#00D97757"}, 0.3)
    p("teletransporte", {"minecraft:emitter_rate_instant": {"num_particles": 30},
                         "minecraft:emitter_shape_box": {"half_dimensions": [0.4, 1.0, 0.4], "direction": "outwards"},
                         "minecraft:particle_lifetime_expression": {"max_lifetime": 0.8},
                         "minecraft:particle_initial_speed": 0.6,
                         "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 1, 0]}},
      {"0.0": "#FFC77DFF", "1.0": "#004B1C8C"}, 0.14)
    p("crafteo", {"minecraft:emitter_rate_instant": {"num_particles": 8},
                  "minecraft:emitter_shape_box": {"half_dimensions": [0.4, 0.1, 0.4]},
                  "minecraft:particle_lifetime_expression": {"max_lifetime": 0.7},
                  "minecraft:particle_initial_speed": 0,
                  "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 1.4, 0]}},
      {"0.0": "#FFFFE9A0", "1.0": "#00D97757"}, 0.1)
    p("cohete", {"minecraft:emitter_rate_instant": {"num_particles": 16},
                 "minecraft:emitter_shape_point": {},
                 "minecraft:particle_lifetime_expression": {"max_lifetime": 0.6},
                 "minecraft:particle_initial_speed": 1.2,
                 "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -2, 0], "linear_drag_coefficient": 2}},
      {"0.0": "#FFFFF0C8", "0.5": "#FFFF8C3C", "1.0": "#00808080"}, 0.12)
    p("idea", {"minecraft:emitter_rate_instant": {"num_particles": 6},
               "minecraft:emitter_shape_sphere": {"radius": 0.25, "direction": "outwards"},
               "minecraft:particle_lifetime_expression": {"max_lifetime": 0.8},
               "minecraft:particle_initial_speed": 0.6,
               "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.8, 0]}},
      {"0.0": "#FFB4F0FF", "1.0": "#00FFD25A"}, 0.14)
    p("construir", {"minecraft:emitter_rate_instant": {"num_particles": 12},
                    "minecraft:emitter_shape_box": {"half_dimensions": [0.5, 0.5, 0.5], "surface_only": True},
                    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.5},
                    "minecraft:particle_initial_speed": 0, "minecraft:particle_motion_dynamic": {}},
      {"0.0": "#FFF5ECDC", "1.0": "#00F5ECDC"}, 0.08)


def client_entity():
    anims = {
        "mirar": "animation.claudenpc.mirar", "caminar": "animation.claudenpc.caminar",
        "respirar": "animation.claudenpc.respirar", "golpe": "animation.claudenpc.golpe",
        "martillazo": "animation.claudenpc.martillazo", "escudo": "animation.claudenpc.escudo",
        "lanzar": "animation.claudenpc.lanzar", "colocar": "animation.claudenpc.colocar",
        "arco": "animation.claudenpc.arco", "planeo": "animation.claudenpc.planeo",
        "cubeta": "animation.claudenpc.cubeta",
        "crafteo": "animation.claudenpc.crafteo", "minar": "animation.claudenpc.minar",
    }
    return {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": "claudenpc:claude",
        "materials": {"default": "entity_alphatest"},
        "textures": {"default": "textures/entity/claudenpc/claude"},
        "geometry": {"default": "geometry.claudenpc.claude"},
        "animations": anims,
        "scripts": {"animate": ["mirar", "caminar", "respirar"]},
        "render_controllers": ["controller.render.default"],
        "enable_attachables": True,
        "spawn_egg": {"base_color": "#D97757", "overlay_color": "#F5ECDC"},
    }}}


def main():
    write_json(RP / "models/entity/claude.geo.json", geometry())
    s = skin()
    (RP / "textures/entity/claudenpc").mkdir(parents=True, exist_ok=True)
    s.save(RP / "textures/entity/claudenpc/claude.png")
    write_json(RP / "animations/claude.animation.json", animations())
    write_json(RP / "entity/claude.entity.json", client_entity())
    particles()
    icon = Image.new("RGBA", (128, 128), NARANJA + (255,))
    d = ImageDraw.Draw(icon)
    for x in (34, 74):
        d.rounded_rectangle([x, 40, x + 20, 72], radius=8, fill=OJO + (255,))
    for a in range(4):
        ang = math.radians(a * 90)
        d.line([(64, 98), (64 + 14 * math.cos(ang), 98 + 14 * math.sin(ang))], fill=CREMA + (255,), width=5)
    icon.save(RP / "pack_icon.png")
    icon.save(ROOT / "BP/pack_icon.png")
    print("Recursos generados en", ROOT)


if __name__ == "__main__":
    main()
