"""Genera entidades, objetos, recetas y tablas de botín del Behavior Pack."""
import json
import os
import sys

OUT = sys.argv[1] if len(sys.argv) > 1 else "out"
ITEM_FMT = "1.21.90"
ENT_FMT = "1.21.0"


def w(rel, data):
    p = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# ======================================================================
#  ENTIDADES
# ======================================================================
def despawn_group():
    return {"lacobra:despawn": {"minecraft:instant_despawn": {}}}


def despawn_timer(seconds):
    return {"minecraft:timer": {"looping": False, "time": seconds, "randomInterval": False,
                                "time_down_event": {"event": "lacobra:despawn", "target": "self"}}}


def fx_entity(ident, seconds, props=None, events=None, size=0.1):
    desc = {"identifier": ident, "is_spawnable": False, "is_summonable": True}
    if props:
        desc["properties"] = props
    ev = {"lacobra:despawn": {"add": {"component_groups": ["lacobra:despawn"]}}}
    ev.update(events or {})
    return {"format_version": ENT_FMT, "minecraft:entity": {
        "description": desc,
        "component_groups": despawn_group(),
        "components": {
            "minecraft:type_family": {"family": ["lacobra_fx", "inanimate"]},
            "minecraft:collision_box": {"width": size, "height": size},
            "minecraft:health": {"value": 1, "max": 1},
            "minecraft:damage_sensor": {"triggers": {"cause": "all", "deals_damage": "no"}},
            "minecraft:physics": {"has_gravity": False, "has_collision": False},
            "minecraft:knockback_resistance": {"value": 1.0},
            "minecraft:fire_immune": {},
            "minecraft:breathable": {"breathes_water": True, "breathes_air": True, "total_supply": 15, "suffocate_time": 0},
            "minecraft:conditional_bandwidth_optimization": {},
            **despawn_timer(seconds),
        },
        "events": ev}}


w("entities/circulo_magico.json", fx_entity(
    "lacobra:circulo_magico", 20,
    props={"lacobra:tam": {"type": "int", "range": [1, 2], "default": 1, "client_sync": True}},
    events={"lacobra:grande": {"set_property": {"lacobra:tam": 2}}}))
w("entities/cobra_suprema.json", fx_entity("lacobra:cobra_suprema", 15))
w("entities/avatar_cobra.json", fx_entity("lacobra:avatar_cobra", 12))
w("entities/serpiente_energia.json", fx_entity(
    "lacobra:serpiente_energia", 25,
    props={"lacobra:variante": {"type": "int", "range": [0, 1], "default": 0, "client_sync": True}},
    events={"lacobra:guardiana": {"set_property": {"lacobra:variante": 1}}}))


def projectile(ident, on_hit, power, gravity, seconds, size=0.4):
    return {"format_version": ENT_FMT, "minecraft:entity": {
        "description": {"identifier": ident, "is_spawnable": False, "is_summonable": True,
                        "runtime_identifier": "minecraft:snowball"},
        "component_groups": despawn_group(),
        "components": {
            "minecraft:type_family": {"family": ["lacobra_projectile", "inanimate"]},
            "minecraft:collision_box": {"width": size, "height": size},
            "minecraft:projectile": {"on_hit": on_hit, "power": power, "gravity": gravity,
                                     "inertia": 1.0, "liquid_inertia": 0.8,
                                     "uncertainty_base": 0, "uncertainty_multiplier": 0},
            "minecraft:physics": {},
            "minecraft:conditional_bandwidth_optimization": {
                "default_values": {"max_optimized_distance": 80.0, "max_dropped_ticks": 7,
                                   "use_motion_prediction_hints": True}},
            **despawn_timer(seconds),
        },
        "events": {"lacobra:despawn": {"add": {"component_groups": ["lacobra:despawn"]}}}}}


# el daño de todos los proyectiles lo calcula el script (servidor); aquí solo colisionan
w("entities/esfera_remate.json", projectile("lacobra:esfera_remate", {"remove_on_hit": {}}, 2.0, 0.0, 5, 0.5))
w("entities/balon_proyectil.json", projectile("lacobra:balon_proyectil", {"remove_on_hit": {}}, 1.6, 0.04, 8, 0.35))
w("entities/escupitajo.json", projectile("lacobra:escupitajo", {"remove_on_hit": {}}, 1.4, 0.02, 6, 0.4))

# ---------------------------------------------------------------- jefe
boss_target = {"priority": 1, "must_see": False, "reselect_targets": True, "within_radius": 40,
               "entity_types": [{"filters": {"any_of": [
                   {"test": "is_family", "subject": "other", "value": "player"},
                   {"test": "is_family", "subject": "other", "value": "irongolem"}]}, "max_dist": 40}]}

w("entities/serpiente_legendaria.json", {"format_version": ENT_FMT, "minecraft:entity": {
    "description": {"identifier": "lacobra:serpiente_legendaria", "is_spawnable": True, "is_summonable": True,
                    "properties": {"lacobra:fase": {"type": "int", "range": [1, 3], "default": 1, "client_sync": True}}},
    "component_groups": {
        "lacobra:fase2": {
            "minecraft:movement": {"value": 0.33},
            "minecraft:attack": {"damage": 13},
            "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.35, "track_target": True,
                                                "reach_multiplier": 2.4}},
        "lacobra:fase3": {
            "minecraft:movement": {"value": 0.36},
            "minecraft:attack": {"damage": 16},
            "minecraft:scale": {"value": 1.15},
            "minecraft:knockback_resistance": {"value": 1.0},
            "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.5, "track_target": True,
                                                "reach_multiplier": 2.6}},
    },
    "components": {
        "minecraft:type_family": {"family": ["lacobra_boss", "monster", "mob", "serpiente"]},
        "minecraft:collision_box": {"width": 1.7, "height": 3.4},
        "minecraft:health": {"value": 500, "max": 500},
        "minecraft:boss": {"hud_range": 60, "should_darken_sky": False},
        "minecraft:attack": {"damage": 10},
        "minecraft:movement": {"value": 0.28},
        "minecraft:navigation.walk": {"can_path_over_water": True, "avoid_damage_blocks": True, "can_walk": True},
        "minecraft:movement.basic": {},
        "minecraft:jump.static": {},
        "minecraft:can_climb": {},
        "minecraft:follow_range": {"value": 48, "max": 48},
        "minecraft:knockback_resistance": {"value": 0.85},
        "minecraft:fire_immune": {},
        "minecraft:persistent": {},
        "minecraft:nameable": {},
        "minecraft:physics": {},
        "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0, "breathes_water": True},
        "minecraft:damage_sensor": {"triggers": [
            {"cause": "fall", "deals_damage": "no"},
            {"cause": "suffocation", "deals_damage": "no"},
            {"cause": "drowning", "deals_damage": "no"}]},
        "minecraft:loot": {"table": "loot_tables/entities/serpiente_legendaria.json"},
        "minecraft:experience_reward": {"on_death": "query.last_hit_by_player ? 600 : 0"},
        "minecraft:ambient_sound_interval": {"value": 5, "range": 6, "event_name": "ambient"},
        "minecraft:conditional_bandwidth_optimization": {},
        "minecraft:behavior.float": {"priority": 0},
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.nearest_attackable_target": boss_target,
        "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.2, "track_target": True,
                                            "reach_multiplier": 2.2},
        "minecraft:behavior.random_stroll": {"priority": 6, "speed_multiplier": 0.8},
        "minecraft:behavior.look_at_player": {"priority": 7, "look_distance": 16},
        "minecraft:behavior.random_look_around": {"priority": 8},
    },
    "events": {
        "lacobra:a_fase2": {"sequence": [
            {"add": {"component_groups": ["lacobra:fase2"]}},
            {"set_property": {"lacobra:fase": 2}}]},
        "lacobra:a_fase3": {"sequence": [
            {"remove": {"component_groups": ["lacobra:fase2"]}},
            {"add": {"component_groups": ["lacobra:fase3"]}},
            {"set_property": {"lacobra:fase": 3}}]},
    }}})

w("entities/serpiente_esbirro.json", {"format_version": ENT_FMT, "minecraft:entity": {
    "description": {"identifier": "lacobra:serpiente_esbirro", "is_spawnable": True, "is_summonable": True},
    "component_groups": despawn_group(),
    "components": {
        "minecraft:type_family": {"family": ["lacobra_minion", "monster", "mob", "serpiente"]},
        "minecraft:collision_box": {"width": 0.7, "height": 0.5},
        "minecraft:health": {"value": 20, "max": 20},
        "minecraft:attack": {"damage": 4, "effect_name": "poison", "effect_duration": 3},
        "minecraft:movement": {"value": 0.32},
        "minecraft:navigation.walk": {"can_path_over_water": True, "avoid_damage_blocks": True},
        "minecraft:movement.basic": {},
        "minecraft:jump.static": {},
        "minecraft:follow_range": {"value": 24, "max": 24},
        "minecraft:physics": {},
        "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0},
        "minecraft:nameable": {},
        "minecraft:loot": {"table": "loot_tables/entities/serpiente_esbirro.json"},
        "minecraft:experience_reward": {"on_death": "query.last_hit_by_player ? 8 : 0"},
        "minecraft:ambient_sound_interval": {"value": 4, "range": 6, "event_name": "ambient"},
        "minecraft:conditional_bandwidth_optimization": {},
        "minecraft:behavior.float": {"priority": 0},
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.nearest_attackable_target": {
            "priority": 2, "must_see": True, "within_radius": 24,
            "entity_types": [{"filters": {"test": "is_family", "subject": "other", "value": "player"}, "max_dist": 24}]},
        "minecraft:behavior.melee_attack": {"priority": 3, "speed_multiplier": 1.3, "track_target": True},
        "minecraft:behavior.random_stroll": {"priority": 6, "speed_multiplier": 0.9},
        "minecraft:behavior.look_at_player": {"priority": 7, "look_distance": 8},
        **despawn_timer(120),
    },
    "events": {"lacobra:despawn": {"add": {"component_groups": ["lacobra:despawn"]}}}}})


# ======================================================================
#  OBJETOS
# ======================================================================
def item(name, comps, category="items", group=None, stack=64, glint=False):
    desc = {"identifier": "lacobra:" + name, "menu_category": {"category": category}}
    if group:
        desc["menu_category"]["group"] = group
    c = {"minecraft:icon": "lacobra_" + name,
         "minecraft:display_name": {"value": "item.lacobra." + name},
         "minecraft:max_stack_size": stack}
    if glint:
        c["minecraft:glint"] = True
    c.update(comps)
    w("items/%s.json" % name, {"format_version": ITEM_FMT, "minecraft:item": {"description": desc, "components": c}})


item("escama_cobra", {}, "items")
item("nucleo_energia", {}, "items", glint=True)
item("colmillo_legendario", {}, "items")
item("esencia_suprema", {}, "items", stack=16, glint=True)

item("espada_cobra", {
    "minecraft:hand_equipped": True,
    "minecraft:durability": {"max_durability": 2200, "damage_chance": {"min": 100, "max": 100}},
    "minecraft:damage": {"value": 10},
    "minecraft:enchantable": {"slot": "sword", "value": 15},
    "minecraft:repairable": {"repair_items": [{"items": ["lacobra:escama_cobra"], "repair_amount": 550}]},
    "minecraft:can_destroy_in_creative": False,
    "minecraft:tags": {"tags": ["minecraft:is_sword"]},
    "lacobra:espada": {},
}, "equipment", "minecraft:itemGroup.name.sword", 1, True)

item("balon_dorado", {
    "minecraft:throwable": {"do_swing_animation": True, "launch_power_scale": 1.0, "max_launch_power": 1.6},
    "minecraft:projectile": {"projectile_entity": "lacobra:balon_proyectil", "minimum_critical_power": 1.2},
    "minecraft:cooldown": {"category": "lacobra_balon", "duration": 0.6},
    "lacobra:balon": {},
}, "equipment", None, 16)

item("guantes_goat", {
    "minecraft:allow_off_hand": {"value": True},
    "lacobra:guantes": {},
}, "equipment", None, 1, True)

item("amuleto_cobra", {"minecraft:allow_off_hand": {"value": True}}, "equipment", None, 1, True)
item("totem_cobra", {"lacobra:totem": {}}, "equipment", None, 4, True)
item("idolo_serpiente", {"lacobra:idolo": {}}, "items", None, 1, True)
item("libro_tactico", {"lacobra:libro": {}}, "equipment", None, 1, True)
for sk in ("instinto", "remate", "veneno", "dominio", "suprema"):
    item("runa_" + sk, {"lacobra:runa": {"habilidad": sk}}, "equipment", None, 1, True)

for name, slot, prot, dur, ench, group in [
    ("casco_cobra", "slot.armor.head", 4, 650, "armor_head", "minecraft:itemGroup.name.helmet"),
    ("pechera_cobra", "slot.armor.chest", 9, 950, "armor_torso", "minecraft:itemGroup.name.chestplate"),
    ("pantalones_cobra", "slot.armor.legs", 7, 890, "armor_legs", "minecraft:itemGroup.name.leggings"),
    ("botas_cobra", "slot.armor.feet", 4, 770, "armor_feet", "minecraft:itemGroup.name.boots"),
]:
    item(name, {
        "minecraft:wearable": {"slot": slot, "protection": prot},
        "minecraft:durability": {"max_durability": dur},
        "minecraft:enchantable": {"slot": ench, "value": 15},
        "minecraft:repairable": {"repair_items": [{"items": ["lacobra:escama_cobra"], "repair_amount": dur // 4}]},
        "minecraft:tags": {"tags": ["minecraft:is_armor"]},
    }, "equipment", group, 1)


# ======================================================================
#  RECETAS
# ======================================================================
def shaped(name, pattern, key, count=1, unlock="lacobra:escama_cobra"):
    w("recipes/%s.json" % name, {"format_version": "1.20.10", "minecraft:recipe_shaped": {
        "description": {"identifier": "lacobra:" + name},
        "tags": ["crafting_table"],
        "pattern": pattern,
        "key": {k: {"item": v} for k, v in key.items()},
        "unlock": [{"item": unlock}],
        "result": {"item": "lacobra:" + name, "count": count}}})


def shapeless(name, ingredients, count=1, unlock="minecraft:gold_ingot"):
    w("recipes/%s.json" % name, {"format_version": "1.20.10", "minecraft:recipe_shapeless": {
        "description": {"identifier": "lacobra:" + name},
        "tags": ["crafting_table"],
        "ingredients": [{"item": i} for i in ingredients],
        "unlock": [{"item": unlock}],
        "result": {"item": "lacobra:" + name, "count": count}}})


E, N, n = "lacobra:escama_cobra", "lacobra:nucleo_energia", "minecraft:gold_nugget"
G, C, X = "minecraft:gold_ingot", "lacobra:colmillo_legendario", "lacobra:esencia_suprema"

shapeless("escama_cobra", [G, "minecraft:ink_sac", "minecraft:amethyst_shard", "minecraft:leather"], 2)
shaped("nucleo_energia", ["EAE", "ADA", "EAE"], {"E": E, "A": "minecraft:amethyst_shard", "D": "minecraft:diamond"})
shapeless("libro_tactico", ["minecraft:book", E, G], 1, E)
shaped("balon_dorado", ["nGn", "GLG", "nGn"], {"n": n, "G": G, "L": "minecraft:leather"}, 2, G)
shaped("runa_instinto", ["nEn", "ENE", "nEn"], {"n": n, "E": E, "N": N}, unlock=N)
shaped("runa_remate", ["nEn", "FNF", "nEn"], {"n": n, "E": E, "N": N, "F": "minecraft:fire_charge"}, unlock=N)
shaped("runa_veneno", ["nEn", "PNP", "nEn"], {"n": n, "E": E, "N": N, "P": "minecraft:spider_eye"}, unlock=N)
shaped("runa_dominio", ["GEG", "ONO", "GEG"], {"G": G, "E": E, "N": N, "O": "minecraft:crying_obsidian"}, unlock=N)
shaped("runa_suprema", ["CNC", "NXN", "CNC"], {"C": C, "N": N, "X": X}, unlock=X)
shaped("espada_cobra", [" N ", "EDE", " B "], {"N": N, "E": E, "D": "minecraft:diamond_sword", "B": "minecraft:blaze_rod"}, unlock=N)
shaped("guantes_goat", ["L L", "ENE"], {"L": "minecraft:leather", "E": E, "N": N}, unlock=N)
shaped("amuleto_cobra", [" S ", "GNG", " C "], {"S": "minecraft:string", "G": G, "N": N, "C": C}, unlock=C)
shaped("totem_cobra", ["EGE", "NTN", "EGE"], {"E": E, "G": G, "N": N, "T": "minecraft:totem_of_undying"}, unlock=N)
shaped("casco_cobra", ["ENE", "E E"], {"E": E, "N": N}, unlock=N)
shaped("pechera_cobra", ["E E", "ENE", "ENE"], {"E": E, "N": N}, unlock=N)
shaped("pantalones_cobra", ["ENE", "E E", "E E"], {"E": E, "N": N}, unlock=N)
shaped("botas_cobra", ["N N", "E E"], {"E": E, "N": N}, unlock=N)
shaped("idolo_serpiente", ["NBN", "BYB", "NBN"], {"N": N, "B": "minecraft:gold_block", "Y": "minecraft:ender_eye"}, unlock=N)

# ======================================================================
#  BOTÍN
# ======================================================================
def entry(name, mn=1, mx=1):
    e = {"type": "item", "name": name, "weight": 1}
    if mx > 1 or mn != 1:
        e["functions"] = [{"function": "set_count", "count": {"min": mn, "max": mx}}]
    return e


w("loot_tables/entities/serpiente_legendaria.json", {"pools": [
    {"rolls": 1, "entries": [entry(X)]},
    {"rolls": 1, "entries": [entry(C, 2, 3)]},
    {"rolls": 1, "entries": [entry(N, 2, 4)]},
    {"rolls": 1, "entries": [entry(E, 6, 12)]},
    {"rolls": 1, "entries": [entry("minecraft:gold_block", 1, 3)]},
    {"rolls": 1, "conditions": [{"condition": "random_chance", "chance": 0.35}],
     "entries": [entry("lacobra:totem_cobra")]},
]})
w("loot_tables/entities/serpiente_esbirro.json", {"pools": [
    {"rolls": 1, "conditions": [{"condition": "random_chance", "chance": 0.5}], "entries": [entry(E)]},
]})

print("BP json listo")
