import { system, world } from "@minecraft/server";
import { ANIM, EXCAVAR, PARTICLES } from "../config.js";
import { hacha, pala, pico, sostener } from "../equipo.js";
import { protegido } from "../estructuras.js";
import { aprender, nivel } from "../iq.js";
import { caminarA, detener, velocidad } from "../movimiento.js";
import {
  animate, blockAt, centro, clave, mirarA, now, particleAt, piso, reemplazable, romperDestruyendo, sound,
} from "../util.js";

// Abrirse paso como un jugador: si le pones una pared (o se queda atascado), saca
// la herramienta correcta (pico, hacha, pala, tijeras o la mano), la golpea el
// tiempo que tardaría un jugador y la rompe dejando caer el bloque. Hace un hueco
// de dos de alto en dirección a ti; si estás más arriba o más abajo, escalona.

// Bloques que puso cualquier jugador (para reconocer tus muros al instante).
const puestosPorJugador = new Map();

world.afterEvents.playerPlaceBlock.subscribe(({ block }) => {
  puestosPorJugador.set(clave(block.dimension, block.location), now());
  if (puestosPorJugador.size > 4000) puestosPorJugador.delete(puestosPorJugador.keys().next().value);
});
world.afterEvents.playerBreakBlock.subscribe(({ block }) => puestosPorJugador.delete(clave(block.dimension, block.location)));

export function loPusoUnJugador(dimension, p) {
  return puestosPorJugador.has(clave(dimension, p));
}

const IRROMPIBLES = /bedrock|barrier|command_block|structure_|jigsaw|end_portal|^minecraft:portal$|end_gateway|reinforced_deepslate|border_block|^minecraft:allow$|^minecraft:deny$|light_block|moving_block|spawner|vault|lava|water/;
// Cosas por las que se puede pasar (no son pared).
const PASABLE = /torch|rail|redstone_wire|button|lever|_sign|pressure_plate|tripwire|^minecraft:fire$|carpet|frame|repeater|comparator|seagrass|kelp|coral_fan|waterlily|string|ladder|vine|_banner|candle|snow_layer/;
const BLANDO = /glass|leaves|ice|wool|torch|flower|sapling|button|lever|cake|candle|cobweb|^minecraft:bed$|glowstone|sea_lantern|shroomlight|^minecraft:tnt$/;
const PIEDRA = /stone|brick|cobble|deepslate|tuff|basalt|blackstone|terracotta|quartz|prismarine|purpur|andesite|diorite|granite|calcite|copper|dripstone|amethyst|furnace|smoker|dispenser|dropper|observer|hopper|cauldron|anvil|bell|lantern|chain|iron_|gold_|diamond_|emerald_|lapis_|redstone_block|netherite|obsidian|ancient_debris|respawn|_ore|concrete$|magma|end_stone/;
const MADERA = /log|wood|planks|fence|door|trapdoor|stairs|slab|bookshelf|chest|barrel|crafting_table|cartography|fletching|smithing|loom|lectern|bamboo|stem|hyphae|composter|banner|campfire|beehive|bee_nest|note_block|jukebox|pumpkin|melon/;
const TIERRA = /dirt|grass|sand|gravel|clay|mud|farmland|soul_|mycelium|podzol|snow|powder|hay_block|sponge|netherrack|slime|honey|moss|rooted/;
const DIAMANTE = /obsidian|ancient_debris|respawn_anchor|netherite_block/;
const HIERRO = /diamond_block|gold_block|emerald_block|diamond_ore|gold_ore|emerald_ore|redstone_ore/;

function tag(block, nombre) {
  try {
    return block.hasTag(nombre);
  } catch {
    return false;
  }
}

// Tipo de bloque para elegir herramienta y tiempo: primero las etiquetas del
// juego y, si no las tiene, por el nombre.
function categoria(block) {
  const id = block.typeId;
  if (BLANDO.test(id)) return "blando";
  if (tag(block, "minecraft:is_pickaxe_item_destructible") || tag(block, "stone") || tag(block, "metal")) return "piedra";
  if (tag(block, "minecraft:is_axe_item_destructible") || tag(block, "wood") || tag(block, "log")) return "madera";
  if (tag(block, "minecraft:is_shovel_item_destructible") || tag(block, "dirt") || tag(block, "sand")
    || tag(block, "gravel") || tag(block, "grass") || tag(block, "snow")) return "tierra";
  if (PIEDRA.test(id) && !/wooden|_wood|log|planks/.test(id)) return "piedra";
  if (MADERA.test(id)) return "madera";
  if (TIERRA.test(id)) return "tierra";
  return "piedra";
}

export function estorba(block) {
  return !!block && !block.isAir && !block.isLiquid && !reemplazable(block) && !PASABLE.test(block.typeId);
}

export function rompible(block, state) {
  if (!estorba(block)) return false;
  const id = block.typeId;
  if (IRROMPIBLES.test(id) || protegido(block.location)) return false;
  if (DIAMANTE.test(id) || tag(block, "minecraft:diamond_tier_destructible")) return state.nivelPico >= 3;
  if (HIERRO.test(id) || tag(block, "minecraft:iron_tier_destructible")) return state.nivelPico >= 2;
  if (tag(block, "minecraft:stone_tier_destructible")) return state.nivelPico >= 1;
  return true;
}

const HERRAMIENTA_X = [1.25, 1.0, 0.8, 0.65, 0.55];

// Ticks que tarda en romperlo, como un jugador con esa herramienta.
export function tiempoRotura(block, state) {
  const id = block.typeId;
  const cat = categoria(block);
  let t = { blando: 6, tierra: 9, madera: 15, piedra: 18 }[cat];
  if (DIAMANTE.test(id)) t = 60;
  else if (/anvil|iron_block|gold_block|diamond_block|emerald_block|netherite/.test(id)) t = 30;
  if (cat !== "blando") t *= HERRAMIENTA_X[Math.min(state.nivelPico, 4)];
  return Math.max(4, Math.round(t * (1 - nivel(state) * 0.15)));
}

function herramienta(block, state) {
  const cat = categoria(block);
  if (cat === "piedra") return pico(state);
  if (cat === "madera") return hacha(state);
  if (cat === "tierra") return pala(state);
  if (/wool|leaves|cobweb|vine/.test(block.typeId)) return "minecraft:shears";
  return "minecraft:air";
}

function sonidoGolpe(block) {
  const cat = categoria(block);
  if (/wool|carpet/.test(block.typeId)) return "hit.cloth";
  return { piedra: "hit.stone", madera: "hit.wood", tierra: "hit.gravel", blando: "hit.stone" }[cat];
}

function lavaCerca(dimension, p) {
  for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]]) {
    const b = blockAt(dimension, { x: p.x + dx, y: p.y + dy, z: p.z + dz });
    if (b?.typeId.includes("lava")) return true;
  }
  return false;
}

function eje(npc, objetivo) {
  const dx = objetivo.x - npc.location.x;
  const dz = objetivo.z - npc.location.z;
  return Math.abs(dx) >= Math.abs(dz) ? { x: Math.sign(dx) || 1, z: 0 } : { x: 0, z: Math.sign(dz) || 1 };
}

// Qué hay justo delante (hacia el jugador) a la altura de los pies y de la cabeza.
// "jugador": un bloque que puso un jugador; "natural": otra cosa sólida; undefined: libre.
export function muroDelante(npc, jugador) {
  const p = piso(npc.location);
  const e = eje(npc, jugador.location);
  let natural = false;
  for (const h of [0, 1]) {
    const pos = { x: p.x + e.x, y: p.y + h, z: p.z + e.z };
    const b = blockAt(npc.dimension, pos);
    if (!estorba(b)) continue;
    if (loPusoUnJugador(npc.dimension, pos)) return "jugador";
    natural = true;
  }
  return natural ? "natural" : undefined;
}

export function iniciarExcavar(npc, state, objetivo) {
  detener(npc);
  velocidad(npc, 0);
  state.obra = { tipo: "excavar", objetivo, rotos: 0, pasos: 0, desde: now() };
}

// Golpea el bloque con la herramienta durante el tiempo de rotura y luego lo rompe.
function picar(npc, state, block, o) {
  const pos = { ...block.location };
  const tipo = block.typeId;
  const t = tiempoRotura(block, state);
  const c = { x: pos.x + 0.5, y: pos.y + 0.5, z: pos.z + 0.5 };
  sostener(npc, herramienta(block, state));
  mirarA(npc, c);
  const golpe = sonidoGolpe(block);
  for (let k = 0; k < t; k += 6) {
    system.runTimeout(() => {
      if (!npc.isValid) return;
      animate(npc, ANIM.minar);
      sound(npc, golpe, 1, 0.6);
      particleAt(npc.dimension, PARTICLES.polvo, c);
    }, k);
  }
  system.runTimeout(() => {
    if (!npc.isValid) return;
    const b = blockAt(npc.dimension, pos);
    if (b?.typeId !== tipo) return;
    if (romperDestruyendo(npc.dimension, pos)) {
      puestosPorJugador.delete(clave(npc.dimension, pos));
      state.minados++;
      aprender(npc, state, 0.05);
    }
  }, t);
  o.rotos++;
  state.ocupadoHasta = now() + t + 2;
}

// Un paso: rompe lo que estorba delante (cabeza primero, luego pies) o avanza un bloque.
export function tickExcavar(npc, state) {
  const o = state.obra;
  if (now() < state.ocupadoHasta) return false;
  const objetivo = o.objetivo;
  if (!objetivo?.isValid || now() - o.desde > 700 || o.rotos >= EXCAVAR.maxBloques || o.pasos > EXCAVAR.maxPasos) return true;
  const t = objetivo.location;
  if (Math.hypot(t.x - npc.location.x, t.z - npc.location.z) < 1.8 && Math.abs(t.y - npc.location.y) < 1.5) return true;
  if (!npc.isOnGround && !npc.isInWater) return false;

  const p = piso(npc.location);
  const e = eje(npc, t);
  const dy = t.y - npc.location.y;
  const sig = { x: p.x + e.x, z: p.z + e.z };
  const lista = [];
  if (dy > 0.8) {
    // Sube en escalón: espacio sobre la cabeza y delante, un bloque más arriba.
    lista.push({ x: p.x, y: p.y + 2, z: p.z }, { x: sig.x, y: p.y + 2, z: sig.z }, { x: sig.x, y: p.y + 1, z: sig.z });
  } else if (dy < -0.8) {
    // Baja en escalón.
    lista.push({ x: sig.x, y: p.y + 1, z: sig.z }, { x: sig.x, y: p.y, z: sig.z }, { x: sig.x, y: p.y - 1, z: sig.z });
  } else {
    lista.push({ x: sig.x, y: p.y + 1, z: sig.z }, { x: sig.x, y: p.y, z: sig.z });
  }
  for (const pos of lista) {
    const b = blockAt(npc.dimension, pos);
    if (!estorba(b)) continue;
    if (!rompible(b, state) || lavaCerca(npc.dimension, pos)) return true; // no puede pasar por aquí
    picar(npc, state, b, o);
    return false;
  }
  // Libre: avanza al bloque siguiente (saltando si sube).
  caminarA(npc, centro({ x: sig.x, y: p.y, z: sig.z }), state.pers?.paso ?? 0.2);
  o.pasos++;
  state.ocupadoHasta = now() + 6;
  return false;
}
