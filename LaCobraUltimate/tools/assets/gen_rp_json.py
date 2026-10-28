"""Genera entidades de cliente, animaciones, controladores, render controllers y
attachables del Resource Pack de La Cobra."""
import json
import os
import sys

OUT = sys.argv[1] if len(sys.argv) > 1 else "out"


def w(rel, data):
    p = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def client(ident, geo, textures, anims, animate, rc, material="entity_alphatest", particles=None,
           scale=None, egg=None, extra_scripts=None):
    desc = {
        "identifier": ident,
        "materials": {"default": material},
        "textures": textures,
        "geometry": {"default": geo},
        "animations": anims,
        "scripts": {"animate": animate},
        "render_controllers": [rc],
    }
    if scale:
        desc["scripts"]["scale"] = scale
    if extra_scripts:
        desc["scripts"].update(extra_scripts)
    if particles:
        desc["particle_effects"] = particles
    if egg:
        desc["spawn_egg"] = egg
    else:
        desc["enable_attachables"] = False
    return {"format_version": "1.10.0", "minecraft:client_entity": {"description": desc}}


# ======================================================================
#  ENTIDADES DE CLIENTE
# ======================================================================
w("entity/serpiente_legendaria.entity.json", client(
    "lacobra:serpiente_legendaria", "geometry.lacobra.serpiente_legendaria",
    {"f1": "textures/entity/serpiente_legendaria_f1", "f2": "textures/entity/serpiente_legendaria_f2",
     "f3": "textures/entity/serpiente_legendaria_f3"},
    {"idle": "animation.lacobra.boss.idle", "move": "animation.lacobra.boss.move",
     "hurt": "animation.lacobra.boss.hurt", "death": "animation.lacobra.boss.death",
     "bite": "animation.lacobra.boss.bite", "special": "animation.lacobra.boss.special",
     "roar": "animation.lacobra.boss.roar", "aura": "animation.lacobra.boss.aura",
     "ctrl": "controller.animation.lacobra.boss"},
    ["idle", {"move": "query.modified_move_speed > 0.05"}, "aura", "ctrl"],
    "controller.render.lacobra.boss", material="entity_emissive_alpha",
    particles={"aura": "lacobra:boss_aura"}, scale="1.0",
    egg={"base_color": "#1A1022", "overlay_color": "#E8AA1E"}))

w("entity/serpiente_esbirro.entity.json", client(
    "lacobra:serpiente_esbirro", "geometry.lacobra.serpiente", {"default": "textures/entity/serpiente_esbirro"},
    {"slither": "animation.lacobra.serpiente.slither", "fast": "animation.lacobra.serpiente.slither_fast"},
    ["slither", {"fast": "query.modified_move_speed > 0.1"}],
    "controller.render.lacobra.default", material="entity_emissive_alpha", scale="1.8",
    egg={"base_color": "#22182C", "overlay_color": "#9A4DF0"}))

w("entity/serpiente_energia.entity.json", client(
    "lacobra:serpiente_energia", "geometry.lacobra.serpiente",
    {"veneno": "textures/entity/serpiente_veneno", "guardiana": "textures/entity/serpiente_guardiana"},
    {"slither": "animation.lacobra.serpiente.slither_fast", "appear": "animation.lacobra.fx.appear",
     "trail_v": "animation.lacobra.fx.trail_serpent", "trail_g": "animation.lacobra.fx.trail_guard",
     "vanish": "animation.lacobra.fx.vanish"},
    ["slither", "appear", {"trail_v": "query.property('lacobra:variante') == 0"},
     {"trail_g": "query.property('lacobra:variante') == 1"}],
    "controller.render.lacobra.serpiente", material="entity_emissive_alpha",
    particles={"serpent_trail": "lacobra:serpent_trail", "guard_trail": "lacobra:guard_trail"}, scale="1.3"))

for ident, tex, trail, effect in [
    ("lacobra:esfera_remate", "textures/entity/esfera_remate", "orb_trail", "lacobra:orb_trail"),
    ("lacobra:balon_proyectil", "textures/entity/balon_dorado", "ball_trail", "lacobra:ball_trail"),
    ("lacobra:escupitajo", "textures/entity/escupitajo", "venom_trail", "lacobra:venom_trail"),
]:
    name = ident.split(":")[1]
    w("entity/%s.entity.json" % name, client(
        ident, "geometry.lacobra.esfera", {"default": tex},
        {"spin": "animation.lacobra.esfera.spin", "trail": "animation.lacobra.fx.trail_" + trail.split("_")[0]},
        ["spin", "trail"], "controller.render.lacobra.default",
        material="entity_emissive_alpha", particles={trail: effect},
        scale="1.6" if name == "esfera_remate" else ("1.1" if name == "balon_proyectil" else "0.9")))

w("entity/circulo_magico.entity.json", client(
    "lacobra:circulo_magico", "geometry.lacobra.circulo", {"default": "textures/entity/circulo_magico"},
    {"spin": "animation.lacobra.circulo.spin"}, ["spin"], "controller.render.lacobra.default"))

w("entity/cobra_suprema.entity.json", client(
    "lacobra:cobra_suprema", "geometry.lacobra.cobra_suprema", {"default": "textures/entity/cobra_suprema"},
    {"coil": "animation.lacobra.suprema.coil"}, ["coil"], "controller.render.lacobra.default",
    material="entity_emissive_alpha"))

w("entity/avatar_cobra.entity.json", client(
    "lacobra:avatar_cobra", "geometry.lacobra.avatar", {"default": "textures/entity/avatar_cobra"},
    {"rise": "animation.lacobra.avatar.rise", "glow": "animation.lacobra.fx.trail_avatar"},
    ["rise", "glow"], "controller.render.lacobra.default", particles={"avatar": "lacobra:avatar_glow"},
    scale="2.4"))

# ======================================================================
#  RENDER CONTROLLERS
# ======================================================================
w("render_controllers/lacobra.render_controllers.json", {
    "format_version": "1.8.0",
    "render_controllers": {
        "controller.render.lacobra.default": {
            "geometry": "Geometry.default", "materials": [{"*": "Material.default"}],
            "textures": ["Texture.default"]},
        "controller.render.lacobra.boss": {
            "arrays": {"textures": {"Array.fases": ["Texture.f1", "Texture.f2", "Texture.f3"]}},
            "geometry": "Geometry.default", "materials": [{"*": "Material.default"}],
            "textures": ["Array.fases[math.clamp(query.property('lacobra:fase') - 1, 0, 2)]"]},
        "controller.render.lacobra.serpiente": {
            "arrays": {"textures": {"Array.variantes": ["Texture.veneno", "Texture.guardiana"]}},
            "geometry": "Geometry.default", "materials": [{"*": "Material.default"}],
            "textures": ["Array.variantes[math.clamp(query.property('lacobra:variante'), 0, 1)]"]},
    }})


# ======================================================================
#  ANIMACIONES
# ======================================================================
def sin(speed, amp, phase=0, t="query.life_time"):
    return "math.sin(%s * %s - %s) * %s" % (t, speed, phase, amp)


tails = ["tail%d" % i for i in range(6)]
boss_anims = {
    "animation.lacobra.boss.idle": {"loop": True, "bones": {
        "neck": {"rotation": [sin(70, 4), sin(45, 7), 0]},
        "head": {"rotation": [sin(90, 3, 30), sin(60, 5, 40), 0]},
        "body2": {"rotation": [0, 0, sin(40, 3)]},
        "hood": {"scale": ["1 + math.sin(query.life_time * 100) * 0.05", 1, 1]},
        "tongue": {"scale": [1, 1, "math.mod(query.life_time, 2.6) < 0.35 ? 1 : 0.05"]},
        **{t: {"rotation": [0, sin(80, 6, i * 40), 0]} for i, t in enumerate(tails)},
    }},
    "animation.lacobra.boss.move": {"loop": True, "bones": {
        **{t: {"rotation": [0, sin(420, 16, i * 55), 0]} for i, t in enumerate(tails)},
        "base": {"rotation": [0, sin(420, 5, -40), 0]},
        "body1": {"rotation": [0, 0, sin(420, 4)]},
    }},
    "animation.lacobra.boss.aura": {"loop": "hold_on_last_frame", "animation_length": 0.1,
                                    "particle_effects": {"0.0": {"effect": "aura"}}},
    "animation.lacobra.boss.hurt": {"animation_length": 0.3, "bones": {
        "body1": {"rotation": {"0.0": [0, 0, 0], "0.1": [-8, 0, 4], "0.3": [0, 0, 0]}},
        "neck": {"rotation": {"0.0": [0, 0, 0], "0.1": [-12, 0, 0], "0.3": [0, 0, 0]}},
        "jaw": {"rotation": {"0.0": [0, 0, 0], "0.1": [25, 0, 0], "0.3": [0, 0, 0]}},
    }},
    "animation.lacobra.boss.bite": {"animation_length": 0.6, "bones": {
        "neck": {"rotation": {"0.0": [0, 0, 0], "0.15": [-15, 0, 0], "0.3": [32, 0, 0], "0.6": [0, 0, 0]}},
        "head": {"rotation": {"0.0": [0, 0, 0], "0.15": [-10, 0, 0], "0.3": [15, 0, 0], "0.6": [0, 0, 0]}},
        "jaw": {"rotation": {"0.0": [0, 0, 0], "0.15": [40, 0, 0], "0.32": [0, 0, 0], "0.6": [0, 0, 0]}},
        "body2": {"rotation": {"0.0": [0, 0, 0], "0.3": [12, 0, 0], "0.6": [0, 0, 0]}},
    }},
    "animation.lacobra.boss.special": {"animation_length": 1.2, "bones": {
        "body1": {"rotation": {"0.0": [0, 0, 0], "0.4": [-14, 0, 0], "0.7": [10, 0, 0], "1.2": [0, 0, 0]}},
        "neck": {"rotation": {"0.0": [0, 0, 0], "0.4": [-20, 0, 0], "0.7": [20, 0, 0], "1.2": [0, 0, 0]}},
        "head": {"rotation": {"0.0": [0, 0, 0], "0.4": [-25, 0, 0], "0.7": [10, 0, 0], "1.2": [0, 0, 0]}},
        "jaw": {"rotation": {"0.0": [0, 0, 0], "0.3": [45, 0, 0], "0.9": [45, 0, 0], "1.2": [0, 0, 0]}},
        "hood": {"scale": {"0.0": [1, 1, 1], "0.4": [1.35, 1.15, 1], "0.9": [1.35, 1.15, 1], "1.2": [1, 1, 1]}},
    }},
    "animation.lacobra.boss.roar": {"animation_length": 2.0, "bones": {
        "body1": {"rotation": {"0.0": [0, 0, 0], "0.5": [-18, 0, 0], "1.6": [-18, 0, 0], "2.0": [0, 0, 0]}},
        "neck": {"rotation": {"0.0": [0, 0, 0], "0.5": [-15, 0, 0], "1.0": [-15, 12, 0], "1.4": [-15, -12, 0], "2.0": [0, 0, 0]}},
        "jaw": {"rotation": {"0.0": [0, 0, 0], "0.4": [50, 0, 0], "1.7": [50, 0, 0], "2.0": [0, 0, 0]}},
        "hood": {"scale": {"0.0": [1, 1, 1], "0.5": [1.5, 1.2, 1], "1.7": [1.5, 1.2, 1], "2.0": [1, 1, 1]}},
        "crown": {"scale": {"0.0": [1, 1, 1], "0.6": [1.3, 1.3, 1.3], "2.0": [1, 1, 1]}},
    }},
    "animation.lacobra.boss.death": {"animation_length": 2.0, "loop": "hold_on_last_frame", "bones": {
        "body1": {"rotation": {"0.0": [0, 0, 0], "0.6": [-20, 0, 0], "1.6": [55, 0, 25]}},
        "neck": {"rotation": {"0.0": [0, 0, 0], "1.2": [35, 0, 0]}},
        "jaw": {"rotation": {"0.0": [0, 0, 0], "0.5": [50, 0, 0], "1.6": [30, 0, 0]}},
        "hood": {"scale": {"0.0": [1, 1, 1], "1.6": [0.6, 0.8, 1]}},
        "root": {"position": {"0.0": [0, 0, 0], "1.0": [0, 0, 0], "2.0": [0, -6, 0]}},
    }},
}

segs = ["seg%d" % i for i in range(6)]
fx_anims = {
    "animation.lacobra.serpiente.slither": {"loop": True, "bones": {
        **{s: {"rotation": [0, sin(300, 18, i * 55), 0]} for i, s in enumerate(segs)},
        "head": {"rotation": [sin(200, 4), sin(300, 8, -50), 0]}}},
    "animation.lacobra.serpiente.slither_fast": {"loop": True, "bones": {
        **{s: {"rotation": [0, sin(720, 24, i * 60), 0]} for i, s in enumerate(segs)},
        "head": {"rotation": [0, sin(720, 10, -60), 0]}}},
    "animation.lacobra.esfera.spin": {"loop": True, "bones": {
        "ball": {"rotation": ["query.life_time * 720", "query.life_time * 300", 0]}}},
    "animation.lacobra.fx.appear": {"animation_length": 0.3, "loop": "hold_on_last_frame", "bones": {
        "root": {"scale": {"0.0": [0.05, 0.05, 0.05], "0.3": [1, 1, 1]}}}},
    "animation.lacobra.fx.vanish": {"animation_length": 0.5, "loop": "hold_on_last_frame", "bones": {
        "root": {"scale": {"0.0": [1, 1, 1], "0.5": [0.01, 0.01, 0.01]}}}},
    "animation.lacobra.circulo.spin": {"loop": True, "bones": {
        "inner": {"rotation": [0, "query.life_time * 55", 0]},
        "outer": {"rotation": [0, "-query.life_time * 35", 0]},
        "root": {"scale": "math.min(query.life_time * 2.5, 1) * (query.property('lacobra:tam') == 2 ? 1.9 : 1.0)"}}},
    "animation.lacobra.circulo.vanish": {"animation_length": 0.5, "loop": "hold_on_last_frame", "bones": {
        "inner": {"rotation": [0, "query.anim_time * 400", 0]},
        "root": {"scale": {"0.0": [1, 1, 1], "0.5": [0.01, 1, 0.01]}}}},
    "animation.lacobra.suprema.coil": {"loop": True, "bones": {
        "coil": {"rotation": [0, "query.life_time * 120", 0]},
        "root": {"scale": "math.min(0.2 + query.life_time * 0.8, 1) * (1 + math.sin(query.life_time * 500) * 0.03)",
                 "position": [0, "math.max(0, 1 - query.life_time) * -20", 0]},
        "head": {"rotation": [sin(240, 6), 0, 0]}}},
    "animation.lacobra.suprema.vanish": {"animation_length": 1.0, "loop": "hold_on_last_frame", "bones": {
        "root": {"scale": {"0.0": [1, 1, 1], "1.0": [0.01, 2.0, 0.01]},
                 "position": {"0.0": [0, 0, 0], "1.0": [0, 20, 0]}},
        "coil": {"rotation": [0, "query.anim_time * 720", 0]}}},
    "animation.lacobra.avatar.rise": {"animation_length": 4.5, "loop": "hold_on_last_frame", "bones": {
        "root": {"position": {"0.0": [0, -32, 0], "1.0": [0, 0, 0]},
                 "scale": {"0.0": [0.4, 0.4, 0.4], "1.0": [1, 1, 1]}},
        "rightArm": {"rotation": {"0.0": [0, 0, 0], "1.2": [-170, 0, -15], "3.0": [-170, 0, -15], "3.4": [-60, 0, -40], "4.5": [-60, 0, -40]}},
        "leftArm": {"rotation": {"0.0": [0, 0, 0], "1.2": [-170, 0, 15], "3.0": [-170, 0, 15], "3.4": [-60, 0, 40], "4.5": [-60, 0, 40]}},
        "head": {"rotation": {"0.0": [0, 0, 0], "1.2": [-20, 0, 0], "3.0": [-20, 0, 0], "3.4": [10, 0, 0]}},
        "rightLeg": {"rotation": {"0.0": [0, 0, 0], "3.0": [0, 0, 0], "3.3": [30, 0, 0], "3.5": [-75, 0, 0], "4.5": [0, 0, 0]}}}},
    "animation.lacobra.avatar.vanish": {"animation_length": 0.8, "loop": "hold_on_last_frame", "bones": {
        "root": {"scale": {"0.0": [1, 1, 1], "0.8": [0.01, 1.6, 0.01]}}}},
}
for name in ("orb", "ball", "venom", "serpent", "guard", "avatar"):
    eff = {"orb": "orb_trail", "ball": "ball_trail", "venom": "venom_trail", "serpent": "serpent_trail",
           "guard": "guard_trail", "avatar": "avatar"}[name]
    fx_anims["animation.lacobra.fx.trail_" + name] = {
        "loop": "hold_on_last_frame", "animation_length": 0.1, "particle_effects": {"0.0": {"effect": eff}}}

player_anims = {
    "animation.lacobra.player.charge": {"animation_length": 1.3, "bones": {
        "rightArm": {"rotation": {"0.0": [0, 0, 0], "0.25": [-100, 0, 20], "1.1": [-110, 0, 25], "1.3": [0, 0, 0]}},
        "leftArm": {"rotation": {"0.0": [0, 0, 0], "0.25": [-100, 0, -20], "1.1": [-110, 0, -25], "1.3": [0, 0, 0]}},
        "body": {"rotation": {"0.0": [0, 0, 0], "0.25": [-6, 0, 0], "1.3": [0, 0, 0]}}}},
    "animation.lacobra.player.cast": {"animation_length": 0.5, "bones": {
        "rightArm": {"rotation": {"0.0": [-40, 0, 0], "0.12": [-95, -15, 0], "0.5": [0, 0, 0]}},
        "body": {"rotation": {"0.0": [0, 0, 0], "0.12": [0, -15, 0], "0.5": [0, 0, 0]}}}},
    "animation.lacobra.player.transform": {"animation_length": 3.4, "bones": {
        "rightArm": {"rotation": {"0.0": [0, 0, 0], "0.6": [-170, 0, 20], "3.0": [-175, 0, 25], "3.4": [0, 0, 0]}},
        "leftArm": {"rotation": {"0.0": [0, 0, 0], "0.6": [-170, 0, -20], "3.0": [-175, 0, -25], "3.4": [0, 0, 0]}},
        "head": {"rotation": {"0.0": [0, 0, 0], "0.6": [-25, 0, 0], "3.0": [-25, 0, 0], "3.4": [0, 0, 0]}}}},
    "animation.lacobra.player.totem": {"animation_length": 0.8, "bones": {
        "rightArm": {"rotation": {"0.0": [0, 0, 0], "0.2": [-150, 0, 0], "0.8": [0, 0, 0]}},
        "leftArm": {"rotation": {"0.0": [0, 0, 0], "0.2": [-150, 0, 0], "0.8": [0, 0, 0]}}}},
    "animation.lacobra.player.atajada": {"animation_length": 0.6, "bones": {
        "rightArm": {"rotation": {"0.0": [0, 0, 0], "0.12": [-90, 20, 0], "0.6": [0, 0, 0]}},
        "leftArm": {"rotation": {"0.0": [0, 0, 0], "0.12": [-90, -20, 0], "0.6": [0, 0, 0]}}}},
}

w("animations/lacobra.boss.animation.json", {"format_version": "1.8.0", "animations": boss_anims})
w("animations/lacobra.fx.animation.json", {"format_version": "1.8.0", "animations": fx_anims})
w("animations/lacobra.player.animation.json", {"format_version": "1.8.0", "animations": player_anims})

w("animation_controllers/lacobra.boss.controller.json", {
    "format_version": "1.10.0",
    "animation_controllers": {
        "controller.animation.lacobra.boss": {
            "initial_state": "default",
            "states": {
                "default": {"transitions": [{"death": "!query.is_alive"}, {"hurt": "query.hurt_time > 0"}]},
                "hurt": {"animations": ["hurt"], "blend_transition": 0.1,
                         "transitions": [{"death": "!query.is_alive"},
                                         {"default": "query.all_animations_finished && query.hurt_time == 0"}]},
                "death": {"animations": ["death"], "blend_transition": 0.2},
            }}}})

# ======================================================================
#  ATTACHABLES DE ARMADURA
# ======================================================================
for item, geo, layer, var in [
    ("casco_cobra", "helmet", 1, "helmet_layer_visible"),
    ("pechera_cobra", "chestplate", 1, "chest_layer_visible"),
    ("pantalones_cobra", "leggings", 2, "leg_layer_visible"),
    ("botas_cobra", "boots", 1, "boot_layer_visible"),
]:
    w("attachables/%s.json" % item, {
        "format_version": "1.10.0",
        "minecraft:attachable": {"description": {
            "identifier": "lacobra:" + item,
            "materials": {"default": "armor", "enchanted": "armor_enchanted"},
            "textures": {"default": "textures/models/armor/cobra_layer_%d" % layer,
                         "enchanted": "textures/misc/enchanted_item_glint"},
            "geometry": {"default": "geometry.humanoid.armor." + geo},
            "scripts": {"parent_setup": "variable.%s = 0.0;" % var},
            "render_controllers": ["controller.render.armor"]}}})

print("RP json listo")
