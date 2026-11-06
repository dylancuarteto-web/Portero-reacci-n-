"""Claude NPC v9.0 (Minecraft 1.21.132).

- Sensores de daño con etiquetas: reemplazan a world.beforeEvents.entityHurt, que no existe en
  la 1.21.132 (ver BP/scripts/dano.js).
- Claudes sin fuego amigo: los golpes, flechas y explosiones de un Claude no dañan a otro.
- Láseres de energía de Golden (en lugar de los rayos): entidad con núcleo brillante y dos capas
  de halo, destello al aparecer, se apaga encogiéndose, partículas de energía, largo, dirección
  y grosor propios de cada láser.
- Avisos "!" hechos con partículas (no se pueden golpear).
- Marionetas propias (zombi, husk, ahogado, aldeano zombi, esqueleto, stray, bogged y aldeano)
  con los ojos amarillos y el corazón enredado DENTRO de su modelo, y cuerdas amarillas sólidas
  (cintas que siempre miran a la cámara, como las riendas).
- Inundación de energía del parkour sin rayos en zigzag: superficie de energía y haces rectos.

Todo el arte es original. Se ejecuta desde golden_final_assets.generar() (build_assets.py).
"""
import json
import math
import random
import subprocess
import wave
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

import build_assets as ba

RP = ba.RP
BP = ba.ROOT / "BP"
write_json = ba.write_json
TEX = RP / "textures/entity/claudenpc"
PTEX = RP / "textures/particle"


# =============================================================================
# Sensores de daño
# =============================================================================

def f_tag(tag, subject="self"):
    return {"test": "has_tag", "subject": subject, "value": tag}


def f_fam(fam, subject="other"):
    return {"test": "is_family", "subject": subject, "value": fam}


def de(fam):
    """El golpe viene de esa familia: quien golpea ("other") o lo que golpea ("damager", la
    flecha o el proyectil)."""
    return {"any_of": [f_fam(fam, "other"), f_fam(fam, "damager")]}


HACHAS = [{"test": "has_equipment", "subject": "other", "domain": "hand", "value": f"minecraft:{m}_axe"}
          for m in ("wooden", "stone", "iron", "golden", "diamond", "netherite")]


def trig(cause=None, filtros=None, evento=None, deals="no", mult=None):
    t = {}
    if cause:
        t["cause"] = cause
    if filtros or evento:
        od = {}
        if filtros:
            od["filters"] = filtros
        if evento:
            od["event"] = evento
            od["target"] = "self"
        t["on_damage"] = od
    t["deals_damage"] = deals
    if mult is not None:
        t["damage_multiplier"] = mult
    return t


# El juego usa el primer disparador que coincide: van de lo más fuerte a lo más débil.
INTOCABLE = trig(filtros=f_tag("claudenpc_intocable"))
AMIGOS = trig(filtros=de("claudenpc"))
FATAL = trig(filtros={"test": "has_damage", "value": "fatal"}, evento="claudenpc:golpe_fatal")


def causa(c):
    return trig(cause=c)


SENSORES = {
    # Claude: intocable en la fusión, sin daño por caída tras una maniobra, escudo que para
    # flechas y golpes sin hacha, reflejos 5 que esquivan, y ningún golpe tuyo le quita más de
    # 24 (si el golpe lo mataría y le quedan más de 24, el script le quita solo 24).
    "claude": [
        INTOCABLE,
        trig(cause="fall", filtros=f_tag("claudenpc_sin_caida")),
        AMIGOS,
        trig(cause="projectile", filtros=f_tag("claudenpc_escudo_flechas"), evento="claudenpc:bloqueo"),
        trig(cause="entity_attack", filtros={"all_of": [f_tag("claudenpc_escudo"), de("player"), {"none_of": HACHAS}]},
             evento="claudenpc:bloqueo"),
        trig(cause="entity_attack", filtros={"all_of": [f_tag("claudenpc_esquiva"), de("player")]}, evento="claudenpc:esquiva"),
        trig(filtros={"all_of": [{"test": "has_damage", "value": "fatal"}, de("player"),
                                 {"test": "actor_health", "subject": "self", "operator": ">", "value": 24}]},
             evento="claudenpc:golpe_fatal"),
    ],
    "maestro": [INTOCABLE, AMIGOS, causa("fall")],
    # Robot: escudo de energía (las flechas rebotan y el resto hace la mitad).
    "robot": [
        INTOCABLE, AMIGOS, causa("fall"), causa("suffocation"), causa("entity_explosion"),
        trig(cause="projectile", filtros=f_tag("claudenpc_escudo_robot"), evento="claudenpc:refleja"),
        trig(filtros=f_tag("claudenpc_escudo_robot"), deals="yes", mult=0.5),
    ],
    # Robot multi: nunca se rompe; el golpe que lo dejaría sin vida lo apaga.
    "robot_multi": [INTOCABLE, AMIGOS, causa("fall"), causa("suffocation"), FATAL],
    # Golden: intocable en cinemáticas y curándose, devuelve flechas, sus marionetas no le hacen
    # daño, y nunca muere de un golpe: el script empieza su muerte (o el parkour, o la fase final).
    "claude_golden": [
        INTOCABLE, causa("fall"), causa("suffocation"), causa("fire"), causa("lava"),
        trig(filtros={"any_of": [de("claudenpc_marioneta"), f_tag("claudenpc_marioneta", "other"),
                                 f_tag("claudenpc_marioneta", "damager")]}),
        trig(cause="projectile", filtros=f_tag("claudenpc_refleja"), evento="claudenpc:refleja"),
        FATAL,
    ],
    # Espejismo de Golden: igual que antes (sin caídas ni fuego).
    "espejismo": [INTOCABLE, causa("fall"), causa("suffocation"), causa("fire"), causa("lava")],
}

EVENTOS_SENSOR = {
    "claude": ["claudenpc:bloqueo", "claudenpc:esquiva", "claudenpc:golpe_fatal"],
    "robot": ["claudenpc:refleja"],
    "robot_multi": ["claudenpc:golpe_fatal"],
    "claude_golden": ["claudenpc:refleja", "claudenpc:golpe_fatal"],
}

# Los Claudes no se vengan de otro Claude (y el robot tampoco).
SIN_CLAUDES = [{"filters": {"none_of": [f_fam("claudenpc")]}, "max_dist": 32}]


def sensores():
    for nombre, lista in SENSORES.items():
        ruta = BP / f"entities/{nombre}.entity.json"
        d = json.loads(ruta.read_text(encoding="utf-8"))
        ent = d["minecraft:entity"]
        comps = ent["components"]
        comps["minecraft:damage_sensor"] = {"triggers": lista}
        eventos = ent.setdefault("events", {})
        for ev in EVENTOS_SENSOR.get(nombre, []):
            eventos.setdefault(ev, {})
        # Venganza solo contra quien no es un Claude.
        lugares = [comps] + list(ent.get("component_groups", {}).values())
        for lugar in lugares:
            h = lugar.get("minecraft:behavior.hurt_by_target")
            if h is not None:
                h["entity_types"] = SIN_CLAUDES
        write_json(ruta, d)


# =============================================================================
# Utilidades
# =============================================================================

def r3(v):
    return [round(x, 3) for x in v]


def geo(identifier, bones, tw, th, bounds=(2, 3, 1.5)):
    return {"format_version": "1.16.0", "minecraft:geometry": [{
        "description": {"identifier": identifier, "texture_width": tw, "texture_height": th,
                        "visible_bounds_width": bounds[0], "visible_bounds_height": bounds[1],
                        "visible_bounds_offset": [0, bounds[2], 0]},
        "bones": bones}]}


def mezcla(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def grupo_evento(nombre, comps):
    return ({f"claudenpc:{nombre}": comps}, {f"claudenpc:{nombre}": {"add": {"component_groups": [f"claudenpc:{nombre}"]}}})


def entidad_objeto(ident, familias, grupos=None, eventos=None, extra=None, caja=(0.05, 0.05)):
    """Entidad de adorno: no se mueve, no choca y no recibe daño."""
    comps = {
        "minecraft:type_family": {"family": ["claudenpc", "claudenpc_objeto", "inanimate"] + familias},
        "minecraft:collision_box": {"width": caja[0], "height": caja[1]},
        "minecraft:physics": {"has_gravity": False, "has_collision": False},
        "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
        "minecraft:health": {"value": 1, "max": 1},
        "minecraft:damage_sensor": {"triggers": [{"cause": "all", "deals_damage": "no"}]},
        "minecraft:knockback_resistance": {"value": 1.0},
        "minecraft:fire_immune": True,
        "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0, "breathes_water": True},
        "minecraft:movement": {"value": 0},
        **(extra or {}),
    }
    cuerpo = {"description": {"identifier": ident, "is_spawnable": False, "is_summonable": True}, "components": comps}
    if grupos:
        cuerpo["component_groups"] = grupos
    if eventos:
        cuerpo["events"] = eventos
    write_json(BP / f"entities/{ident.split(':')[1]}.entity.json", {"format_version": "1.21.0", "minecraft:entity": cuerpo})


def cliente(ident, archivo, materiales, texturas, geometria, animaciones, animar, controladores, extra=None):
    desc = {"identifier": ident, "materials": materiales, "textures": texturas, "geometry": geometria,
            "animations": animaciones, "scripts": {"animate": animar}, "render_controllers": controladores, **(extra or {})}
    write_json(RP / f"entity/{archivo}.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": desc}})


# =============================================================================
# Láseres de energía de Golden
# =============================================================================
# Una entidad por haz. El haz sale del origen de la entidad hacia adelante (-z del modelo):
#   - giro (dirección horizontal): la rotación con la que aparece (initialRotation) y el cuerpo
#     queda bloqueado (minecraft:body_rotation_blocked);
#   - inclinación: minecraft:variant (0-90): (v - 45) * 2 grados, positivo hacia abajo;
#   - largo: minecraft:mark_variant (1-128): n * 0.5 bloques (hasta 64);
#   - estilo: minecraft:skin_id (0-15): color (amarillo, azul, morado, oro) + 4 * grosor
#     (fino, normal, grueso, enorme).
# Se ponen con eventos en el mismo tick en que aparece: el juego los manda junto con la
# entidad (no se pierden como una animación lanzada antes de que exista en el cliente).
# Capas: núcleo casi blanco (emisivo) y dos halos aditivos con pulsos de energía que corren por
# el haz. Al aparecer: destello (se ensancha y vuelve) y el haz "sale" hasta su largo en 0,06 s;
# al terminar se apaga encogiéndose (animación lanzada por el script).

COLORES_LASER = ("amarillo", "azul", "morado", "oro")
PALETA_LASER = {
    "amarillo": ((255, 251, 222), (255, 206, 44), (214, 120, 8)),
    "azul": ((236, 250, 255), (72, 182, 255), (16, 64, 210)),
    "morado": ((250, 236, 255), (196, 96, 255), (106, 18, 196)),
    "oro": ((255, 255, 246), (255, 232, 150), (236, 168, 44)),
}
GROSORES = (0.55, 1.0, 1.8, 3.2)
INCLINACIONES = 91
LARGOS_LASER = 128
PASO_LASER = 0.5


def laser_textura(color):
    claro, medio, oscuro = PALETA_LASER[color]
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    px = img.load()
    # Núcleo (filas 0-3): casi blanco y emisivo (alfa 60, como las demás partes que brillan).
    for y, k in enumerate((0.45, 1.0, 1.0, 0.45)):
        for x in range(32):
            px[x, y] = mezcla(claro, (255, 255, 255), k) + (60,)

    # Halos aditivos (lo negro no se ve): interior filas 8-11, exterior filas 16-23. A lo largo
    # del haz hay dos pulsos de energía que corren (la textura se desplaza).
    def banda(y0, alto, sigma, fuerza, base):
        for y in range(alto):
            t = (y + 0.5) / alto * 2 - 1
            k = math.exp(-(t * t) / (2 * sigma * sigma)) * fuerza
            for x in range(32):
                pulso = max(0.0, math.cos(x / 32 * 2 * math.pi * 2)) ** 8
                flujo = base + (1 - base) * pulso + 0.04 * math.sin(x * 2.3)
                kk = max(0.0, min(1.0, k * flujo))
                col = mezcla(oscuro, medio, kk * 1.6)
                if kk > 0.6:
                    col = mezcla(col, claro, (kk - 0.6) / 0.4)
                px[x, y0 + y] = tuple(int(c * kk) for c in col) + (int(255 * kk),)

    banda(8, 4, 0.5, 1.0, 0.8)
    banda(16, 8, 0.42, 0.78, 0.7)
    return img


def tubo(media, v0, alto, angulos):
    """Paredes de un tubo a lo largo de -z (solo las caras este y oeste de cada cubo: así la
    textura siempre corre a lo largo del haz); varios cubos girados lo hacen redondo."""
    uv = {"east": {"uv": [0, v0], "uv_size": [32, alto]}, "west": {"uv": [0, v0], "uv_size": [32, alto]}}
    return [{"origin": r3([-media, -media, -16]), "size": r3([2 * media, 2 * media, 16]), "pivot": [0, 0, 0],
             "rotation": [0, 0, a], "uv": uv} for a in angulos]


def laser_geo():
    huesos = [{"name": "laser", "pivot": [0, 0, 0]},
              {"name": "inclina", "parent": "laser", "pivot": [0, 0, 0]},
              {"name": "largo", "parent": "inclina", "pivot": [0, 0, 0]},
              {"name": "ancho", "parent": "largo", "pivot": [0, 0, 0]},
              {"name": "pulso", "parent": "ancho", "pivot": [0, 0, 0]},
              {"name": "fin", "parent": "pulso", "pivot": [0, 0, 0]},
              {"name": "nucleo", "parent": "fin", "pivot": [0, 0, 0], "cubes": tubo(0.75, 0, 4, (0, 45, 90, 135))},
              {"name": "halo", "parent": "fin", "pivot": [0, 0, 0],
               "cubes": tubo(1.9, 8, 4, (0, 45, 90, 135)) + tubo(3.6, 16, 8, (22.5, 67.5, 112.5, 157.5))}]
    return geo("geometry.claudenpc.laser", huesos, 32, 32, bounds=(140, 140, 0))


GROSOR_MOLANG = ("(math.floor(query.skin_id / 4) == 0 ? {0} : (math.floor(query.skin_id / 4) == 1 ? {1} : "
                 "(math.floor(query.skin_id / 4) == 2 ? {2} : {3})))").format(*GROSORES)
PULSO_MOLANG = ("query.life_time < 0.05 ? 0.25 + query.life_time * 31 : (query.life_time < 0.2 ? "
                "1.8 - (query.life_time - 0.05) * 5.333 : 1.0 + math.sin(query.life_time * 1600) * 0.06)")


def lasers():
    write_json(RP / "models/entity/laser_golden.geo.json", laser_geo())
    for c in COLORES_LASER:
        laser_textura(c).save(TEX / f"laser_{c}.png")
    write_json(RP / "animations/laser_golden.animation.json", {"format_version": "1.8.0", "animations": {
        "animation.claudenpc.laser.forma": {"loop": True, "bones": {
            "inclina": {"rotation": ["(query.variant - 45) * 2", 0, 0]},
            "largo": {"scale": [1, 1, f"math.max(query.mark_variant, 1) * {PASO_LASER} * math.min(1, query.life_time * 16)"]},
            "ancho": {"scale": [GROSOR_MOLANG, GROSOR_MOLANG, 1]},
            "pulso": {"scale": [PULSO_MOLANG, PULSO_MOLANG, 1]}}},
        "animation.claudenpc.laser.apagar": {"animation_length": 0.3, "loop": "hold_on_last_frame", "bones": {
            "fin": {"scale": {"0.0": [1, 1, 1], "0.06": [1.35, 1.35, 1], "0.3": [0, 0, 1]}}}},
    }})
    colores = {"Array.colores": [f"Texture.{c}" for c in COLORES_LASER]}
    write_json(RP / "render_controllers/laser_golden.render_controllers.json", {"format_version": "1.8.0", "render_controllers": {
        "controller.render.claudenpc_laser_nucleo": {
            "arrays": {"textures": colores}, "geometry": "Geometry.default", "materials": [{"*": "Material.nucleo"}],
            "textures": ["Array.colores[math.mod(query.skin_id, 4)]"], "part_visibility": [{"*": True}, {"halo": False}]},
        "controller.render.claudenpc_laser_halo": {
            "arrays": {"textures": colores}, "geometry": "Geometry.default", "materials": [{"*": "Material.halo"}],
            "textures": ["Array.colores[math.mod(query.skin_id, 4)]"], "part_visibility": [{"*": True}, {"nucleo": False}],
            "uv_anim": {"offset": ["query.life_time * 1.4", 0.0], "scale": [1.0, 1.0]}},
    }})
    cliente("claudenpc:laser_golden", "laser_golden", {"nucleo": "entity_emissive_alpha", "halo": "charged_creeper"},
            {c: f"textures/entity/claudenpc/laser_{c}" for c in COLORES_LASER}, {"default": "geometry.claudenpc.laser"},
            {"forma": "animation.claudenpc.laser.forma", "apagar": "animation.claudenpc.laser.apagar"}, ["forma"],
            ["controller.render.claudenpc_laser_nucleo", "controller.render.claudenpc_laser_halo"])
    grupos, eventos = {}, {}
    for i in range(INCLINACIONES):
        g, e = grupo_evento(f"inclina_{i}", {"minecraft:variant": {"value": i}})
        grupos.update(g)
        eventos.update(e)
    for n in range(1, LARGOS_LASER + 1):
        g, e = grupo_evento(f"largo_{n}", {"minecraft:mark_variant": {"value": n}})
        grupos.update(g)
        eventos.update(e)
    for k in range(16):
        g, e = grupo_evento(f"estilo_{k}", {"minecraft:skin_id": {"value": k}})
        grupos.update(g)
        eventos.update(e)
    entidad_objeto("claudenpc:laser_golden", ["claudenpc_laser"], grupos, eventos, {"minecraft:body_rotation_blocked": {}})


# =============================================================================
# Partículas v9: láseres, avisos "!", cuerdas e inundación (textura propia)
# =============================================================================

ATLAS9 = {"excl": (0, 0, 16, 32), "excl_halo": (16, 0, 16, 32), "haz": (32, 0, 16, 8), "cuerda": (32, 8, 16, 8),
          "nudo": (48, 0, 8, 8), "mota": (48, 8, 8, 8), "rombo": (32, 16, 16, 16), "anillo": (48, 16, 16, 16),
          "disco": (0, 32, 32, 32)}


def atlas_v9():
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    px = img.load()

    def region(nombre, fn):
        u, v, w, h = ATLAS9[nombre]
        for y in range(h):
            for x in range(w):
                c = fn((x + 0.5) / w * 2 - 1, (y + 0.5) / h * 2 - 1)
                if c is not None:
                    px[u + x, v + y] = c

    # "!": barra que se afina hacia abajo y punto, relleno blanco (se tiñe) y borde oscuro.
    def excl_forma(x, y):
        barra = -0.86 <= y <= 0.36 and abs(x) <= 0.42 - (y + 0.86) * 0.14
        punto = math.hypot(x / 0.95, (y - 0.7) / 0.48) <= 0.5
        return barra or punto

    mascara = Image.new("L", (16, 32), 0)
    mp = mascara.load()
    for y in range(32):
        for x in range(16):
            mp[x, y] = 255 if excl_forma((x + 0.5) / 16 * 2 - 1, (y + 0.5) / 32 * 2 - 1) else 0
    borde = mascara.filter(ImageFilter.MaxFilter(3))
    bp = borde.load()
    for y in range(32):
        for x in range(16):
            if mp[x, y]:
                brillo = 255 if x < 9 else 228  # un lado un poco más oscuro (volumen)
                px[x, y] = (brillo, brillo, brillo, 255)
            elif bp[x, y]:
                px[x, y] = (34, 22, 10, 255)
    halo = borde.filter(ImageFilter.GaussianBlur(2.2))
    hp = halo.load()
    for y in range(32):
        for x in range(16):
            a = min(255, int(hp[x, y] * 1.6))
            if a:
                px[16 + x, y] = (255, 255, 255, a)
    # Cinta del haz: brillo en el centro, se apaga hacia los bordes (a lo ancho).
    region("haz", lambda x, y: (255, 255, 255, int(255 * math.exp(-(y * y) * 3.2))))
    # Cuerda amarilla sólida: borde oscuro, cuerpo, brillo en el medio (parece redonda porque la
    # cinta siempre mira a la cámara) y una fibra más clara.
    perfil = [(116, 74, 10), (204, 142, 24), (238, 186, 44), (255, 226, 112), (255, 240, 170),
              (250, 214, 84), (222, 160, 32), (128, 82, 12)]
    u, v, w, h = ATLAS9["cuerda"]
    for yy in range(h):
        for xx in range(w):
            c = perfil[yy]
            if (xx + yy) % 5 == 0 and 1 <= yy <= 6:
                c = mezcla(c, (255, 248, 200), 0.35)  # fibras torcidas
            px[u + xx, v + yy] = c + (255,)
    region("nudo", lambda x, y: ((248, 200, 56, 255) if math.hypot(x, y) < 0.62 else
                                 ((132, 86, 14, 255) if math.hypot(x, y) < 0.92 else None)))
    region("mota", lambda x, y: (255, 255, 255, int(255 * math.exp(-(x * x + y * y) * 3.5))))

    def rombo(x, y):
        a = max(0.0, 1 - (abs(x) + abs(y)) * 1.1)
        rayos = math.exp(-abs(x) * 10) * math.exp(-abs(y) * 1.4) + math.exp(-abs(y) * 10) * math.exp(-abs(x) * 1.4)
        return (255, 255, 255, int(255 * min(1.0, a * 1.4 + rayos)))
    region("rombo", rombo)
    region("anillo", lambda x, y: (255, 255, 255, int(255 * math.exp(-((math.hypot(x, y) - 0.78) ** 2) * 110))))
    region("disco", lambda x, y: (255, 255, 255, int(255 * min(1.0, math.exp(-(x * x + y * y) * 2.6) * 1.15))))
    return img


def particulas_v9():
    PTEX.mkdir(parents=True, exist_ok=True)
    atlas_v9().save(PTEX / "claudenpc_v9.png")
    edad = "variable.particle_age / variable.particle_lifetime"

    def efecto(nombre, sprite, comps, color, size, material="particles_add", facing="lookat_xyz", direccion=None):
        u, v, w, h = ATLAS9[sprite]
        billboard = {"size": size, "facing_camera_mode": facing,
                     "uv": {"texture_width": 64, "texture_height": 64, "uv": [u, v], "uv_size": [w, h]}}
        tinte = ({"color": {"gradient": color, "interpolant": edad}} if isinstance(color, dict) else {"color": color})
        write_json(RP / f"particles/{nombre}.particle.json", {"format_version": "1.10.0", "particle_effect": {
            "description": {"identifier": f"claudenpc:{nombre}",
                            "basic_render_parameters": {"material": material, "texture": "textures/particle/claudenpc_v9"}},
            "components": {"minecraft:particle_appearance_billboard": billboard,
                           "minecraft:particle_appearance_tinting": tinte, **comps}}})

    unavez = lambda t=0.05: {"minecraft:emitter_lifetime_once": {"active_time": t}}
    inst = lambda n: {"minecraft:emitter_rate_instant": {"num_particles": n}}
    vida = lambda t: {"minecraft:particle_lifetime_expression": {"max_lifetime": t}}
    vel = lambda s: {"minecraft:particle_initial_speed": s}
    mov = lambda **kw: {"minecraft:particle_motion_dynamic": kw}
    punto = {"minecraft:emitter_shape_point": {}}
    hacia = {"minecraft:emitter_shape_point": {"direction": ["variable.dir.x", "variable.dir.y", "variable.dir.z"]}}
    hexa = {"amarillo": "FFD22C", "azul": "48B6FF", "morado": "C460FF", "oro": "FFE896"}
    for c in COLORES_LASER:
        col = hexa[c]
        # Destello al disparar (y al pegar): se abre rápido y se apaga.
        efecto(f"laser_destello_{c}", "disco", {**inst(1), **unavez(), **punto, **vida(0.24), **vel(0), **mov()},
               {"0.0": "#FFFFFFFF", "0.3": f"#FF{col}", "1.0": f"#00{col}"},
               [f"0.5 + 2.6 * math.min(1, ({edad}) * 4)", f"0.5 + 2.6 * math.min(1, ({edad}) * 4)"])
        efecto(f"laser_estrella_{c}", "rombo", {**inst(1), **unavez(), **punto, **vida(0.16), **vel(0), **mov()},
               {"0.0": "#FFFFFFFF", "1.0": f"#00{col}"}, [f"1.4 * (1 - {edad})", f"1.4 * (1 - {edad})"])
        # Motas de energía alrededor del haz (salen hacia afuera y se apagan).
        efecto(f"laser_chispas_{c}", "mota", {**inst(5), **unavez(),
                                             "minecraft:emitter_shape_sphere": {"radius": 0.18, "direction": "outwards"},
                                             "minecraft:particle_lifetime_expression": {"max_lifetime": "0.3 + math.random(0, 0.35)"},
                                             **vel("1.6 + math.random(0, 1.6)"), **mov(linear_drag_coefficient=4.5)},
               {"0.0": "#FFFFFFFF", "0.35": f"#FF{col}", "1.0": f"#00{col}"}, [f"0.09 * (1 - {edad})", f"0.09 * (1 - {edad})"])
        # Anillo en el suelo donde pega.
        efecto(f"laser_impacto_{c}", "anillo", {**inst(1), **unavez(), **punto, **vida(0.4), **vel(0), **mov()},
               {"0.0": "#FFFFFFFF", "0.25": f"#FF{col}", "1.0": f"#00{col}"},
               [f"0.4 + 2.6 * {edad}", f"0.4 + 2.6 * {edad}"], facing="emitter_transform_xz")
        # Brillo del haz (cinta que siempre mira a la cámara, a lo largo del haz).
        efecto(f"laser_halo_{c}", "haz", {**inst(1), **unavez(0.0), **hacia, **vida(0.2), **vel(0.04), **mov()},
               {"0.0": f"#00{col}", "0.15": f"#CC{col}", "1.0": f"#00{col}"}, ["variable.largo * 0.5", "variable.ancho"],
               facing="lookat_direction")
        # Carga: motas que se juntan en la espada antes de disparar.
        efecto(f"laser_carga_{c}", "mota", {**inst(10), **unavez(),
                                           "minecraft:emitter_shape_sphere": {"radius": 1.4, "direction": "inwards"},
                                           **vida(0.32), **vel(4.2), **mov()},
               {"0.0": f"#00{col}", "0.5": f"#FF{col}", "1.0": "#FFFFFFFF"}, [0.08, 0.08])
    # Avisos "!" (no son entidades: no se pueden golpear). El "!" es opaco con borde oscuro (se
    # lee bien de día) y tiene un halo que brilla detrás.
    tintes = {"amarillo": "#FFFFD23A", "azul": "#FF5CC0FF", "morado": "#FFC872FF", "oro": "#FFFFE9A0"}
    for c, tinte in tintes.items():
        latido = "(1 + math.sin(variable.particle_age * 1500) * 0.07)"
        efecto(f"aviso_excl_{c}", "excl", {**inst(1), **unavez(), **punto, **vida(0.22), **vel(0), **mov()},
               tinte, [f"0.24 * {latido}", f"0.48 * {latido}"], material="particles_alpha")
        efecto(f"aviso_excl_halo_{c}", "excl_halo", {**inst(1), **unavez(), **punto, **vida(0.22), **vel(0), **mov()},
               "#AA" + tinte[3:], [0.34, 0.66])
    # Cuerda amarilla sólida (no brilla): una cinta entre dos puntos, renovada cada tick, y nudos.
    efecto("cuerda_v9", "cuerda", {**inst(1), **unavez(0.0), **hacia, **vida(0.11), **vel(0.02), **mov()},
           "#FFFFFFFF", ["variable.largo * 0.5", 0.07], material="particles_alpha", facing="lookat_direction")
    efecto("cuerda_nudo", "nudo", {**inst(1), **unavez(0.0), **punto, **vida(0.11), **vel(0), **mov()},
           "#FFFFFFFF", [0.075, 0.075], material="particles_alpha")
    # Inundación de energía del parkour: haces rectos que suben desde la superficie.
    efecto("inundacion_haces", "haz", {
        "minecraft:emitter_rate_steady": {"spawn_rate": 34, "max_particles": 60},
        "minecraft:emitter_lifetime_looping": {"active_time": 1},
        "minecraft:emitter_shape_disc": {"radius": 5.2, "plane_normal": [0, 1, 0], "direction": [0, 1, 0]},
        **vida(0.32), **vel(7), **mov(linear_drag_coefficient=1.5)},
        {"0.0": "#00F0D8FF", "0.15": "#FFE6BEFF", "0.6": "#CCB45AFF", "1.0": "#00B45AFF"}, [0.55, 0.035],
        facing="lookat_direction")


# =============================================================================
# Inundación de energía del parkour (sin rayos en zigzag)
# =============================================================================

def inundacion_textura():
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    px = img.load()
    # Superficie (filas 0-15): morado translúcido con líneas de energía rectas.
    for y in range(16):
        for x in range(32):
            linea = (x % 8 == 0) or (y % 8 == 4)
            c = (226, 170, 255) if linea else mezcla((92, 22, 170), (150, 60, 230), 0.5 + 0.5 * math.sin(x * 0.8 + y * 0.4))
            px[x, y] = c + (200 if linea else 150,)
    # Haces rectos (filas 16-19): casi blancos, emisivos.
    for y, k in enumerate((0.5, 1.0, 1.0, 0.5)):
        for x in range(32):
            px[x, 16 + y] = mezcla((206, 132, 255), (255, 255, 255), k) + (60,)
    return img


def inundacion_geo():
    rnd = random.Random(11)
    # Superficie: dos placas cuadradas (0° y 45°) que forman una estrella de ocho puntas, como un
    # sello de energía; las puntas llegan a 5,9 bloques (la pared de la torre está a 6).
    placas = [{"origin": r3([-67.2, -1.2, -67.2]), "size": [134.4, 1.2, 134.4], "pivot": [0, 0, 0], "rotation": [0, a, 0],
               "uv": {f: {"uv": [0, 0], "uv_size": [32, 16]} for f in ("up", "down")}} for a in (0, 45)]
    huesos = [{"name": "inundacion", "pivot": [0, 0, 0]},
              {"name": "superficie", "parent": "inundacion", "pivot": [0, 0, 0], "cubes": placas}]
    uv_haz = {f: {"uv": [0, 16], "uv_size": [32, 4]} for f in ("north", "south", "east", "west")}
    for i in range(16):
        a = rnd.uniform(0, math.tau)
        r = rnd.uniform(1.8, 5.2) * 16
        x, z = math.cos(a) * r, math.sin(a) * r
        alto = rnd.uniform(14, 40)
        huesos.append({"name": f"haz_{i}", "parent": "inundacion", "pivot": r3([x, 0, z]),
                       "cubes": [{"origin": r3([x - 0.6, 0, z - 0.6]), "size": r3([1.2, alto, 1.2]), "uv": uv_haz}]})
    return geo("geometry.claudenpc.inundacion", huesos, 32, 32, bounds=(16, 6, 1))


def inundacion():
    write_json(RP / "models/entity/inundacion.geo.json", inundacion_geo())
    inundacion_textura().save(TEX / "inundacion.png")
    rnd = random.Random(5)
    bones = {"superficie": {"position": [0, "math.sin(query.life_time * 300) * 0.3", 0]}}
    for i in range(16):
        f = round(rnd.uniform(3, 7), 2)
        fase = round(rnd.uniform(0, 1), 2)
        # Cada haz sale, brilla y se apaga (crece y se encoge en línea recta, sin zigzag).
        bones[f"haz_{i}"] = {"scale": [1, f"math.max(0, math.sin((math.mod(query.life_time * {f} + {fase}, 1.0)) * 180))", 1]}
    write_json(RP / "animations/inundacion_v9.animation.json", {"format_version": "1.8.0", "animations": {
        "animation.claudenpc.inundacion.energia": {"loop": True, "bones": bones}}})
    write_json(RP / "animation_controllers/inundacion_v9.animation_controllers.json", {"format_version": "1.10.0", "animation_controllers": {
        "controller.animation.claudenpc.inundacion.haces": {"initial_state": "viva", "states": {"viva": {
            "particle_effects": [{"effect": "haces"}]}}}}})
    cliente("claudenpc:inundacion", "inundacion", {"default": "entity_emissive_alpha", "agua": "entity_alphablend"},
            {"default": "textures/entity/claudenpc/inundacion"}, {"default": "geometry.claudenpc.inundacion"},
            {"energia": "animation.claudenpc.inundacion.energia", "ctrl_haces": "controller.animation.claudenpc.inundacion.haces"},
            ["energia", "ctrl_haces"], ["controller.render.claudenpc_inundacion"],
            {"particle_effects": {"haces": "claudenpc:inundacion_haces"}})


# =============================================================================
# Marionetas propias: ojos amarillos y corazón enredado dentro de su modelo
# =============================================================================
# Cada marioneta se dibuja con el modelo y la textura de Minecraft (zombi, husk, ahogado, aldeano
# zombi, esqueleto, stray, bogged, aldeano) y una SEGUNDA geometría propia con los mismos huesos
# (waist, body, head): los ojos van en "head" y el corazón en "body". El juego anima las dos con
# las mismas animaciones, así que los ojos nunca se despegan ni parpadean (como la capa del creeper
# cargado o la ropa del stray). Todos tienen los ojos en la fila 27-28 px, a 1-3 px del centro.

OJOS_TEX = {"ojo": (0, 0), "brillo": (1, 0), "corazon": (2, 0), "sombra": (3, 0), "hilo": (4, 0), "hilo_osc": (5, 0)}


def uv1(region, caras=("north", "south", "east", "west", "up", "down")):
    u, v = OJOS_TEX[region]
    return {f: {"uv": [u, v], "uv_size": [1, 1]} for f in caras}


def cubo(o, t, region, **kw):
    c = {"origin": r3(o), "size": r3(t), "uv": uv1(region)}
    c.update(kw)
    return c


def ojos_y_corazon(frente_cara=-4.0, frente_pecho=-2.0, cx=1.3, cy=19.6):
    ojos = []
    for x0 in (-3, 1):
        ojos.append(cubo([x0, 27, frente_cara - 0.2], [2, 1, 0.2], "ojo"))
        gx = x0 + (0.25 if x0 < 0 else 1.25)
        ojos.append(cubo([gx, 27.5, frente_cara - 0.27], [0.5, 0.5, 0.08], "brillo"))
    z0 = frente_pecho - 0.7
    corazon = [cubo([cx - 1.5, cy + 0.5, z0], [1, 1, 0.7], "corazon"), cubo([cx + 0.5, cy + 0.5, z0], [1, 1, 0.7], "corazon"),
               cubo([cx - 1.5, cy - 0.5, z0], [3, 1, 0.7], "corazon"), cubo([cx - 0.5, cy - 1.5, z0], [1, 1, 0.7], "sombra")]
    zh = frente_pecho - 0.9
    for ang in (38, -38):
        corazon.append(cubo([cx - 2.1, cy - 0.17, zh], [4.2, 0.34, 0.2], "hilo", pivot=r3([cx, cy, zh]), rotation=[0, 0, ang]))
    corazon.append(cubo([cx - 1.8, cy - 0.15, zh - 0.05], [3.6, 0.3, 0.22], "hilo_osc"))
    return ojos, corazon


def ojos_geo(ident, con_cintura, frente_pecho):
    ojos, corazon = ojos_y_corazon(frente_pecho=frente_pecho)
    if con_cintura:
        huesos = [{"name": "waist", "pivot": [0, 12, 0]},
                  {"name": "body", "parent": "waist", "pivot": [0, 24, 0], "cubes": corazon},
                  {"name": "head", "parent": "body", "pivot": [0, 24, 0], "cubes": ojos}]
    else:
        huesos = [{"name": "body", "pivot": [0, 0, 0], "cubes": corazon},
                  {"name": "head", "parent": "body", "pivot": [0, 24, 0], "cubes": ojos}]
    return geo(ident, huesos, 16, 8, bounds=(2, 3, 1))


def ojos_textura():
    img = Image.new("RGBA", (16, 8), (0, 0, 0, 0))
    px = img.load()
    px[0, 0] = (255, 222, 46, 60)     # ojo (brilla)
    px[1, 0] = (255, 255, 236, 60)    # destello del ojo
    px[2, 0] = (252, 248, 240, 90)    # corazón
    px[3, 0] = (214, 204, 196, 110)   # sombra del corazón
    px[4, 0] = (255, 208, 44, 70)     # hilo
    px[5, 0] = (200, 140, 22, 110)    # hilo oscuro
    return img


# Marionetas: identificador, aspectos (geometría, textura, ropa) y si dispara.
ZOMBIS = [("geometry.zombie.v1.8", "textures/entity/zombie/zombie"),
          ("geometry.zombie.husk.v1.8", "textures/entity/zombie/husk"),
          ("geometry.zombie.drowned.v1.16", "textures/entity/zombie/drowned"),
          ("geometry.zombie.villager_v2", "textures/entity/zombie_villager2/zombie-villager")]
ESQUELETOS = [("geometry.skeleton.v1.8", "textures/entity/skeleton/skeleton"),
              ("geometry.skeleton.stray.v1.8", "textures/entity/skeleton/stray"),
              ("geometry.skeleton.bogged", "textures/entity/skeleton/bogged")]
ROPA = [("geometry.stray.armor.v1.8", "textures/entity/skeleton/stray_overlay"),
        ("geometry.bogged.armor", "textures/entity/skeleton/bogged_clothes")]


def marioneta_bp(ident, familias, aspectos, extra, ataque):
    grupos, eventos = {}, {}
    for i in range(aspectos):
        g, e = grupo_evento(f"aspecto_{i}", {"minecraft:variant": {"value": i}})
        grupos.update(g)
        eventos.update(e)
    eventos["claudenpc:golpe_fatal"] = {}
    jugador = {"test": "is_family", "subject": "other", "value": "player"}
    comps = {
        "minecraft:type_family": {"family": ["claudenpc_marioneta"] + familias + ["monster", "mob"]},
        "minecraft:collision_box": {"width": 0.6, "height": 1.9},
        "minecraft:health": {"value": 24, "max": 24},
        "minecraft:movement": {"value": 0.27},
        "minecraft:navigation.walk": {"can_path_over_water": True, "avoid_water": True, "avoid_damage_blocks": True,
                                      "can_walk": True, "can_open_doors": False},
        "minecraft:movement.basic": {},
        "minecraft:jump.static": {},
        "minecraft:can_climb": {},
        "minecraft:physics": {},
        "minecraft:pushable": {"is_pushable": True, "is_pushable_by_piston": True},
        "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0, "breathes_water": True},
        "minecraft:fire_immune": True,
        "minecraft:nameable": {},
        "minecraft:follow_range": {"value": 48, "max": 48},
        # Entre marionetas no se hacen daño (ni le hacen daño a Golden) y no mueren de un golpe:
        # se deshacen en polvo dorado (el script), sin soltar nada.
        "minecraft:damage_sensor": {"triggers": [
            trig(filtros={"any_of": [de("claudenpc_marioneta"), de("claudenpc_golden"),
                                     f_tag("claudenpc_marioneta", "other"), f_tag("claudenpc_marioneta", "damager")]}),
            FATAL]},
        "minecraft:behavior.float": {"priority": 0},
        "minecraft:behavior.nearest_attackable_target": {"priority": 1, "must_see": False, "reselect_targets": True,
                                                         "within_radius": 48.0, "entity_types": [{"filters": jugador, "max_dist": 48}]},
        "minecraft:behavior.hurt_by_target": {"priority": 1, "entity_types": [{"filters": jugador, "max_dist": 48}]},
        **ataque,
        "minecraft:behavior.random_stroll": {"priority": 6, "speed_multiplier": 0.8},
        "minecraft:behavior.look_at_player": {"priority": 7, "look_distance": 8},
        "minecraft:behavior.random_look_around": {"priority": 8},
        **extra,
    }
    write_json(BP / f"entities/{ident.split(':')[1]}.entity.json", {"format_version": "1.21.0", "minecraft:entity": {
        "description": {"identifier": ident, "is_spawnable": False, "is_summonable": True},
        "component_groups": grupos, "components": comps, "events": eventos}})


PRE_HUMANOIDE = ["variable.gliding_speed_value = 1.0;",
                 "variable.tcos0 = (Math.cos(query.modified_distance_moved * 38.17) * query.modified_move_speed / variable.gliding_speed_value) * 57.3;"]


def marionetas():
    write_json(RP / "models/entity/ojos_marioneta_v9.geo.json", {"format_version": "1.16.0", "minecraft:geometry": [
        ojos_geo("geometry.claudenpc.ojos_humanoide", True, -2.0)["minecraft:geometry"][0],
        ojos_geo("geometry.claudenpc.ojos_aldeano_zombi", True, -3.0)["minecraft:geometry"][0],
        ojos_geo("geometry.claudenpc.ojos_aldeano", False, -3.0)["minecraft:geometry"][0]]})
    ojos_textura().save(TEX / "ojos_marioneta_v9.png")
    # Animación propia: tironcitos de marioneta (cabeza que se ladea, brazos que se sacuden).
    write_json(RP / "animations/marionetas_v9.animation.json", {"format_version": "1.8.0", "animations": {
        "animation.claudenpc.marioneta_v9.tirones": {"loop": True, "bones": {
            "head": {"rotation": [0, 0, "math.sin(query.life_time * 140) * 7 + (math.mod(query.life_time, 1.7) < 0.12 ? 9 : 0)"]},
            "rightArm": {"rotation": ["math.sin(query.life_time * 210) * 6", 0, "math.cos(query.life_time * 160) * 4"]},
            "leftArm": {"rotation": ["-math.sin(query.life_time * 190) * 6", 0, "-math.cos(query.life_time * 170) * 4"]}}},
    }})
    ojos_ctrl = {"geometry": "Array.ojos[query.variant]", "materials": [{"*": "Material.ojos"}], "textures": ["Texture.ojos"]}
    controladores = {
        "controller.render.claudenpc_marioneta_zombi": {
            "arrays": {"geometries": {"Array.geos": [f"Geometry.aspecto_{i}" for i in range(len(ZOMBIS))]},
                       "textures": {"Array.pieles": [f"Texture.aspecto_{i}" for i in range(len(ZOMBIS))]}},
            "geometry": "Array.geos[query.variant]", "materials": [{"*": "Material.default"}], "textures": ["Array.pieles[query.variant]"]},
        "controller.render.claudenpc_marioneta_zombi_ojos": {
            "arrays": {"geometries": {"Array.ojos": ["Geometry.ojos", "Geometry.ojos", "Geometry.ojos", "Geometry.ojos_az"]}},
            **ojos_ctrl},
        "controller.render.claudenpc_marioneta_esqueleto": {
            "arrays": {"geometries": {"Array.geos": [f"Geometry.aspecto_{i}" for i in range(len(ESQUELETOS))]},
                       "textures": {"Array.pieles": [f"Texture.aspecto_{i}" for i in range(len(ESQUELETOS))]}},
            "geometry": "Array.geos[query.variant]", "materials": [{"*": "Material.default"}], "textures": ["Array.pieles[query.variant]"]},
        "controller.render.claudenpc_marioneta_esqueleto_ropa": {
            "arrays": {"geometries": {"Array.ropas": ["Geometry.ropa_0", "Geometry.ropa_0", "Geometry.ropa_1"]},
                       "textures": {"Array.telas": ["Texture.ropa_0", "Texture.ropa_0", "Texture.ropa_1"]}},
            "geometry": "Array.ropas[query.variant]", "materials": [{"*": "Material.ropa"}], "textures": ["Array.telas[query.variant]"]},
        "controller.render.claudenpc_marioneta_esqueleto_ojos": {
            "arrays": {"geometries": {"Array.ojos": ["Geometry.ojos", "Geometry.ojos", "Geometry.ojos"]}}, **ojos_ctrl},
        "controller.render.claudenpc_aldeano_ojos": {
            "arrays": {"geometries": {"Array.ojos": ["Geometry.ojos"]}},
            "geometry": "Geometry.ojos", "materials": [{"*": "Material.ojos"}], "textures": ["Texture.ojos"]},
    }
    write_json(RP / "render_controllers/marionetas_v9.render_controllers.json", {"format_version": "1.8.0", "render_controllers": controladores})
    tex_ojos = "textures/entity/claudenpc/ojos_marioneta_v9"
    anims_base = {"mirar": "animation.common.look_at_target", "mover": "animation.humanoid.move",
                  "tirones": "animation.claudenpc.marioneta_v9.tirones"}
    cliente("claudenpc:marioneta_zombi", "marioneta_zombi",
            {"default": "zombie", "ojos": "entity_emissive_alpha"},
            {**{f"aspecto_{i}": t for i, (_, t) in enumerate(ZOMBIS)}, "ojos": tex_ojos},
            {**{f"aspecto_{i}": g for i, (g, _) in enumerate(ZOMBIS)}, "ojos": "geometry.claudenpc.ojos_humanoide",
             "ojos_az": "geometry.claudenpc.ojos_aldeano_zombi"},
            {**anims_base, "brazos": "animation.zombie.attack_bare_hand", "golpe": "animation.humanoid.attack.rotations"},
            ["mirar", "mover", "brazos", {"golpe": "variable.attack_time > 0"}, "tirones"],
            ["controller.render.claudenpc_marioneta_zombi", "controller.render.claudenpc_marioneta_zombi_ojos"],
            {"enable_attachables": True})
    ent = json.loads((RP / "entity/marioneta_zombi.entity.json").read_text(encoding="utf-8"))
    ent["minecraft:client_entity"]["description"]["scripts"]["pre_animation"] = PRE_HUMANOIDE
    write_json(RP / "entity/marioneta_zombi.entity.json", ent)
    cliente("claudenpc:marioneta_esqueleto", "marioneta_esqueleto",
            {"default": "skeleton", "ropa": "stray_clothes", "ojos": "entity_emissive_alpha"},
            {**{f"aspecto_{i}": t for i, (_, t) in enumerate(ESQUELETOS)}, "ropa_0": ROPA[0][1], "ropa_1": ROPA[1][1], "ojos": tex_ojos},
            {**{f"aspecto_{i}": g for i, (g, _) in enumerate(ESQUELETOS)}, "ropa_0": ROPA[0][0], "ropa_1": ROPA[1][0],
             "ojos": "geometry.claudenpc.ojos_humanoide"},
            {**anims_base, "arco": "animation.humanoid.bow_and_arrow", "golpe": "animation.humanoid.attack.rotations"},
            ["mirar", "mover", {"arco": "query.has_target"}, {"golpe": "variable.attack_time > 0"}, "tirones"],
            ["controller.render.claudenpc_marioneta_esqueleto", {"controller.render.claudenpc_marioneta_esqueleto_ropa": "query.variant > 0"},
             "controller.render.claudenpc_marioneta_esqueleto_ojos"],
            {"enable_attachables": True})
    ent = json.loads((RP / "entity/marioneta_esqueleto.entity.json").read_text(encoding="utf-8"))
    ent["minecraft:client_entity"]["description"]["scripts"]["pre_animation"] = PRE_HUMANOIDE
    write_json(RP / "entity/marioneta_esqueleto.entity.json", ent)
    # Aldeano marioneta (v8.2): ahora con los ojos y el corazón en su modelo.
    ruta = RP / "entity/aldeano_marioneta.entity.json"
    ent = json.loads(ruta.read_text(encoding="utf-8"))
    d = ent["minecraft:client_entity"]["description"]
    d["materials"]["ojos"] = "entity_emissive_alpha"
    d["textures"]["ojos"] = tex_ojos
    d["geometry"]["ojos"] = "geometry.claudenpc.ojos_aldeano"
    if "controller.render.claudenpc_aldeano_ojos" not in d["render_controllers"]:
        d["render_controllers"].append("controller.render.claudenpc_aldeano_ojos")
    write_json(ruta, ent)
    # Comportamiento.
    melee = {"minecraft:attack": {"damage": 4},
             "minecraft:behavior.melee_box_attack": {"priority": 2, "speed_multiplier": 1.2, "track_target": True}}
    marioneta_bp("claudenpc:marioneta_zombi", ["zombie", "undead"], len(ZOMBIS), {}, melee)
    marioneta_bp("claudenpc:marioneta_esqueleto", ["skeleton", "undead"], len(ESQUELETOS), {
        "minecraft:shooter": {"def": "minecraft:arrow"},
        "minecraft:equipment": {"table": "loot_tables/entities/skeleton_gear.json"}}, {
        "minecraft:behavior.ranged_attack": {"priority": 2, "attack_interval_min": 1.0, "attack_interval_max": 2.2,
                                             "attack_radius": 16.0}})
    # El aldeano marioneta (v8.2) con la misma familia y los mismos sensores.
    ruta = BP / "entities/aldeano_marioneta.entity.json"
    ent = json.loads(ruta.read_text(encoding="utf-8"))
    e = ent["minecraft:entity"]
    e["components"]["minecraft:type_family"] = {"family": ["claudenpc_marioneta", "claudenpc_aldeano_marioneta", "mob"]}
    e["components"]["minecraft:damage_sensor"] = {"triggers": [
        trig(filtros={"any_of": [de("claudenpc_marioneta"), de("claudenpc_golden"),
                                 f_tag("claudenpc_marioneta", "other"), f_tag("claudenpc_marioneta", "damager")]}),
        FATAL]}
    e["components"]["minecraft:fire_immune"] = True
    e["components"].pop("minecraft:persistent", None)
    e["events"]["claudenpc:golpe_fatal"] = {}
    write_json(ruta, ent)


# =============================================================================
# Robot multi más prolijo (mismos huesos y pivotes: sus animaciones no cambian)
# =============================================================================

def multi_geometry_v9():
    """Robot multi rediseñado: casco redondeado con visor cian que envuelve los costados, ceja
    naranja, orejas con antena; pecho con placa naranja, núcleo con el emblema que brilla y marco
    oscuro, cuello y cinturón articulados, mochila con dos propulsores y toberas; hombreras
    naranjas, codos y antebrazos con protección; rodilleras, espinilleras y botas con franja de
    peligro. Usa la textura del robot de los Claudes (mismas regiones)."""
    cubo, espejo_x, bone = ba.cubo, ba.espejo_x, ba.bone
    bones = [bone("root", [0, 0, 0])]
    for lado, sx in (("der", -1), ("izq", 1)):
        def c(cb):
            return cb if sx < 0 else espejo_x(cb)
        bones.append(bone(f"pierna_{lado}", [3 * sx, 12, 0], "root", [
            c(cubo([-4.5, 10.5, -2], [3, 1.5, 4], resto="junta")),
            c(cubo([-5, 6.5, -2.25], [4, 4, 4.5], north="metal", resto="metal_osc")),
            c(cubo([-5.25, 5.25, -3], [4.5, 2.5, 1], resto="naranja")),
            c(cubo([-5.25, 2.5, -2.5], [4.5, 4, 5], north="metal", resto="metal_osc")),
            c(cubo([-5.75, 0, -3.75], [5.5, 2.5, 7], up="peligro", resto="metal_osc")),
            c(cubo([-5.5, 0, -4.4], [5, 1.4, 0.7], resto="naranja"))]))
    torso = bone("torso", [0, 12, 0], "root", [
        cubo([-5, 12, -3], [10, 2, 6], resto="junta"),
        cubo([-4.5, 14, -3.25], [9, 3, 6.5], north="rejilla", resto="metal_osc"),
        cubo([-6, 17, -4], [12, 8, 8], north="naranja", resto="metal"),
        cubo([-3.6, 17.8, -4.5], [7.2, 6.2, 0.5], resto="metal_osc"),
        cubo([-3, 18.3, -4.95], [6, 5.2, 0.5], resto="emblema"),
        cubo([-5, 24.2, -4.35], [10, 0.6, 0.4], resto="cian"),
        cubo([-4, 25, -3], [8, 1, 6], resto="junta"),
        cubo([-5, 15, 4], [10, 9, 3.2], north="rejilla", resto="metal_osc"),
        cubo([-4.75, 13, 6.6], [3.5, 8, 2.6], north="tubo", south="tubo", resto="metal"),
        cubo([1.25, 13, 6.6], [3.5, 8, 2.6], north="tubo", south="tubo", resto="metal"),
        cubo([-4.5, 11.6, 6.85], [3, 1.4, 2.1], down="canon", resto="metal_osc"),
        cubo([1.5, 11.6, 6.85], [3, 1.4, 2.1], down="canon", resto="metal_osc"),
        cubo([-4.6, 12.9, 6.75], [3.2, 0.5, 2.3], resto="cian"),
        cubo([1.4, 12.9, 6.75], [3.2, 0.5, 2.3], resto="cian")])
    torso["locators"] = {"jet_der": [-3, 11.4, 7.9], "jet_izq": [3, 11.4, 7.9]}
    bones.append(torso)
    bones.append(bone("bateria", [0, 23, 6], "torso", [
        cubo([-2, 24, 4.6], [4, 5, 3], north="bat_frente", south="bat_frente", up="bat_tapa", resto="bat_cuerpo"),
        cubo([-0.75, 29, 5.35], [1.5, 0.8, 1.5], resto="bat_tapa")]))
    cabeza = bone("cabeza", [0, 25, 0], "torso", [
        cubo([-2, 25.5, -2], [4, 1.5, 4], resto="junta"),
        cubo([-4.5, 27, -4.5], [9, 7, 9], north="metal", resto="metal"),
        cubo([-3.5, 34, -3.5], [7, 1, 7], resto="metal_osc"),
        cubo([-4.75, 32, -4.9], [9.5, 1.1, 0.5], resto="naranja"),
        cubo([-3.75, 29, -4.95], [7.5, 2.5, 0.5], resto="cian"),
        cubo([-4.95, 29, -4], [0.5, 2.5, 3], resto="cian"),
        espejo_x(cubo([-4.95, 29, -4], [0.5, 2.5, 3], resto="cian")),
        cubo([-2.5, 27.4, -4.85], [5, 1, 0.4], resto="rejilla"),
        cubo([-5.5, 28.5, -1.5], [1, 3, 3], resto="junta"),
        espejo_x(cubo([-5.5, 28.5, -1.5], [1, 3, 3], resto="junta")),
        cubo([-5.25, 31.5, -0.25], [0.5, 4, 0.5], resto="metal_osc"),
        cubo([-5.5, 35.5, -0.5], [1, 1, 1], resto="rojo"),
        cubo([-0.5, 35, -0.5], [1, 2.5, 1], resto="metal_osc"),
        cubo([-1, 37.5, -1], [2, 2, 2], resto="rojo")])
    cabeza["locators"] = {"visor": [0, 30.25, -5.3]}
    bones.append(cabeza)
    for lado, sx, herramienta in (("der", -1, "taladro"), ("izq", 1, "pinza")):
        def c(cb):
            return cb if sx < 0 else espejo_x(cb)
        bones.append(bone(f"brazo_{lado}", [7 * sx, 23, 0], "torso", [
            c(cubo([-10.5, 21, -3], [5, 4, 6], up="naranja", north="naranja", south="naranja", resto="metal")),
            c(cubo([-10.75, 20.4, -3.25], [5.5, 0.7, 6.5], resto="junta")),
            c(cubo([-9.25, 17.8, -1.5], [3, 2.8, 3], resto="metal_osc")),
            c(cubo([-9.5, 16.4, -1.75], [3.5, 1.4, 3.5], resto="junta")),
            c(cubo([-9.75, 13, -2], [4, 3.4, 4], north="naranja", resto="metal"))]))
    bones.append(bone("taladro", [-7.75, 13, 0], "brazo_der", [
        cubo([-9.25, 10.5, -1.5], [3, 2.5, 3], resto="metal_osc"),
        cubo([-8.75, 8, -1], [2, 2.5, 2], resto="metal"),
        cubo([-8.5, 5.5, -0.75], [1.5, 2.5, 1.5], resto="metal"),
        cubo([-8.25, 3.5, -0.5], [1, 2, 1], resto="canon")]))
    bones.append(bone("pinza", [7.75, 13, 0], "brazo_izq", [
        cubo([6.5, 10.5, -1.75], [2.5, 2.5, 3.5], resto="metal_osc"),
        cubo([6.75, 7, -1.75], [0.8, 3.5, 1], resto="metal"),
        cubo([6.75, 6.4, -2.35], [0.8, 0.9, 1.3], resto="naranja"),
        cubo([6.75, 7, 0.75], [0.8, 3.5, 1], resto="metal"),
        cubo([6.75, 6.4, 1.05], [0.8, 0.9, 1.3], resto="naranja")]))
    return {"format_version": "1.16.0", "minecraft:geometry": [{
        "description": {"identifier": "geometry.claudenpc.robot_multi", "texture_width": 128, "texture_height": 128,
                        "visible_bounds_width": 2.5, "visible_bounds_height": 3.5, "visible_bounds_offset": [0, 1.5, 0]},
        "bones": bones}]}


def robot_multi():
    write_json(RP / "models/entity/robot_multi.geo.json", multi_geometry_v9())


# =============================================================================
# Sonidos de los láseres (sintetizados aquí: originales)
# =============================================================================

def _ogg(nombre, muestras, sr=22050):
    carpeta = RP / "sounds/claudenpc/golden"
    carpeta.mkdir(parents=True, exist_ok=True)
    tmp = carpeta / f"{nombre}.wav"
    with wave.open(str(tmp), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        pico = max(1e-6, max(abs(x) for x in muestras))
        w.writeframes(b"".join(int(max(-1, min(1, x / pico * 0.92)) * 32767).to_bytes(2, "little", signed=True) for x in muestras))
    destino = carpeta / f"{nombre}.ogg"
    try:
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(tmp), "-c:a", "libvorbis", "-q:a", "4",
                        "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact", str(destino)], check=True)
    finally:
        tmp.unlink(missing_ok=True)


def sonidos_laser():
    sr = 22050
    rnd = random.Random(42)
    # Disparo: subida brillante muy corta y un "zap" que baja, con zumbido de energía.
    n = int(sr * 0.55)
    disparo = []
    fase1 = fase2 = 0.0
    for i in range(n):
        t = i / sr
        f1 = 2400 * math.exp(-t * 7) + 180
        f2 = 90 + 40 * math.sin(t * 60)
        fase1 += 2 * math.pi * f1 / sr
        fase2 += 2 * math.pi * f2 / sr
        env = min(1.0, t / 0.006) * math.exp(-t * 5.5)
        ruido = (rnd.random() * 2 - 1) * math.exp(-t * 30) * 0.5
        disparo.append(env * (math.sin(fase1) * 0.6 + math.copysign(1, math.sin(fase2)) * 0.25 + ruido))
    _ogg("laser_disparo", disparo, sr)
    # Carga: zumbido que sube (aviso de que va a disparar).
    n = int(sr * 0.7)
    carga = []
    fase = 0.0
    for i in range(n):
        t = i / sr
        f = 220 + 900 * (t / 0.7) ** 2
        fase += 2 * math.pi * f / sr
        env = min(1.0, t / 0.05) * (0.4 + 0.6 * t / 0.7)
        carga.append(env * (math.sin(fase) * 0.7 + math.sin(fase * 2.01) * 0.25 + math.sin(fase * 0.5) * 0.2))
    _ogg("laser_carga", carga, sr)
    defs_ruta = RP / "sounds/sound_definitions.json"
    defs = json.loads(defs_ruta.read_text(encoding="utf-8"))
    for nombre, vol in (("laser_disparo", 1.0), ("laser_carga", 0.8)):
        defs["sound_definitions"][f"claudenpc.golden.{nombre}"] = {
            "category": "hostile", "max_distance": 64.0,
            "sounds": [{"name": f"sounds/claudenpc/golden/{nombre}", "volume": vol, "load_on_low_memory": True}]}
    write_json(defs_ruta, defs)


# =============================================================================
# Limpieza: lo que la v9.0 reemplazó (rayos, signos de pregunta, cuerda entidad, casco de ojos)
# =============================================================================

VIEJOS = [
    "BP/entities/rayo.entity.json", "BP/entities/signo.entity.json", "BP/entities/cuerda.entity.json",
    "BP/items/ojos_marioneta.json",
    "RP/entity/rayo.entity.json", "RP/entity/signo.entity.json", "RP/entity/cuerda.entity.json",
    "RP/attachables/ojos_marioneta.json",
    "RP/models/entity/rayo.geo.json", "RP/models/entity/signo.geo.json", "RP/models/entity/cuerda.geo.json",
    "RP/models/entity/ojos_marioneta.geo.json",
    "RP/textures/entity/claudenpc/rayo_amarillo.png", "RP/textures/entity/claudenpc/rayo_azul.png",
    "RP/textures/entity/claudenpc/rayo_morado.png", "RP/textures/entity/claudenpc/signo_amarillo.png",
    "RP/textures/entity/claudenpc/signo_azul.png", "RP/textures/entity/claudenpc/signo_morado.png",
    "RP/textures/entity/claudenpc/cuerda.png", "RP/textures/entity/claudenpc/ojos_marioneta.png",
    "RP/textures/items/ojos_marioneta.png",
    "RP/particles/inundacion_chispas.particle.json",
]


def limpiar():
    for r in VIEJOS:
        (ba.ROOT / r).unlink(missing_ok=True)
    # La animación de la inundación de la v8.2 (rayos en zigzag) ya no se usa.
    ruta = RP / "animations/marionetas_v82.animation.json"
    if ruta.exists():
        d = json.loads(ruta.read_text(encoding="utf-8"))
        d["animations"].pop("animation.claudenpc.inundacion.vivir", None)
        write_json(ruta, d)
    ruta = RP / "animation_controllers/marionetas_v82.animation_controllers.json"
    ruta.unlink(missing_ok=True)


def generar():
    sensores()
    lasers()
    particulas_v9()
    inundacion()
    marionetas()
    robot_multi()
    sonidos_laser()
    limpiar()
