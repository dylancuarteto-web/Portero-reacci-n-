// util.js — helpers compartidos por todos los sistemas.
// Regla de rendimiento: NUNCA usar getEntities() sin location + maxDistance.
import { world } from "@minecraft/server";

// Límite global de zombies del addon activos a la vez (rendimiento).
export const CAP_ZOMBIES = 40;

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

// Compatibilidad: en @minecraft/server 2.x isValid es propiedad; en 1.x era método.
export function esValido(e) {
  try {
    return typeof e.isValid === "function" ? e.isValid() : !!e.isValid;
  } catch {
    return false;
  }
}

export function jugadores() {
  return world.getAllPlayers().filter(esValido);
}

export function distancia(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Junta entidades alrededor de TODOS los jugadores sin duplicados (por id).
// Siempre acotado por radio — es la única forma barata de "ver" la horda.
export function entidadesCercaDeJugadores(radio, opcionesExtra = {}) {
  const vistos = new Map();
  for (const p of jugadores()) {
    let cerca = [];
    try {
      cerca = p.dimension.getEntities({
        location: p.location,
        maxDistance: radio,
        ...opcionesExtra
      });
    } catch { /* chunk descargado, etc. */ }
    for (const e of cerca) {
      if (esValido(e)) vistos.set(e.id, e);
    }
  }
  return [...vistos.values()];
}

export function zombiesActivos(radio = 96) {
  return entidadesCercaDeJugadores(radio, { families: ["za_zombie"] });
}

export function jugadorMasCercano(loc, dimension, radioMax = 64) {
  let mejor = null, mejorDist = radioMax;
  for (const p of jugadores()) {
    if (p.dimension.id !== dimension.id) continue;
    const d = distancia(p.location, loc);
    if (d < mejorDist) { mejorDist = d; mejor = p; }
  }
  return mejor ? { jugador: mejor, dist: mejorDist } : null;
}

// Mensaje traducible (los textos viven en texts/*.lang, nunca aquí).
export function msg(player, clave, args) {
  try {
    const parte = { translate: clave };
    if (args !== undefined) parte.with = args;
    player.sendMessage({ rawtext: [parte] });
  } catch { }
}

// ---------------------------------------------------------------------------
// Lista permitida de bloques que Minero / Demoledor / Mutante pueden romper.
// Devuelve el "coste" en ticks extra de cooldown, o -1 si NO se puede romper.
// Obsidiana: lentísimo (600 ticks ≈ 30 s por operación), no imposible.
// ---------------------------------------------------------------------------
const BLOQUES_PROHIBIDOS = new Set([
  "minecraft:bedrock", "minecraft:barrier", "minecraft:border_block",
  "minecraft:command_block", "minecraft:chain_command_block",
  "minecraft:repeating_command_block", "minecraft:structure_block",
  "minecraft:structure_void", "minecraft:jigsaw", "minecraft:allow",
  "minecraft:deny", "minecraft:light_block", "minecraft:end_portal",
  "minecraft:end_portal_frame", "minecraft:end_gateway", "minecraft:portal",
  "minecraft:reinforced_deepslate", "minecraft:moving_block",
  "minecraft:beacon", "minecraft:ender_chest"
]);

const BLOQUES_DUROS = new Map([
  ["minecraft:obsidian", 600],
  ["minecraft:crying_obsidian", 600],
  ["minecraft:iron_block", 300],
  ["minecraft:netherite_block", 500],
  ["minecraft:ancient_debris", 400]
]);

const BLOQUES_BLANDOS = new Set([
  "minecraft:dirt", "minecraft:grass_block", "minecraft:grass_path",
  "minecraft:coarse_dirt", "minecraft:podzol", "minecraft:mycelium",
  "minecraft:rooted_dirt", "minecraft:mud", "minecraft:sand",
  "minecraft:red_sand", "minecraft:gravel", "minecraft:clay",
  "minecraft:snow", "minecraft:snow_layer", "minecraft:moss_block",
  "minecraft:soul_sand", "minecraft:soul_soil", "minecraft:netherrack"
]);

const BLOQUES_MEDIOS = new Set([
  "minecraft:stone", "minecraft:cobblestone", "minecraft:mossy_cobblestone",
  "minecraft:granite", "minecraft:diorite", "minecraft:andesite",
  "minecraft:polished_granite", "minecraft:polished_diorite", "minecraft:polished_andesite",
  "minecraft:deepslate", "minecraft:cobbled_deepslate", "minecraft:polished_deepslate",
  "minecraft:deepslate_bricks", "minecraft:deepslate_tiles",
  "minecraft:stonebrick", "minecraft:stone_bricks", "minecraft:brick_block",
  "minecraft:sandstone", "minecraft:red_sandstone", "minecraft:tuff",
  "minecraft:calcite", "minecraft:dripstone_block", "minecraft:packed_mud",
  "minecraft:mud_bricks", "minecraft:glass", "minecraft:glass_pane",
  "minecraft:glowstone", "minecraft:bookshelf", "minecraft:crafting_table",
  "minecraft:smooth_stone", "minecraft:quartz_block", "minecraft:prismarine"
]);

// Sufijos comunes de bloques de construcción del jugador.
const SUFIJOS_PERMITIDOS = [
  "_planks", "_log", "_wood", "_stem", "_wool", "_carpet", "_terracotta",
  "_concrete", "_concrete_powder", "_bricks", "_leaves", "_fence",
  "_fence_gate", "_stairs", "_slab", "_wall", "_trapdoor", "_glass",
  "_glass_pane", "_sandstone", "_copper"
];

export function costeBloque(typeId) {
  if (typeId === "minecraft:air" || typeId === "minecraft:water" || typeId === "minecraft:lava") return -1;
  if (BLOQUES_PROHIBIDOS.has(typeId)) return -1;
  const duro = BLOQUES_DUROS.get(typeId);
  if (duro !== undefined) return duro;
  if (BLOQUES_BLANDOS.has(typeId)) return 5;
  if (BLOQUES_MEDIOS.has(typeId)) return 20;
  for (const s of SUFIJOS_PERMITIDOS) {
    if (typeId.endsWith(s)) return typeId.endsWith("_leaves") ? 2 : 20;
  }
  return -1; // Todo lo demás (incluidos bloques de otros addons) NO se rompe.
}
