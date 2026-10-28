"""Genera las definiciones de partículas Bedrock (format_version 1.10.0) de La Cobra.

Todas usan el atlas propio textures/particle/lacobra_particles (en gris, teñido
por gradientes) y tienen recuentos bajos pensando en teléfonos Android.
"""
import json
import os
import sys

OUT = sys.argv[1] if len(sys.argv) > 1 else "out"
DIR = os.path.join(OUT, "particles")
TEX = "textures/particle/lacobra_particles"

GOLD = "#FFFFC233"
GOLD_L = "#FFFFE58A"
GOLD_D = "#FFB3700F"
VIOLET = "#FF9A4DF0"
VIOLET_L = "#FFD2A8FF"
BLACK = "#FF1A1022"
WHITE = "#FFFFF8E6"
FADE = "#00FFFFFF"


def uv(x, y, s=16):
    return {"texture_width": 128, "texture_height": 128, "uv": [x, y], "uv_size": [s, s]}


def grad(*stops):
    n = len(stops) - 1
    return {"color": {"interpolant": "v.particle_age / v.particle_lifetime",
                      "gradient": {("%.2f" % (i / n)): c for i, c in enumerate(stops)}}}


def particle(ident, comps, material="particles_blend"):
    return {"format_version": "1.10.0", "particle_effect": {
        "description": {"identifier": "lacobra:" + ident,
                        "basic_render_parameters": {"material": material, "texture": TEX}},
        "components": comps}}


def burst(n, active=0.05):
    return {"minecraft:emitter_rate_instant": {"num_particles": n},
            "minecraft:emitter_lifetime_once": {"active_time": active}}


def stream(rate, max_p=60):
    return {"minecraft:emitter_rate_steady": {"spawn_rate": rate, "max_particles": max_p},
            "minecraft:emitter_lifetime_looping": {"active_time": 1}}


def bb(size, uvd, mode="rotate_xyz"):
    return {"minecraft:particle_appearance_billboard": {"size": size, "facing_camera_mode": mode, "uv": uvd}}


P = {}

# --- chispas doradas ---------------------------------------------------------
P["gold_spark"] = particle("gold_spark", {
    **burst(14),
    "minecraft:emitter_shape_sphere": {"radius": 0.3, "direction": "outwards"},
    "minecraft:particle_lifetime_expression": {"max_lifetime": "0.45 + v.particle_random_1 * 0.4"},
    "minecraft:particle_initial_speed": "4 + v.particle_random_2 * 3",
    "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -6, 0], "linear_drag_coefficient": 3},
    **bb(["0.12 * (1 - v.particle_age / v.particle_lifetime)", "0.12 * (1 - v.particle_age / v.particle_lifetime)"], uv(16, 0)),
    "minecraft:particle_appearance_tinting": grad(GOLD_L, GOLD, GOLD_D)})

# --- humo oscuro -------------------------------------------------------------
P["dark_smoke"] = particle("dark_smoke", {
    **burst(8),
    "minecraft:emitter_shape_sphere": {"radius": 0.6, "direction": "outwards"},
    "minecraft:particle_lifetime_expression": {"max_lifetime": "1.0 + v.particle_random_1 * 0.6"},
    "minecraft:particle_initial_speed": 0.6,
    "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.8, 0], "linear_drag_coefficient": 1.5},
    "minecraft:particle_appearance_billboard": {
        "size": ["0.35 + v.particle_age * 0.4", "0.35 + v.particle_age * 0.4"], "facing_camera_mode": "rotate_xyz",
        "uv": {"texture_width": 128, "texture_height": 128, "flipbook": {
            "base_UV": [0, 16], "size_UV": [16, 16], "step_UV": [16, 0], "max_frame": 8, "stretch_to_lifetime": True}}},
    "minecraft:particle_appearance_tinting": grad("#E0201428", "#C02A1840", "#00100818")}, "particles_alpha")

# --- destellos violetas ------------------------------------------------------
P["violet_flash"] = particle("violet_flash", {
    **burst(10),
    "minecraft:emitter_shape_sphere": {"radius": 0.8, "direction": "outwards"},
    "minecraft:particle_lifetime_expression": {"max_lifetime": "0.3 + v.particle_random_1 * 0.3"},
    "minecraft:particle_initial_speed": 1.5,
    "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 4},
    **bb(["0.22 * (1 - v.particle_age / v.particle_lifetime)", "0.22 * (1 - v.particle_age / v.particle_lifetime)"], uv(112, 0)),
    "minecraft:particle_appearance_tinting": grad(WHITE, VIOLET_L, VIOLET)})

# --- anillo de energía (radio por variable.radius) ----------------------------
P["energy_ring"] = particle("energy_ring", {
    "minecraft:emitter_rate_instant": {"num_particles": "math.clamp(v.radius * 12, 12, 84)"},
    "minecraft:emitter_lifetime_once": {"active_time": 0.05},
    "minecraft:emitter_shape_disc": {"radius": "v.radius", "surface_only": True, "direction": "outwards",
                                     "plane_normal": [0, 1, 0], "offset": [0, 0.15, 0]},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.7},
    "minecraft:particle_initial_speed": 2.5,
    "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 2.5},
    **bb([0.16, 0.16], uv(0, 0)),
    "minecraft:particle_appearance_tinting": grad(GOLD_L, GOLD, VIOLET, FADE)})

# --- onda expansiva: un aro plano que crece -----------------------------------
P["shockwave"] = particle("shockwave", {
    **burst(1),
    "minecraft:emitter_shape_point": {"offset": [0, 0.2, 0]},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.6},
    "minecraft:particle_initial_speed": 0,
    "minecraft:particle_motion_dynamic": {},
    "minecraft:particle_appearance_billboard": {
        "size": ["0.3 + (v.particle_age / v.particle_lifetime) * v.radius",
                 "0.3 + (v.particle_age / v.particle_lifetime) * v.radius"],
        "facing_camera_mode": "emitter_transform_xz", "uv": uv(0, 48, 32)},
    "minecraft:particle_appearance_tinting": grad(WHITE, GOLD_L, VIOLET, FADE)})

# --- espiral del aura (Instinto) ---------------------------------------------
P["aura_spiral"] = particle("aura_spiral", {
    **burst(14),
    "minecraft:emitter_shape_point": {},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.8},
    "minecraft:particle_initial_speed": 0,
    "minecraft:particle_motion_parametric": {"relative_position": [
        "math.cos(v.particle_age * 400 + v.particle_random_1 * 360) * (0.75 - v.particle_age * 0.3)",
        "v.particle_age * 2.4 + v.particle_random_2 * 0.2",
        "math.sin(v.particle_age * 400 + v.particle_random_1 * 360) * (0.75 - v.particle_age * 0.3)"]},
    **bb([0.09, 0.09], uv(32, 0)),
    "minecraft:particle_appearance_tinting": {"color": [
        "v.particle_random_3 > 0.45 ? 1.0 : 0.1", "v.particle_random_3 > 0.45 ? 0.78 : 0.06",
        "v.particle_random_3 > 0.45 ? 0.2 : 0.14", "1 - v.particle_age / v.particle_lifetime"]}}, "particles_alpha")

# --- mini serpientes de energía ---------------------------------------------
P["mini_snake"] = particle("mini_snake", {
    "minecraft:emitter_rate_steady": {"spawn_rate": 40, "max_particles": 14},
    "minecraft:emitter_lifetime_once": {"active_time": 0.3},
    "minecraft:emitter_shape_point": {},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.7},
    "minecraft:particle_initial_speed": 0,
    "minecraft:particle_motion_parametric": {"relative_position": [
        "math.cos(v.emitter_random_1 * 360) * 0.7 + math.sin(v.particle_age * 720) * 0.22",
        "v.particle_age * 3",
        "math.sin(v.emitter_random_1 * 360) * 0.7 + math.cos(v.particle_age * 720) * 0.22"]},
    **bb(["0.11 * (1 - v.particle_age / v.particle_lifetime) + 0.03", "0.11 * (1 - v.particle_age / v.particle_lifetime) + 0.03"], uv(64, 0)),
    "minecraft:particle_appearance_tinting": grad(VIOLET_L, GOLD, GOLD_D)})

# --- estelas -----------------------------------------------------------------
def trail(name, a, b, c, rate, size, cell=(0, 0)):
    P[name] = particle(name, {
        **stream(rate, 50),
        "minecraft:emitter_shape_sphere": {"radius": 0.12, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.35 + v.particle_random_1 * 0.2"},
        "minecraft:particle_initial_speed": 0.3,
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 2},
        **bb(["%s * (1 - v.particle_age / v.particle_lifetime)" % size, "%s * (1 - v.particle_age / v.particle_lifetime)" % size], uv(*cell)),
        "minecraft:particle_appearance_tinting": grad(a, b, c)})


trail("orb_trail", WHITE, GOLD, VIOLET, 45, 0.28)
trail("ball_trail", GOLD_L, GOLD, GOLD_D, 35, 0.2)
trail("serpent_trail", VIOLET_L, VIOLET, BLACK, 25, 0.16, (32, 0))
trail("guard_trail", GOLD_L, GOLD, FADE, 18, 0.12, (32, 0))
trail("venom_trail", "#FFB8FF9A", VIOLET, FADE, 25, 0.18)

# --- explosión de impacto -----------------------------------------------------
P["impact_burst"] = particle("impact_burst", {
    **burst(36),
    "minecraft:emitter_shape_sphere": {"radius": 0.4, "direction": "outwards"},
    "minecraft:particle_lifetime_expression": {"max_lifetime": "0.6 + v.particle_random_1 * 0.4"},
    "minecraft:particle_initial_speed": "5 + v.particle_random_2 * 5",
    "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 3.5, "linear_acceleration": [0, -1, 0]},
    **bb(["0.3 * (1 - v.particle_age / v.particle_lifetime)", "0.3 * (1 - v.particle_age / v.particle_lifetime)"], uv(0, 0)),
    "minecraft:particle_appearance_tinting": {"color": {
        "interpolant": "v.particle_random_3", "gradient": {"0.0": GOLD_L, "0.5": GOLD, "0.8": VIOLET, "1.0": VIOLET_L}}}})

# --- runas que ascienden -----------------------------------------------------
P["rune_rise"] = particle("rune_rise", {
    "minecraft:emitter_rate_instant": {"num_particles": 6},
    "minecraft:emitter_lifetime_once": {"active_time": 0.05},
    "minecraft:emitter_shape_disc": {"radius": "v.radius", "surface_only": True, "plane_normal": [0, 1, 0]},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 1.4},
    "minecraft:particle_initial_speed": 0,
    "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 1.2, 0], "linear_drag_coefficient": 1},
    "minecraft:particle_appearance_billboard": {"size": [0.22, 0.22], "facing_camera_mode": "lookat_y", "uv": {
        "texture_width": 128, "texture_height": 128,
        "uv": ["math.floor(v.particle_random_3 * 8) * 16", 32], "uv_size": [16, 16]}},
    "minecraft:particle_appearance_tinting": grad(GOLD_L, VIOLET_L, FADE)})

# --- rayo de energía vertical ------------------------------------------------
P["energy_beam"] = particle("energy_beam", {
    **burst(1),
    "minecraft:emitter_shape_point": {"offset": [0, 2.5, 0]},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.45},
    "minecraft:particle_initial_speed": 0,
    "minecraft:particle_motion_dynamic": {},
    "minecraft:particle_appearance_billboard": {
        "size": ["0.3 * (1 - v.particle_age / v.particle_lifetime) + 0.05", 2.6], "facing_camera_mode": "lookat_y",
        "uv": uv(96, 0)},
    "minecraft:particle_appearance_tinting": grad(WHITE, VIOLET_L, GOLD, FADE)})

# --- carga: partículas que convergen ----------------------------------------
P["charge_in"] = particle("charge_in", {
    **burst(18),
    "minecraft:emitter_shape_sphere": {"radius": 2.4, "surface_only": True, "direction": "inwards"},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.5},
    "minecraft:particle_initial_speed": 4.6,
    "minecraft:particle_motion_dynamic": {},
    **bb([0.12, 0.12], uv(0, 0)),
    "minecraft:particle_appearance_tinting": {"color": {
        "interpolant": "v.particle_random_1", "gradient": {"0.0": GOLD_L, "0.6": GOLD, "1.0": VIOLET_L}}}})

# --- veneno ------------------------------------------------------------------
P["venom_splash"] = particle("venom_splash", {
    **burst(16),
    "minecraft:emitter_shape_sphere": {"radius": 0.3, "direction": "outwards"},
    "minecraft:particle_lifetime_expression": {"max_lifetime": "0.5 + v.particle_random_1 * 0.4"},
    "minecraft:particle_initial_speed": 3,
    "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -9, 0], "linear_drag_coefficient": 1},
    **bb([0.1, 0.1], uv(32, 0)),
    "minecraft:particle_appearance_tinting": {"color": {
        "interpolant": "v.particle_random_2", "gradient": {"0.0": "#FFB8FF9A", "0.5": VIOLET_L, "1.0": VIOLET}}}})

# --- aura del amuleto --------------------------------------------------------
P["amulet_aura"] = particle("amulet_aura", {
    **burst(5),
    "minecraft:emitter_shape_disc": {"radius": 0.55, "plane_normal": [0, 1, 0]},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 1.1},
    "minecraft:particle_initial_speed": 0,
    "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.9, 0], "linear_drag_coefficient": 1},
    **bb([0.06, 0.06], uv(32, 0)),
    "minecraft:particle_appearance_tinting": grad(VIOLET_L, VIOLET, FADE)})

# --- escudo del tótem --------------------------------------------------------
P["guard_shield"] = particle("guard_shield", {
    **burst(26),
    "minecraft:emitter_shape_sphere": {"radius": 1.3, "surface_only": True, "offset": [0, 1, 0]},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.6},
    "minecraft:particle_initial_speed": 0,
    "minecraft:particle_motion_dynamic": {},
    **bb([0.12, 0.12], uv(64, 0)),
    "minecraft:particle_appearance_tinting": grad(GOLD_L, GOLD, FADE)})

# --- columna suprema ---------------------------------------------------------
P["supreme_pillar"] = particle("supreme_pillar", {
    **burst(26),
    "minecraft:emitter_shape_disc": {"radius": 0.5, "plane_normal": [0, 1, 0]},
    "minecraft:particle_lifetime_expression": {"max_lifetime": "0.7 + v.particle_random_1 * 0.5"},
    "minecraft:particle_initial_speed": 0,
    "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 14, 0], "linear_drag_coefficient": 1.2},
    **bb([0.16, 0.3], uv(0, 0), "lookat_y"),
    "minecraft:particle_appearance_tinting": {"color": {
        "interpolant": "v.particle_random_2", "gradient": {"0.0": WHITE, "0.4": GOLD_L, "0.8": GOLD, "1.0": VIOLET_L}}}})

# --- disipación final --------------------------------------------------------
P["fade_dust"] = particle("fade_dust", {
    **burst(18),
    "minecraft:emitter_shape_sphere": {"radius": 1.2},
    "minecraft:particle_lifetime_expression": {"max_lifetime": "1.2 + v.particle_random_1"},
    "minecraft:particle_initial_speed": 0.2,
    "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.5, 0], "linear_drag_coefficient": 1},
    **bb([0.08, 0.08], uv(32, 0)),
    "minecraft:particle_appearance_tinting": {"color": [
        "v.particle_random_3 > 0.5 ? 0.6 : 0.12", "v.particle_random_3 > 0.5 ? 0.35 : 0.08",
        "v.particle_random_3 > 0.5 ? 0.95 : 0.16", "1 - v.particle_age / v.particle_lifetime"]}}, "particles_alpha")

# --- escamas que saltan (golpe de espada) ------------------------------------
P["scale_shards"] = particle("scale_shards", {
    **burst(8),
    "minecraft:emitter_shape_sphere": {"radius": 0.3, "direction": "outwards"},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.6},
    "minecraft:particle_initial_speed": 3.2,
    "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -10, 0], "linear_drag_coefficient": 1},
    "minecraft:particle_initial_spin": {"rotation": "v.particle_random_1 * 360", "rotation_rate": 400},
    **bb([0.12, 0.12], uv(64, 0)),
    "minecraft:particle_appearance_tinting": {"color": {
        "interpolant": "v.particle_random_2", "gradient": {"0.0": GOLD, "0.5": "#FF2A1F38", "1.0": VIOLET}}}}, "particles_alpha")

# --- aura del jefe (bucle adjunto a la entidad) -------------------------------
P["boss_aura"] = particle("boss_aura", {
    **stream(8, 30),
    "minecraft:emitter_shape_box": {"half_dimensions": [1.2, 1.6, 1.2], "offset": [0, 1.8, 0]},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 1.2},
    "minecraft:particle_initial_speed": 0,
    "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.7, 0], "linear_drag_coefficient": 1},
    **bb([0.1, 0.1], uv(32, 0)),
    "minecraft:particle_appearance_tinting": grad(VIOLET_L, VIOLET, FADE)})

# --- ráfaga del avatar -------------------------------------------------------
P["avatar_glow"] = particle("avatar_glow", {
    **stream(30, 50),
    "minecraft:emitter_shape_box": {"half_dimensions": [1.0, 2.2, 0.6], "offset": [0, 2.2, 0]},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.9},
    "minecraft:particle_initial_speed": 0,
    "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 1.5, 0]},
    **bb([0.12, 0.12], uv(112, 0)),
    "minecraft:particle_appearance_tinting": grad(GOLD_L, GOLD, FADE)})

os.makedirs(DIR, exist_ok=True)
for name, data in P.items():
    with open(os.path.join(DIR, name + ".json"), "w") as f:
        json.dump(data, f, indent=2)
print("partículas:", len(P))
