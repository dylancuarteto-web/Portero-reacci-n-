"""Claude NPC v10.0: Claude Exponencial Infinito (INFINITE DETERMINATION).

Recursos de la entidad: comportamiento (sensores de daño, vida por tramo de fases, aura),
cliente (el modelo de los Claudes más una capa extra), cinco texturas (una por tramo de fases:
1-5, 6-10, 11-15, 16-19 y 20), la capa extra (cinta, bufanda y hombreras), animaciones de su
estilo de combate, partículas (aura de la fase 20, alma, evolución, golpe, cura y sello) y los
nombres.

Todo el arte es original: las pieles salen de recolorear la piel de Claude que dibuja
build_assets.py y lo demás se dibuja aquí. Se ejecuta desde golden_final_assets.generar().
"""
import colorsys
import json
import math
import random

from PIL import Image

import build_assets as ba
import v90_assets as v9

RP = ba.RP
BP = ba.ROOT / "BP"
write_json = ba.write_json
TEX = RP / "textures/entity/claudenpc"
ID = "claudenpc:exponencial_infinito"
NOMBRE = "Claude Exponencial Infinito"
VIDA_TRAMO = (40, 52, 64, 72, 80)  # fases 1-5, 6-10, 11-15, 16-19, 20


# =============================================================================
# Pieles (una por tramo)
# =============================================================================

CORAZON8 = [".XX..XX.", "XXXXXXXX", "XXXXXXXX", "XXXXXXXX", ".XXXXXX.", "..XXXX..", "...XX...", "........"]
INFINITO8 = ["........", ".XX..XX.", "X..XX..X", "X..XX..X", ".XX..XX.", "........", "........", "........"]


def _dentro(x, y, reg):
    u, v, w, h = reg
    return u <= x < u + w and v <= y < v + h


def piel(tramo):
    base = Image.open(TEX / "claude.png").convert("RGBA")
    img = base.copy()
    px = img.load()
    # Tono, saturación y brillo: de naranja Claude a carmesí y, en la fase 20, casi negro.
    dh, ks, kv = ((0, 1.0, 1.0), (-7, 1.05, 0.92), (-13, 1.1, 0.8), (-19, 1.15, 0.62), (-21, 0.75, 0.28))[tramo]
    reservado = [ba.REG["emblema"], ba.REG["ojo"], ba.REG["ojo_lado"], ba.REG["emblema_lado"], (48, 48, 16, 12)]
    for y in range(64):
        for x in range(64):
            r, g, b, a = px[x, y]
            if a == 0 or any(_dentro(x, y, reg) for reg in reservado):
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if s > 0.12 and (h < 0.17 or h > 0.95):
                h = (h + dh / 360) % 1.0
                s = min(1.0, s * ks)
                v = min(1.0, v * kv)
            elif tramo >= 3:
                v *= 0.55 if tramo == 3 else 0.35
            r2, g2, b2 = colorsys.hsv_to_rgb(h, s, v)
            px[x, y] = (int(r2 * 255), int(g2 * 255), int(b2 * 255), a)
    # Sin la estrella de Claude en el pecho (se asomaba detrás del alma): color del cuerpo.
    for y in range(20, 32):
        fila = [px[x, y] for x in range(20, 28)]
        oscuros = sorted(fila, key=lambda c: c[0] + c[1] + c[2])
        cuerpo = oscuros[len(oscuros) // 2]
        for x in range(20, 28):
            r, g, b, a = px[x, y]
            h, s2, v2 = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if a and (s2 < 0.3 and v2 > 0.55 or (r + g + b) > sum(cuerpo[:3]) + 90):
                px[x, y] = cuerpo
    if tramo == 4:
        # Venas de determinación: una línea fina y limpia por zona (pecho, brazos y piernas).
        rnd = random.Random(20)
        for (x0, y0, x1, y1) in ((21, 21, 27, 32), (44, 21, 48, 32), (36, 53, 40, 64), (4, 21, 8, 32), (20, 53, 24, 64)):
            x, y = rnd.randint(x0 + 1, x1 - 2), y0
            while y < y1:
                px[x, y] = (196, 24, 38, 255)
                y += 1
                if rnd.random() < 0.25:
                    x = max(x0, min(x1 - 1, x + rnd.choice((-1, 1))))
    # Emblema: el alma (corazón) en los tramos 0-2; el infinito (∞) en los 3-4. Con la luz
    # del material "glow" (alfa bajo = brilla más).
    u, v, w, h = ba.REG["emblema"]
    fondo = ((140, 64, 40), (120, 40, 32), (70, 16, 20), (40, 10, 14), (18, 6, 8))[tramo]
    forma = CORAZON8 if tramo <= 2 else INFINITO8
    color = ((236, 46, 60), (246, 40, 56), (255, 52, 66), (255, 196, 80), (255, 70, 80))[tramo]
    brillo = (150, 60, 0, 0, 0)[tramo]
    for yy in range(h):
        for xx in range(w):
            if forma[yy][xx] == "X":
                px[u + xx, v + yy] = color + (brillo,)
            else:
                px[u + xx, v + yy] = fondo + (255,)
    if tramo <= 2:
        px[u + 2, v + 1] = (255, 236, 236, brillo)  # brillo del alma
    eu, ev = ba.REG["emblema_lado"][:2]
    px[eu, ev] = fondo + (255,)
    # Ojos: normales hasta la fase 15; rojos que brillan un poco (16-19) y del todo (20).
    if tramo >= 3:
        ou, ov, ow, oh = ba.REG["ojo"]
        rojo, alfa = ((160, 20, 34), 140) if tramo == 3 else ((255, 46, 58), 0)
        for yy in range(oh):
            for xx in range(ow):
                px[ou + xx, ov + yy] = rojo + (alfa,)
        px[ou, ov] = (255, 220, 220, alfa)
        lu, lv = ba.REG["ojo_lado"][:2]
        px[lu, lv] = rojo + (alfa,)
    return img


# =============================================================================
# Capa extra (cinta, bufanda y hombreras) con los mismos huesos del modelo de Claude
# =============================================================================

EXTRA = {"cinta": (0, 0, 8, 2), "cinta_cola": (8, 0, 2, 4), "bufanda": (0, 4, 9, 3), "bufanda_cola": (12, 4, 3, 9),
         "hombrera": (0, 16, 6, 6), "hombrera_borde": (8, 16, 6, 2)}


def extra_textura():
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    px = img.load()

    def zona(n, fn):
        u, v, w, h = EXTRA[n]
        for y in range(h):
            for x in range(w):
                px[u + x, v + y] = fn(x, y, w, h) + (255,)
    zona("cinta", lambda x, y, w, h: (214, 30, 44) if y == 0 else (150, 18, 30))
    zona("cinta_cola", lambda x, y, w, h: (200, 26, 40) if y < h - 1 else (130, 14, 26))
    zona("bufanda", lambda x, y, w, h: (196, 28, 40) if y == 1 else (24, 20, 24))
    zona("bufanda_cola", lambda x, y, w, h: (196, 28, 40) if x in (0, w - 1) else (28, 22, 28) if y % 3 else (40, 30, 36))
    zona("hombrera", lambda x, y, w, h: (238, 190, 80) if y == 0 else (60, 56, 66) if (x + y) % 4 else (84, 80, 92))
    zona("hombrera_borde", lambda x, y, w, h: (220, 40, 52))
    return img


def _uv(nombre, caras=ba.FACES):
    u, v, w, h = EXTRA[nombre]
    return {f: {"uv": [u, v], "uv_size": [w, h]} for f in caras}


def extra_geo():
    """Mismos huesos (y pivotes) que geometry.claudenpc.claude: las animaciones de Claude mueven
    también la cinta, la bufanda y las hombreras."""
    g = json.loads((RP / "models/entity/claude.geo.json").read_text(encoding="utf-8"))["minecraft:geometry"][0]
    huesos = {b["name"]: b for b in g["bones"]}

    def caja(hueso):
        c = huesos[hueso]["cubes"][0]
        return c["origin"], c["size"]
    (hx, hy, hz), (hw, hh, hd) = caja("head")
    (bx, by, bz), (bw, bh, bd) = caja("body")
    (rx, ry, rz), (rw, rh, rd) = caja("rightArm")
    (lx, ly, lz), (lw, lh, ld) = caja("leftArm")
    r3 = v9.r3
    out = []
    for n in ("root", "waist", "body", "head", "rightArm", "leftArm"):
        b = {"name": n, "pivot": huesos[n].get("pivot", [0, 0, 0])}
        if huesos[n].get("parent"):
            b["parent"] = huesos[n]["parent"]
        out.append(b)
    top = hy + hh
    out.append({"name": "cinta", "parent": "head", "pivot": [0, top - 2, 0], "cubes": [
        {"origin": r3([hx - 0.4, top - 2.4, hz - 0.4]), "size": r3([hw + 0.8, 1.6, hd + 0.8]), "uv": _uv("cinta")}]})
    atras = hz + hd + 0.4
    out.append({"name": "cinta_colas", "parent": "head", "pivot": r3([0, top - 1.6, atras]), "cubes": [
        {"origin": r3([-1.6, top - 4.6, atras]), "size": [1.2, 3, 0.3], "uv": _uv("cinta_cola")},
        {"origin": r3([0.4, top - 5.0, atras]), "size": [1.2, 3.4, 0.3], "uv": _uv("cinta_cola")}]})
    cuello = by + bh
    out.append({"name": "bufanda", "parent": "body", "pivot": [0, cuello, 0], "cubes": [
        {"origin": r3([bx - 0.6, cuello - 1.8, bz - 0.6]), "size": r3([bw + 1.2, 2.3, bd + 1.2]), "uv": _uv("bufanda")},
        {"origin": r3([1.2, cuello - 4.0, bz - 0.9]), "size": [1.6, 2.2, 0.4], "uv": _uv("bufanda")}]})
    espalda = bz + bd + 0.6
    out.append({"name": "bufanda_cola", "parent": "body", "pivot": r3([0, cuello - 1, espalda]), "cubes": [
        {"origin": r3([-3.2, cuello - 9.0, espalda]), "size": [2.6, 8, 0.4], "uv": _uv("bufanda_cola")}]})
    for lado, (ox, oy, oz), (w, h, d) in (("der", (rx, ry, rz), (rw, rh, rd)), ("izq", (lx, ly, lz), (lw, lh, ld))):
        arriba = oy + h
        out.append({"name": f"hombrera_{lado}", "parent": "rightArm" if lado == "der" else "leftArm",
                    "pivot": huesos["rightArm" if lado == "der" else "leftArm"]["pivot"], "cubes": [
                        {"origin": r3([ox - 0.6, arriba - 2.6, oz - 0.6]), "size": r3([w + 1.2, 3.0, d + 1.2]),
                         "uv": {**_uv("hombrera", ("up", "north", "south", "east", "west")), **_uv("hombrera_borde", ("down",))}}]})
    return v9.geo("geometry.claudenpc.infinito_extra", out, 32, 32, bounds=(2, 3, 1.5))


# =============================================================================
# Animaciones
# =============================================================================

def _k(d):
    return {f"{t:.2f}": v for t, v in d.items()}


GUARDIA = {"rightArm": [-35, 8, 6], "leftArm": [-48, -14, -8], "body": [6, 0, 0], "head": [-6, 0, 0],
           "rightLeg": [-8, 0, 3], "leftLeg": [10, 0, -3]}


def animaciones():
    a = {}
    # Siempre: las colas de la cinta y de la bufanda se mueven (más si corre).
    a["animation.claudenpc.infinito.base"] = {"loop": True, "bones": {
        "cinta_colas": {"rotation": ["12 + math.sin(query.life_time * 260) * 6 + query.modified_move_speed * 35", 0, 0]},
        "bufanda_cola": {"rotation": ["8 + math.sin(query.life_time * 200) * 5 + query.modified_move_speed * 45", 0, 0]}}}
    # Poses que se sostienen (controlador "claudenpc_infinito_pose").
    a["animation.claudenpc.infinito.pose_ninguna"] = {"loop": True, "bones": {}}
    a["animation.claudenpc.infinito.pose_guardia"] = {"loop": True, "bones": {
        **{h: {"rotation": r} for h, r in GUARDIA.items()},
        "root": {"position": [0, "math.sin(query.life_time * 420) * 0.25", 0]}}}
    a["animation.claudenpc.infinito.pose_observar"] = {"loop": True, "bones": {
        "rightArm": {"rotation": [-52, 32, 0]}, "leftArm": {"rotation": [-52, -32, 0]},
        "head": {"rotation": [0, 0, "math.sin(query.life_time * 90) * 9"]},
        "body": {"rotation": [0, "math.sin(query.life_time * 60) * 6", 0]}}}
    a["animation.claudenpc.infinito.pose_cubrirse"] = {"loop": True, "bones": {
        "leftArm": {"rotation": [-78, -26, 10]}, "rightArm": {"rotation": [-28, 10, 0]},
        "body": {"rotation": [8, 0, 0]}, "head": {"rotation": [-6, 0, 0]}}}
    a["animation.claudenpc.infinito.pose_derrota"] = {"loop": True, "bones": {
        "root": {"position": [0, -6, 0]}, "body": {"rotation": [28, 0, 0]}, "head": {"rotation": ["30 + math.sin(query.life_time * 120) * 3", 0, 0]},
        "rightArm": {"rotation": [-18, 0, 8]}, "leftArm": {"rotation": [-24, 0, -8]},
        "rightLeg": {"rotation": [80, 0, 0]}, "leftLeg": {"rotation": [-62, 0, 0]}}}
    a["animation.claudenpc.infinito.pose_cargado"] = {"loop": True, "bones": {
        "root": {"rotation": [90, 0, 0], "position": [0, 6, 0]}, "head": {"rotation": [20, 0, 0]},
        "rightArm": {"rotation": ["-80 + math.sin(query.life_time * 300) * 8", 0, 0]},
        "leftArm": {"rotation": ["-80 - math.sin(query.life_time * 300) * 8", 0, 0]},
        "rightLeg": {"rotation": [8, 0, 0]}, "leftLeg": {"rotation": [-8, 0, 0]}}}
    a["animation.claudenpc.infinito.pose_recuperar"] = {"loop": True, "bones": {
        "root": {"position": [0, -7, 0]}, "rightLeg": {"rotation": [-85, 8, 0]}, "leftLeg": {"rotation": [-85, -8, 0]},
        "rightArm": {"rotation": [-24, 0, 10]}, "leftArm": {"rotation": [-24, 0, -10]}, "body": {"rotation": [6, 0, 0]},
        "head": {"rotation": ["12 + math.sin(query.life_time * 150) * 4", 0, 0]}}}
    # Gestos (una vez).
    g = GUARDIA["rightArm"]
    gestos = {
        "preparar": (0.3, {"rightArm": {0.0: g, 0.3: [-140, 20, 10]}}),
        "rapido": (0.25, {"rightArm": {0.0: [-130, 25, 10], 0.1: [-10, -25, -10], 0.25: g},
                          "body": {0.0: [0, 15, 0], 0.1: [0, -20, 0], 0.25: [0, 0, 0]}}),
        "pesado": (0.5, {"rightArm": {0.0: g, 0.2: [-175, 0, 0], 0.32: [10, 0, 0], 0.5: g},
                         "leftArm": {0.0: GUARDIA["leftArm"], 0.2: [-170, 0, 0], 0.32: [0, 0, 0], 0.5: GUARDIA["leftArm"]},
                         "body": {0.0: [0, 0, 0], 0.2: [-10, 0, 0], 0.32: [25, 0, 0], 0.5: [6, 0, 0]}}),
        "esquiva": (0.35, {"body": {0.0: [0, 0, 0], 0.12: [0, 0, 22], 0.35: [0, 0, 0]},
                           "head": {0.0: [0, 0, 0], 0.12: [0, 0, -14], 0.35: [0, 0, 0]},
                           "root": {0.0: [0, 0, 0], 0.12: [0, -1.5, 0], 0.35: [0, 0, 0]}}),
        "cambio": (0.3, {"rightArm": {0.0: g, 0.12: [20, 0, 15], 0.3: g}}),
        "giro": (0.5, {"root": {0.0: [0, 0, 0], 0.25: [0, 180, 0], 0.5: [0, 360, 0]}}),
        "finta": (0.3, {"rightArm": {0.0: g, 0.12: [-110, 15, 8], 0.3: [-60, 10, 6]}}),
        "critico": (0.35, {"rightArm": {0.0: [-160, 0, 0], 0.18: [20, 0, 0], 0.35: g}, "body": {0.0: [0, 0, 0], 0.18: [20, 0, 0], 0.35: [6, 0, 0]}}),
        "victoria": (1.2, {"rightArm": {0.0: [0, 0, 0], 0.3: [-170, 0, -10], 1.0: [-170, 0, -10], 1.2: [0, 0, 0]},
                           "head": {0.0: [0, 0, 0], 0.3: [-20, 0, 0], 1.2: [0, 0, 0]}}),
        "evolucion": (1.6, {"rightArm": {0.0: [0, 0, 0], 0.5: [-90, 0, 80], 1.3: [-90, 0, 80], 1.6: [0, 0, 0]},
                            "leftArm": {0.0: [0, 0, 0], 0.5: [-90, 0, -80], 1.3: [-90, 0, -80], 1.6: [0, 0, 0]},
                            "head": {0.0: [0, 0, 0], 0.5: [-30, 0, 0], 1.3: [-30, 0, 0], 1.6: [0, 0, 0]}}),
    }
    posicion = {"esquiva": "root"}
    for nombre, (largo, huesos) in gestos.items():
        bones = {}
        for hueso, claves in huesos.items():
            canal = "position" if (posicion.get(nombre) == hueso and nombre == "esquiva") else "rotation"
            bones[hueso] = {canal: _k(claves)}
        if nombre in ("victoria", "evolucion"):
            bones["root"] = {"position": _k({0.0: [0, 0, 0], 0.3: [0, 1.5, 0], 0.5: [0, 0, 0]} if nombre == "victoria"
                                            else {0.0: [0, 0, 0], 0.5: [0, 2, 0], 1.3: [0, 2, 0], 1.6: [0, 0, 0]})}
        a[f"animation.claudenpc.infinito.{nombre}"] = {"animation_length": largo, "bones": bones}
    write_json(RP / "animations/infinito.animation.json", {"format_version": "1.8.0", "animations": a})
    write_json(RP / "animation_controllers/infinito.animation_controllers.json", {"format_version": "1.10.0", "animation_controllers": {
        "controller.animation.claudenpc.infinito.aura": {"initial_state": "sin", "states": {
            "sin": {"transitions": [{"aura": "query.mark_variant == 1"}]},
            "aura": {"particle_effects": [{"effect": "aura"}, {"effect": "chispas"}], "transitions": [{"sin": "query.mark_variant != 1"}]}}}}})
    return a


# =============================================================================
# Partículas
# =============================================================================

ALMA = {"alma": (0, 0, 8, 8), "fragmento": (8, 0, 4, 4), "chispa": (12, 0, 4, 4), "rombo": (16, 0, 8, 8), "anillo": (0, 8, 16, 16)}


def atlas_alma():
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    px = img.load()
    u, v, _, _ = ALMA["alma"]
    for y, fila in enumerate(CORAZON8):
        for x, c in enumerate(fila):
            if c == "X":
                px[u + x, v + y] = (255, 255, 255, 255)
    px[u + 2, v + 1] = (255, 255, 255, 255)
    for y in range(4):
        for x in range(4):
            if x <= y:
                px[8 + x, y] = (255, 255, 255, 255)
            px[12 + x, y] = (255, 255, 255, int(255 * math.exp(-((x - 1.5) ** 2 + (y - 1.5) ** 2) * 0.7)))
    for y in range(8):
        for x in range(8):
            if abs(x - 3.5) + abs(y - 3.5) <= 3.6:
                px[16 + x, y] = (255, 255, 255, 255 if abs(x - 3.5) + abs(y - 3.5) > 2.4 else 150)
    for y in range(16):
        for x in range(16):
            d = math.hypot(x - 7.5, y - 7.5) / 7.5
            px[x, 8 + y] = (255, 255, 255, int(255 * math.exp(-((d - 0.8) ** 2) * 90)))
    return img


def particulas():
    (RP / "textures/particle").mkdir(parents=True, exist_ok=True)
    atlas_alma().save(RP / "textures/particle/claudenpc_alma.png")
    edad = "variable.particle_age / variable.particle_lifetime"

    def efecto(nombre, sprite, comps, color, size, material="particles_add", facing="lookat_xyz"):
        u, v, w, h = ALMA[sprite]
        tinte = {"color": {"gradient": color, "interpolant": edad}} if isinstance(color, dict) else {"color": color}
        write_json(RP / f"particles/{nombre}.particle.json", {"format_version": "1.10.0", "particle_effect": {
            "description": {"identifier": f"claudenpc:{nombre}",
                            "basic_render_parameters": {"material": material, "texture": "textures/particle/claudenpc_alma"}},
            "components": {"minecraft:particle_appearance_billboard": {"size": size, "facing_camera_mode": facing,
                                                                       "uv": {"texture_width": 32, "texture_height": 32, "uv": [u, v], "uv_size": [w, h]}},
                           "minecraft:particle_appearance_tinting": tinte, **comps}}})

    vida = lambda t: {"minecraft:particle_lifetime_expression": {"max_lifetime": t}}
    una = {"minecraft:emitter_lifetime_once": {"active_time": 0.05}}
    bucle = {"minecraft:emitter_lifetime_looping": {"active_time": 1}}
    pegado = {"minecraft:emitter_local_space": {"position": True, "rotation": False}}
    rojo_oro = {"0.0": "#00FF3048", "0.2": "#FFFF3048", "0.7": "#CCFFC050", "1.0": "#00FFC050"}
    # Aura de la fase 20 (la dibuja el cliente: no cuesta script). Pocas partículas.
    efecto("infinito_aura", "chispa", {**pegado, **bucle, "minecraft:emitter_rate_steady": {"spawn_rate": 7, "max_particles": 10},
                                       "minecraft:emitter_shape_disc": {"radius": 0.6, "plane_normal": [0, 1, 0], "offset": [0, 0.1, 0],
                                                                        "direction": [0, 1, 0]},
                                       **vida(1.3), "minecraft:particle_initial_speed": 0.7,
                                       "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 0.8}},
           rojo_oro, [f"0.07 * (1 - {edad} * 0.6)", f"0.07 * (1 - {edad} * 0.6)"])
    efecto("infinito_chispas", "fragmento", {**pegado, **bucle, "minecraft:emitter_rate_steady": {"spawn_rate": 2, "max_particles": 4},
                                             "minecraft:emitter_shape_sphere": {"radius": 0.3, "offset": [0, 1.1, 0], "direction": "outwards"},
                                             **vida(0.8), "minecraft:particle_initial_speed": 1.0,
                                             "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 1.2, 0], "linear_drag_coefficient": 1.5}},
           rojo_oro, [0.05, 0.05])
    efecto("infinito_evolucion", "alma", {**una, "minecraft:emitter_rate_instant": {"num_particles": 14},
                                          "minecraft:emitter_shape_sphere": {"radius": 0.3, "direction": "outwards"},
                                          **vida(0.9), "minecraft:particle_initial_speed": 4,
                                          "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 3}},
           {"0.0": "#FFFFFFFF", "0.3": "#FFFF3048", "1.0": "#00FF3048"}, [0.14, 0.14], material="particles_alpha")
    efecto("infinito_anillo", "anillo", {**una, "minecraft:emitter_rate_instant": {"num_particles": 1}, "minecraft:emitter_shape_point": {},
                                         **vida(0.6), "minecraft:particle_initial_speed": 0, "minecraft:particle_motion_dynamic": {}},
           {"0.0": "#FFFFFFFF", "0.3": "#FFFF3048", "1.0": "#00FF3048"}, [f"0.5 + 3 * {edad}", f"0.5 + 3 * {edad}"],
           facing="emitter_transform_xz")
    efecto("infinito_alma", "alma", {**una, "minecraft:emitter_rate_instant": {"num_particles": 1}, "minecraft:emitter_shape_point": {},
                                     **vida(0.55), "minecraft:particle_initial_speed": 0, "minecraft:particle_motion_dynamic": {}},
           "#FFFF2A40", ["0.2 * (1 + math.sin(variable.particle_age * 900) * 0.12)", "0.2 * (1 + math.sin(variable.particle_age * 900) * 0.12)"],
           material="particles_alpha")
    efecto("infinito_golpe", "fragmento", {**una, "minecraft:emitter_rate_instant": {"num_particles": 6},
                                           "minecraft:emitter_shape_sphere": {"radius": 0.15, "direction": "outwards"},
                                           **vida(0.3), "minecraft:particle_initial_speed": 3,
                                           "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 5}},
           {"0.0": "#FFFFFFFF", "0.4": "#FFFF3048", "1.0": "#00FF3048"}, [0.06, 0.06])
    efecto("infinito_cura", "alma", {**una, "minecraft:emitter_rate_instant": {"num_particles": 3},
                                     "minecraft:emitter_shape_sphere": {"radius": 0.4, "direction": [0, 1, 0]},
                                     **vida(1.0), "minecraft:particle_initial_speed": 0.8,
                                     "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 1}},
           {"0.0": "#00FF8090", "0.3": "#FFFF6078", "1.0": "#00FF6078"}, [0.1, 0.1], material="particles_alpha")
    efecto("sello_marca", "rombo", {**una, "minecraft:emitter_rate_instant": {"num_particles": 1}, "minecraft:emitter_shape_point": {},
                                    **vida(0.55), "minecraft:particle_initial_speed": 0, "minecraft:particle_motion_dynamic": {}},
           {"0.0": "#00FF3048", "0.3": "#CCFF3048", "1.0": "#00FF3048"}, [0.2, 0.2])
    efecto("sello_romper", "fragmento", {**una, "minecraft:emitter_rate_instant": {"num_particles": 24},
                                         "minecraft:emitter_shape_sphere": {"radius": 0.3, "direction": "outwards"},
                                         **vida(1.2), "minecraft:particle_initial_speed": 4,
                                         "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -6, 0], "linear_drag_coefficient": 1.5}},
           {"0.0": "#FFFFFFFF", "0.3": "#FFFF3048", "1.0": "#00FF3048"}, [0.08, 0.08], material="particles_alpha")


# =============================================================================
# Entidades
# =============================================================================

GESTOS_CLAUDE = ("espadazo", "espadazo2", "hachazo", "estocada", "bloqueo", "arco", "lanzar", "beber", "cubeta", "torre",
                 "celebrar", "golpe")


def entidades(anims):
    pieles = {f"t{i}": f"textures/entity/claudenpc/infinito_{i}" for i in range(5)}
    pieles["t5"] = "textures/entity/claudenpc/infinito_saitama"  # cara de la cinemática de la fase 20
    claude = json.loads((RP / "entity/claude.entity.json").read_text(encoding="utf-8"))["minecraft:client_entity"]["description"]["animations"]
    animaciones = {k: claude[k] for k in ("mirar", "caminar", "respirar", "parpadeo")}
    animaciones.update({k: claude[k] for k in GESTOS_CLAUDE if k in claude})
    for nombre in anims:
        animaciones["inf_" + nombre.rsplit(".", 1)[1]] = nombre
    animaciones["ctrl_aura"] = "controller.animation.claudenpc.infinito.aura"
    write_json(RP / "entity/exponencial_infinito.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": ID,
        "materials": {"default": "entity_alphatest", "glow": "entity_emissive_alpha"},
        "textures": {**pieles, "extra": "textures/entity/claudenpc/infinito_extra"},
        "geometry": {"default": "geometry.claudenpc.claude", "extra": "geometry.claudenpc.infinito_extra"},
        "animations": animaciones,
        "particle_effects": {"aura": "claudenpc:infinito_aura", "chispas": "claudenpc:infinito_chispas"},
        "scripts": {"animate": ["mirar", "caminar", "respirar", "parpadeo", "inf_base", "ctrl_aura"]},
        "render_controllers": ["controller.render.claudenpc_infinito", "controller.render.claudenpc_infinito_extra"],
        "enable_attachables": True,
        "spawn_egg": {"base_color": "#2A0A10", "overlay_color": "#FF3048"}}}})
    write_json(RP / "render_controllers/infinito.render_controllers.json", {"format_version": "1.8.0", "render_controllers": {
        "controller.render.claudenpc_infinito": {
            "arrays": {"textures": {"Array.pieles": [f"Texture.t{i}" for i in range(6)]}},
            "geometry": "Geometry.default", "textures": ["Array.pieles[query.skin_id == 1 ? 5 : query.variant]"],
            "materials": [{"*": "Material.default"}, {"emblema": "Material.glow"}, {"ojos": "Material.glow"}],
            "part_visibility": [{"*": True}, {"herr_*": False}]},
        "controller.render.claudenpc_infinito_extra": {
            "geometry": "Geometry.extra", "textures": ["Texture.extra"], "materials": [{"*": "Material.default"}],
            "part_visibility": [{"*": True}, {"cinta*": "query.variant >= 1 && query.skin_id != 1"}, {"bufanda*": "query.variant >= 2"},
                                {"hombrera*": "query.variant >= 3"}]},
    }})
    # Comportamiento.
    grupos = {}
    eventos = {}
    for i, vida in enumerate(VIDA_TRAMO):
        grupos[f"claudenpc:nivel_{i}"] = {"minecraft:variant": {"value": i}, "minecraft:health": {"value": vida, "max": vida}}
        eventos[f"claudenpc:nivel_{i}"] = {"add": {"component_groups": [f"claudenpc:nivel_{i}"]},
                                          "remove": {"component_groups": [f"claudenpc:nivel_{k}" for k in range(5) if k != i]}}
    for i in (0, 1):
        grupos[f"claudenpc:aura_{i}"] = {"minecraft:mark_variant": {"value": i}}
        eventos[f"claudenpc:aura_{i}"] = {"add": {"component_groups": [f"claudenpc:aura_{i}"]},
                                         "remove": {"component_groups": [f"claudenpc:aura_{1 - i}"]}}
    eventos["minecraft:entity_spawned"] = {"add": {"component_groups": ["claudenpc:nivel_0", "claudenpc:aura_0"]}}
    # Cara de la cinemática de la fase 20 (query.skin_id 1); sin el grupo, skin_id es 0.
    grupos["claudenpc:cara_1"] = {"minecraft:skin_id": {"value": 1}}
    eventos["claudenpc:cara_1"] = {"add": {"component_groups": ["claudenpc:cara_1"]}}
    eventos["claudenpc:cara_0"] = {"remove": {"component_groups": ["claudenpc:cara_1"]}}
    eventos["claudenpc:bloqueo"] = {}
    eventos["claudenpc:golpe_fatal"] = {}
    trig, f_tag = v9.trig, v9.f_tag
    sensor = [
        v9.INTOCABLE,
        trig(cause="fall", filtros=f_tag("claudenpc_sin_caida")),
        v9.AMIGOS,
        trig(cause="entity_explosion", filtros=f_tag("claudenpc_antiexplosion"), deals="yes", mult=0.25),
        trig(cause="block_explosion", filtros=f_tag("claudenpc_antiexplosion"), deals="yes", mult=0.25),
        trig(cause="projectile", filtros=f_tag("claudenpc_escudo_flechas"), evento="claudenpc:bloqueo"),
        trig(cause="entity_attack", filtros={"all_of": [f_tag("claudenpc_escudo"), {"none_of": v9.HACHAS}]}, evento="claudenpc:bloqueo"),
        v9.FATAL,
    ]
    sin_soltar = [{"slot": s, "drop_chance": 0.0} for s in ("slot.weapon.mainhand", "slot.weapon.offhand", "slot.armor.head",
                                                            "slot.armor.chest", "slot.armor.legs", "slot.armor.feet")]
    write_json(BP / "entities/exponencial_infinito.entity.json", {"format_version": "1.21.0", "minecraft:entity": {
        "description": {"identifier": ID, "is_spawnable": True, "is_summonable": True},
        "component_groups": grupos,
        "components": {
            "minecraft:type_family": {"family": ["claudenpc", "claudenpc_infinito", "mob"]},
            "minecraft:collision_box": {"width": 0.6, "height": 1.8},
            "minecraft:health": {"value": VIDA_TRAMO[0], "max": VIDA_TRAMO[0]},
            "minecraft:movement": {"value": 0.3},
            "minecraft:navigation.walk": {"can_path_over_water": True, "avoid_damage_blocks": True, "can_open_doors": True,
                                          "can_pass_doors": True, "can_jump": True},
            "minecraft:movement.basic": {},
            "minecraft:jump.static": {"jump_power": 0.42},
            "minecraft:can_climb": {},
            "minecraft:physics": {},
            "minecraft:pushable": {"is_pushable": True, "is_pushable_by_piston": True},
            "minecraft:nameable": {"always_show": True, "allow_name_tag_renaming": False},
            "minecraft:persistent": {},
            "minecraft:knockback_resistance": {"value": 0.0},
            "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0},
            "minecraft:equipment": {"table": "loot_tables/entities/claudenpc_sin_equipo.json", "slot_drop_chance": sin_soltar},
            "minecraft:annotation.open_door": {},
            "minecraft:follow_range": {"value": 48, "max": 48},
            "minecraft:damage_sensor": {"triggers": sensor},
            "minecraft:behavior.float": {"priority": 0},
            "minecraft:behavior.look_at_player": {"priority": 8, "look_distance": 12, "probability": 0.6},
            "minecraft:behavior.random_look_around": {"priority": 9},
        },
        "events": eventos}})


def textos():
    nombres = {"en_US": ("Claude Exponencial Infinito", "Spawn Claude Exponencial Infinito"),
               "es_ES": (NOMBRE, "Generar a Claude Exponencial Infinito"),
               "es_MX": (NOMBRE, "Generar a Claude Exponencial Infinito")}
    for archivo, (nombre, huevo) in nombres.items():
        ruta = RP / f"texts/{archivo}.lang"
        lineas = [ln for ln in ruta.read_text(encoding="utf-8").splitlines()
                  if not ln.startswith((f"entity.{ID}.name=", f"item.spawn_egg.entity.{ID}.name="))]
        lineas += [f"entity.{ID}.name={nombre}", f"item.spawn_egg.entity.{ID}.name={huevo}"]
        ruta.write_text("\n".join(lineas) + "\n", encoding="utf-8")


# =============================================================================
# v10.1: cinemática de la fase 20. Arte propio, dibujado aquí con formas simples (estilo
# garabato del meme de la gráfica de poder): no se copian imágenes de ningún anime.
#   - cara estilo Saitama para el Infinito (calvo, ojos aburridos);
#   - máscara estilo Garou para el jugador (máscara blanca con orejas puntiagudas);
#   - partículas: fondo con cuadrícula y ejes, trazo de las curvas, caras, destello, energía
#     roja y el texto "TOP 1" rojo con borde negro (sin marco).
# =============================================================================
from PIL import ImageDraw, ImageFont, ImageFilter

PIEL_S = (246, 214, 182)
PIEL_S2 = (222, 184, 150)
TINTA = (18, 14, 16)
CINE = {"dg": 20, "db": 26, "w": 16, "h": 9, "bw": 56, "bh": 28}  # los mismos valores que cinematica.js


def _fuente(tam):
    for ruta in ("/usr/share/fonts/opentype/inter/Inter-Black.otf", "/usr/share/fonts/opentype/inter/InterDisplay-Black.otf",
                 "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(ruta, tam)
        except OSError:
            continue
    return ImageFont.load_default()


def cara_saitama():
    img = piel(4).copy()  # el cuerpo de la fase 20
    px = img.load()
    # Cabeza (caja 8x8x8 con UV en 0,0): calva y de piel clara en todas sus caras.
    for y in range(0, 16):
        for x in range(0, 32):
            if y < 8 and (x < 8 or x >= 24):
                continue
            px[x, y] = PIEL_S + (255,)
    for x in range(0, 32):
        px[x, 15] = PIEL_S2 + (255,)  # sombra bajo la barbilla y los lados
    for (x, y) in ((10, 2), (11, 2), (10, 3)):
        px[x, y] = (255, 238, 220, 255)  # brillo de la calva
    for base in (0, 16):  # orejas en los costados
        for (x, y) in ((3, 11), (4, 11), (3, 12), (4, 12), (3, 13)):
            px[base + x, y] = PIEL_S2 + (255,)
    for x in (11, 12):  # boca: una rayita
        px[x, 14] = TINTA + (255,)
    # Ojos (cubos de 2x3 delante de la cara; alfa 255 = no brillan): párpado caído y pupila.
    ou, ov, _, _ = ba.REG["ojo"]
    for xx in range(2):
        px[ou + xx, ov] = TINTA + (255,)
        px[ou + xx, ov + 2] = PIEL_S + (255,)
    px[ou, ov + 1] = (250, 250, 250, 255)
    px[ou + 1, ov + 1] = TINTA + (255,)
    lu, lv = ba.REG["ojo_lado"][:2]
    px[lu, lv] = PIEL_S + (255,)
    return img


def _mascara_textura():
    # 128x128 para un modelo de 64x64 unidades (2 píxeles por unidad).
    img = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    blanco, gris, sombra = (242, 242, 240, 255), (214, 214, 214, 255), (176, 176, 182, 255)

    def caja(u, v, w, h, prof):
        # Caras de un box UV (u, v en unidades) pintadas de blanco con borde gris.
        caras = {"up": (u + prof, v, w, prof), "down": (u + prof + w, v, w, prof), "east": (u, v + prof, prof, h),
                 "north": (u + prof, v + prof, w, h), "west": (u + prof + w, v + prof, prof, h), "south": (u + 2 * prof + w, v + prof, w, h)}
        for nombre, (x, y, ww, hh) in caras.items():
            d.rectangle([x * 2, y * 2, (x + ww) * 2 - 1, (y + hh) * 2 - 1], fill=blanco if nombre in ("north", "up") else gris)
            d.rectangle([x * 2, y * 2, (x + ww) * 2 - 1, (y + hh) * 2 - 1], outline=sombra)
        return caras

    caras = caja(0, 0, 9, 9, 9)
    # Frente: ojos negros rasgados (enojados), boca con colmillos y una raya roja en la frente.
    x0, y0, _, _ = caras["north"]
    X, Y = x0 * 2, y0 * 2  # esquina superior izquierda en píxeles (18x18 px)
    d.polygon([(X + 2, Y + 6), (X + 8, Y + 8), (X + 7, Y + 10), (X + 3, Y + 9)], fill=(16, 12, 14, 255))
    d.polygon([(X + 16, Y + 6), (X + 10, Y + 8), (X + 11, Y + 10), (X + 15, Y + 9)], fill=(16, 12, 14, 255))
    d.line([(X + 4, Y + 14), (X + 14, Y + 14)], fill=(16, 12, 14, 255), width=1)
    for k in range(5):
        cx = X + 5 + k * 2
        d.polygon([(cx, Y + 14), (cx + 1, Y + 16), (cx + 2, Y + 14)], fill=(16, 12, 14, 255))
    d.line([(X + 8, Y + 2), (X + 9, Y + 5), (X + 10, Y + 2)], fill=(200, 24, 36, 255), width=1)
    # Orejas: blanco (40,0) y el interior rosado (44,0).
    d.rectangle([80, 0, 83, 3], fill=blanco)
    d.rectangle([88, 0, 91, 3], fill=(236, 150, 160, 255))
    return img


def _oreja(lado):
    # Tres cubos escalonados: se ve puntiaguda desde cualquier lado.
    blanco = {"uv": [40, 0], "uv_size": [2, 2]}
    rosa = {"uv": [44, 0], "uv_size": [2, 2]}
    cubos = []
    for (ancho, alto, prof, y) in ((3, 2, 2, 32.5), (2, 1.5, 1.5, 34.5), (1, 1.25, 1, 36)):
        x = 3 - ancho / 2 if lado > 0 else -3 - ancho / 2
        caras = {f: dict(blanco) for f in ("north", "south", "east", "west", "up", "down")}
        if ancho == 3:
            caras["north"] = dict(rosa)
        cubos.append({"origin": [x, y, -prof / 2], "size": [ancho, alto, prof], "uv": caras})
    return cubos


def mascara_garou():
    geo = {"format_version": "1.16.0", "minecraft:geometry": [{
        "description": {"identifier": "geometry.claudenpc.mascara_garou", "texture_width": 64, "texture_height": 64,
                        "visible_bounds_width": 2, "visible_bounds_height": 3, "visible_bounds_offset": [0, 1.5, 0]},
        "bones": [
            {"name": "head", "pivot": [0, 24, 0]},
            {"name": "mascara", "parent": "head", "pivot": [0, 24, 0],
             "cubes": [{"origin": [-4.5, 23.5, -4.5], "size": [9, 9, 9], "uv": [0, 0]}]},
            {"name": "oreja_der", "parent": "mascara", "pivot": [-3, 32.5, 0], "rotation": [0, 0, 14], "cubes": _oreja(-1)},
            {"name": "oreja_izq", "parent": "mascara", "pivot": [3, 32.5, 0], "rotation": [0, 0, -14], "cubes": _oreja(1)},
        ]}]}
    write_json(RP / "models/entity/mascara_garou.geo.json", geo)
    (RP / "textures/models/claudenpc").mkdir(parents=True, exist_ok=True)
    _mascara_textura().save(RP / "textures/models/claudenpc/mascara_garou.png")
    # Ícono 16x16 (para el inventario si el jugador se queda con ella).
    ico = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(ico)
    d.polygon([(10, 22), (16, 4), (24, 18)], fill=(242, 242, 240, 255), outline=(30, 30, 34, 255))
    d.polygon([(54, 22), (48, 4), (40, 18)], fill=(242, 242, 240, 255), outline=(30, 30, 34, 255))
    d.ellipse([8, 12, 56, 60], fill=(242, 242, 240, 255), outline=(30, 30, 34, 255), width=3)
    d.polygon([(16, 30), (29, 34), (27, 40), (18, 37)], fill=(16, 12, 14, 255))
    d.polygon([(48, 30), (35, 34), (37, 40), (46, 37)], fill=(16, 12, 14, 255))
    d.line([(22, 49), (42, 49)], fill=(16, 12, 14, 255), width=3)
    ico.resize((16, 16), Image.LANCZOS).save(RP / "textures/items/mascara_garou.png")
    at = RP / "textures/item_texture.json"
    datos = json.loads(at.read_text(encoding="utf-8"))
    datos["texture_data"]["claudenpc_mascara_garou"] = {"textures": "textures/items/mascara_garou"}
    write_json(at, datos)
    (RP / "attachables").mkdir(parents=True, exist_ok=True)
    write_json(RP / "attachables/mascara_garou.attachable.json", {"format_version": "1.10.0", "minecraft:attachable": {"description": {
        "identifier": "claudenpc:mascara_garou",
        "materials": {"default": "entity_alphatest"},
        "textures": {"default": "textures/models/claudenpc/mascara_garou"},
        "geometry": {"default": "geometry.claudenpc.mascara_garou"},
        "scripts": {"parent_setup": "variable.helmet_layer_visible = 0.0;"},
        "render_controllers": ["controller.render.claudenpc_mascara_garou"]}}})
    write_json(RP / "render_controllers/mascara_garou.render_controllers.json", {"format_version": "1.8.0", "render_controllers": {
        "controller.render.claudenpc_mascara_garou": {
            "geometry": "Geometry.default", "materials": [{"*": "Material.default"}], "textures": ["Texture.default"],
            "part_visibility": [{"*": "!(c.item_slot == 'main_hand' || c.item_slot == 'off_hand')"}]}}})
    write_json(BP / "items/mascara_garou.json", {"format_version": "1.21.40", "minecraft:item": {
        "description": {"identifier": "claudenpc:mascara_garou", "menu_category": {"category": "equipment"}},
        "components": {
            "minecraft:icon": "claudenpc_mascara_garou",
            "minecraft:display_name": {"value": "Máscara de Garou"},
            "minecraft:max_stack_size": 1,
            "minecraft:wearable": {"slot": "slot.armor.head", "protection": 0}}}})


def _cara_doodle(tipo):
    # Íconos de garabato (256 px y se reducen a 64): blancos con borde negro.
    S = 256
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    negro = (14, 12, 16, 255)
    if tipo == "s":
        d.ellipse([58, 22, 198, 236], fill=(255, 255, 255, 255), outline=negro, width=9)
        for cx in (100, 156):  # ojos aburridos: óvalo, pupila y párpado recto
            d.ellipse([cx - 17, 104, cx + 17, 148], fill=(255, 255, 255, 255), outline=negro, width=6)
            d.ellipse([cx - 6, 126, cx + 6, 140], fill=negro)
            d.line([(cx - 19, 118), (cx + 19, 118)], fill=negro, width=7)
        d.line([(116, 196), (140, 196)], fill=negro, width=6)
        d.arc([46, 118, 74, 160], 90, 270, fill=negro, width=6)
        d.arc([182, 118, 210, 160], 270, 90, fill=negro, width=6)
    else:
        d.polygon([(46, 120), (62, 18), (112, 84)], fill=(255, 255, 255, 255), outline=negro)
        d.polygon([(210, 120), (194, 18), (144, 84)], fill=(255, 255, 255, 255), outline=negro)
        d.line([(46, 120), (62, 18), (112, 84)], fill=negro, width=8)
        d.line([(210, 120), (194, 18), (144, 84)], fill=negro, width=8)
        d.ellipse([40, 60, 216, 240], fill=(255, 255, 255, 255), outline=negro, width=9)
        d.polygon([(70, 128), (120, 146), (114, 168), (78, 160)], fill=negro)
        d.polygon([(186, 128), (136, 146), (142, 168), (178, 160)], fill=negro)
        d.line([(92, 204), (164, 204)], fill=negro, width=7)
        for k in range(4):
            x = 104 + k * 16
            d.polygon([(x, 204), (x + 8, 222), (x + 16, 204)], fill=negro)
        d.line([(120, 78), (128, 104), (136, 78)], fill=(214, 24, 40, 255), width=7)
    return img.resize((64, 64), Image.LANCZOS)


def _fondo_grafica():
    # 1024x512 para 112x56 bloques (CINE["bw"], CINE["bh"]); a 26 bloques de la cámara.
    W, H = 1024, 512
    img = Image.new("RGBA", (W, H), (5, 6, 10, 255))
    d = ImageDraw.Draw(img)
    for x in range(0, W, 32):
        d.line([(x, 0), (x, H)], fill=(58, 62, 74, 255), width=2)
    for y in range(0, H, 32):
        d.line([(0, y), (W, y)], fill=(58, 62, 74, 255), width=2)
    ppb = W / (2 * CINE["bw"])  # píxeles por bloque
    k = CINE["db"] / CINE["dg"]
    x0 = W / 2 - CINE["w"] * k * ppb
    x1 = W / 2 + CINE["w"] * k * ppb
    y0 = H / 2 + CINE["h"] * k * ppb
    y1 = H / 2 - CINE["h"] * k * ppb
    verde = (64, 240, 104, 255)
    d.line([(x0, y0), (x1 + 18, y0)], fill=verde, width=6)
    d.line([(x0, y0), (x0, y1 - 18)], fill=verde, width=6)
    d.polygon([(x1 + 34, y0), (x1 + 14, y0 - 12), (x1 + 14, y0 + 12)], fill=verde)
    d.polygon([(x0, y1 - 34), (x0 - 12, y1 - 14), (x0 + 12, y1 - 14)], fill=verde)
    f = _fuente(30)
    d.text(((x0 + x1) / 2, y0 + 30), "TIEMPO (X)", font=f, fill=verde, anchor="mm", stroke_width=3, stroke_fill=(0, 30, 10, 255))
    etiqueta = Image.new("RGBA", (300, 60), (0, 0, 0, 0))
    ImageDraw.Draw(etiqueta).text((150, 30), "PODER (Y)", font=f, fill=verde, anchor="mm", stroke_width=3, stroke_fill=(0, 30, 10, 255))
    etiqueta = etiqueta.rotate(90, expand=True)
    img.alpha_composite(etiqueta, (int(x0 - 66), int((y0 + y1) / 2 - 150)))
    # Viñeta suave en los bordes.
    vin = Image.new("L", (W, H), 0)
    ImageDraw.Draw(vin).ellipse([-W * 0.25, -H * 0.3, W * 1.25, H * 1.3], fill=255)
    vin = vin.filter(ImageFilter.GaussianBlur(60))
    negro = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    return Image.composite(img, negro, vin)


def _destello():
    S = 256
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rnd = random.Random(7)
    c = S / 2
    for i in range(150):
        a = rnd.random() * math.tau
        largo = c * (0.45 + rnd.random() * 0.55)
        ancho = 0.012 + rnd.random() * 0.02
        p1 = (c + math.cos(a - ancho) * 10, c + math.sin(a - ancho) * 10)
        p2 = (c + math.cos(a) * largo, c + math.sin(a) * largo)
        p3 = (c + math.cos(a + ancho) * 10, c + math.sin(a + ancho) * 10)
        d.polygon([p1, p2, p3], fill=(255, 255, 255, 150 + rnd.randint(0, 105)))
    nucleo = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(nucleo).ellipse([c - 46, c - 46, c + 46, c + 46], fill=(255, 255, 255, 255))
    img.alpha_composite(nucleo.filter(ImageFilter.GaussianBlur(14)))
    return img


def _rayos_rojos():
    S = 256
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rnd = random.Random(11)
    c = S / 2
    for i in range(90):
        a = rnd.random() * math.tau
        r0 = c * (0.15 + rnd.random() * 0.3)
        r1 = c * (0.65 + rnd.random() * 0.35)
        color = rnd.choice(((255, 40, 60), (255, 96, 40), (255, 190, 80), (255, 20, 90)))
        d.line([(c + math.cos(a) * r0, c + math.sin(a) * r0), (c + math.cos(a) * r1, c + math.sin(a) * r1)],
               fill=color + (200,), width=rnd.choice((2, 3, 4)))
    return img.filter(ImageFilter.GaussianBlur(0.6))


def _top1():
    # "TOP 1": letras rojas con borde negro grueso, sin marco ni fondo.
    img = Image.new("RGBA", (512, 256), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.text((256, 128), "TOP 1", font=_fuente(170), fill=(232, 24, 32, 255), anchor="mm", stroke_width=14, stroke_fill=(0, 0, 0, 255))
    return img.resize((256, 128), Image.LANCZOS)


def _trazo():
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    px = img.load()
    for y in range(16):
        a = max(0.0, 1 - abs(y - 7.5) / 7.5) ** 1.6
        for x in range(16):
            px[x, y] = (255, 255, 255, int(255 * a))
    return img


def cine_particulas():
    tex = RP / "textures/particle"
    _fondo_grafica().save(tex / "claudenpc_cine_fondo.png")
    caras = Image.new("RGBA", (128, 64), (0, 0, 0, 0))
    caras.alpha_composite(_cara_doodle("s"), (0, 0))
    caras.alpha_composite(_cara_doodle("g"), (64, 0))
    caras.save(tex / "claudenpc_cine_caras.png")
    _destello().save(tex / "claudenpc_cine_destello.png")
    _rayos_rojos().save(tex / "claudenpc_cine_rojo.png")
    _top1().save(tex / "claudenpc_cine_top1.png")
    _trazo().save(tex / "claudenpc_cine_trazo.png")

    def parti(nombre, textura, material, size, uv, extra=None, facing="lookat_xyz", vida="variable.vida > 0 ? variable.vida : 3", color=None):
        comps = {
            "minecraft:emitter_rate_instant": {"num_particles": 1},
            "minecraft:emitter_lifetime_once": {"active_time": 0},
            "minecraft:emitter_shape_point": {},
            "minecraft:particle_lifetime_expression": {"max_lifetime": vida},
            "minecraft:particle_initial_speed": 0,
            "minecraft:particle_motion_dynamic": {},
            "minecraft:particle_appearance_billboard": {"size": size, "facing_camera_mode": facing, "uv": uv},
        }
        if color is not None:
            comps["minecraft:particle_appearance_tinting"] = {"color": color}
        comps.update(extra or {})
        write_json(RP / f"particles/{nombre}.particle.json", {"format_version": "1.10.0", "particle_effect": {
            "description": {"identifier": f"claudenpc:{nombre}", "basic_render_parameters": {"material": material, "texture": f"textures/particle/{textura}"}},
            "components": comps}})

    escala = "(variable.escala > 0 ? variable.escala : 1)"
    parti("cine_fondo", "claudenpc_cine_fondo", "particles_blend", [CINE["bw"], CINE["bh"]],
          {"texture_width": 1024, "texture_height": 512, "uv": [0, 0], "uv_size": [1024, 512]},
          color=[1, 1, 1, "math.min(1, variable.particle_age * 5)"], vida="variable.vida > 0 ? variable.vida : 7")
    parti("cine_trazo", "claudenpc_cine_trazo", "particles_add", ["variable.largo * 0.5", "variable.grosor > 0 ? variable.grosor : 0.07"],
          {"texture_width": 16, "texture_height": 16, "uv": [0, 0], "uv_size": [16, 16]}, facing="lookat_direction",
          extra={"minecraft:emitter_shape_point": {"direction": ["variable.dir.x", "variable.dir.y", "variable.dir.z"]},
                 "minecraft:particle_initial_speed": 0.02})
    for nombre, u in (("cine_cara_s", 0), ("cine_cara_g", 64)):
        parti(nombre, "claudenpc_cine_caras", "particles_blend", [f"0.9 * {escala}", f"0.9 * {escala}"],
              {"texture_width": 128, "texture_height": 64, "uv": [u, 0], "uv_size": [64, 64]}, vida="variable.vida > 0 ? variable.vida : 0.12")
    parti("cine_destello", "claudenpc_cine_destello", "particles_add",
          [f"math.min(9, 1 + variable.particle_age * 26) * {escala}", f"math.min(9, 1 + variable.particle_age * 26) * {escala}"],
          {"texture_width": 256, "texture_height": 256, "uv": [0, 0], "uv_size": [256, 256]},
          color=[1, 1, 1, "1 - math.pow(variable.particle_age / variable.particle_lifetime, 2)"], vida="variable.vida > 0 ? variable.vida : 1.6",
          extra={"minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": 20}})
    parti("cine_rojo", "claudenpc_cine_rojo", "particles_add",
          [f"(1.5 + variable.particle_age * 9) * {escala}", f"(1.5 + variable.particle_age * 9) * {escala}"],
          {"texture_width": 256, "texture_height": 256, "uv": [0, 0], "uv_size": [256, 256]},
          color=[1, 1, 1, "1 - variable.particle_age / variable.particle_lifetime"], vida="variable.vida > 0 ? variable.vida : 0.8",
          extra={"minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": 90}})
    pop = "math.min(1, variable.particle_age * 8)"
    parti("cine_top1", "claudenpc_cine_top1", "particles_blend", [f"2.4 * {escala} * {pop}", f"1.2 * {escala} * {pop}"],
          {"texture_width": 256, "texture_height": 128, "uv": [0, 0], "uv_size": [256, 128]}, vida="variable.vida > 0 ? variable.vida : 3")


def generar():
    cara_saitama().save(TEX / "infinito_saitama.png")
    mascara_garou()
    cine_particulas()
    for i in range(5):
        piel(i).save(TEX / f"infinito_{i}.png")
    extra_textura().save(TEX / "infinito_extra.png")
    write_json(RP / "models/entity/infinito_extra.geo.json", extra_geo())
    anims = animaciones()
    particulas()
    entidades(anims)
    textos()
