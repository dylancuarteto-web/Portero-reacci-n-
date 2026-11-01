import { system } from "@minecraft/server";
import { blockAt, reemplazable } from "../util.js";

// Antes de construir preparan el terreno como un jugador: primero pican todo lo que
// sobresale por encima del piso (tierra, arena, piedra, árboles enteros) y después
// rellenan los huecos y el agua poco profunda de abajo, hasta dejar una explanada
// firme del tamaño de la obra y un poco más. Solo tocan terreno natural: nunca
// bloques construidos (ni los de la propia obra, ni los de otras obras registradas).

const NATURAL = new RegExp("^minecraft:(dirt|coarse_dirt|grass_block|podzol|mycelium|rooted_dirt|mud|clay|sand|red_sand|gravel"
  + "|stone|deepslate|andesite|diorite|granite|tuff|calcite|sandstone|red_sandstone|snow|snow_layer|ice|packed_ice|powder_snow"
  + "|moss_block|moss_carpet|dripstone_block|pointed_dripstone|netherrack|end_stone|soul_sand|soul_soil|basalt|magma|terracotta"
  + "|(white|orange|yellow|red|brown|light_gray)_terracotta|[a-z_]*_ore|[a-z_]*_log|[a-z_]*_leaves|[a-z_]*_wood"
  + "|brown_mushroom_block|red_mushroom_block|mushroom_stem|cactus|pumpkin|melon_block|bamboo|vine|cave_vines[a-z_]*|cocoa"
  + "|bee_nest|reeds|sugar_cane|kelp|seagrass|azalea|flowering_azalea|mangrove_roots|muddy_mangrove_roots|glow_lichen"
  + "|water|flowing_water|lava|flowing_lava|sculk|sculk_vein|amethyst_block|budding_amethyst|amethyst_cluster"
  + "|[a-z_]*_amethyst_bud|big_dripleaf|small_dripleaf_block|hanging_roots|spore_blossom|sweet_berry_bush)$");
const ARBOL = /(_log|_leaves|_wood|mushroom_block|mushroom_stem|vine|bamboo|cocoa|bee_nest|azalea)$/;
// Lo que nunca se rompe, ni siquiera dentro de la obra.
const NUNCA = /bedrock|barrier|command_block|structure_|jigsaw|end_portal|^minecraft:portal$|end_gateway|reinforced_deepslate|border_block|^minecraft:allow$|^minecraft:deny$|light_block|moving_block|spawner|vault|chest|barrel|shulker|_bed$|^minecraft:bed$/;

export function esNatural(b) {
  return !!b && NATURAL.test(b.typeId);
}

const clave = (x, y, z) => `${x},${y},${z}`;

// Posiciones que ocupa la obra (para no picarlas ni rellenarlas: son de la obra).
export function posicionesDe(plan) {
  const set = new Set();
  for (const p of plan) if (p.pos && p.tipo !== "quitar") set.add(clave(p.pos.x, p.pos.y, p.pos.z));
  return set;
}

// Igual, con el bloque que va en cada posición (undefined: un sitio para pararse).
export function bloquesDe(plan) {
  const mapa = new Map();
  for (const p of plan) {
    if (!p.pos || p.tipo === "quitar") continue;
    const id = typeof p.bloque === "string" ? p.bloque : p.bloque?.type?.id;
    mapa.set(clave(p.pos.x, p.pos.y, p.pos.z), id);
  }
  return mapa;
}

// ¿Tierra, piedra o un árbol donde la obra pone otra cosa? (estorba: el maestro pondría
// su bloque solo en un hueco). Lo ya construido (el bloque que va) nunca estorba.
export function estorbaEnLaObra(b, quiere) {
  return !!b && !b.isAir && esNatural(b) && !b.isLiquid && b.typeId !== quiere;
}

/**
 * Calcula, repartido en varios ticks, los pasos para aplanar el área a la altura "y"
 * (el bloque del piso) y llama a listo(pasos): primero picar (de arriba abajo) y
 * después rellenar (de abajo arriba). "interior" es la huella de la obra: ahí también
 * quita plantas; fuera (el margen) las deja.
 * @param {import("@minecraft/server").Dimension} dim
 * @param {{x0:number,x1:number,z0:number,z1:number}} area
 * @param {number} y
 * @param {(pasos:any[])=>void} listo
 * "todoAdentro": dentro de la huella rompe CUALQUIER bloque que estorbe (no solo terreno
 * natural): lo usa el Robot multi para el maestro.
 * @param {{interior?:{x0:number,x1:number,z0:number,z1:number}, plan?:any[], salvo?:(p:any)=>boolean,
 *   alto?:number, hondo?:number, relleno?:string, todoAdentro?:boolean}} [opciones]
 */
export function planTerreno(dim, area, y, listo, opciones = {}) {
  const { interior, plan = [], salvo, alto = 12, hondo = 5, relleno = "minecraft:cobblestone", todoAdentro = false } = opciones;
  const ocupadas = bloquesDe(plan);
  const dentro = (x, z) => !!interior && x >= interior.x0 && x <= interior.x1 && z >= interior.z0 && z <= interior.z1;
  function* trabajo() {
    const picar = [];
    const rellenar = [];
    try {
      let fila = 0;
      for (let x = area.x0; x <= area.x1; x++, fila++) {
        // En zigzag, como quien avanza fila por fila.
        const zs = [];
        for (let z = area.z0; z <= area.z1; z++) zs.push(z);
        if (fila % 2) zs.reverse();
        for (const z of zs) {
          if (salvo?.({ x, y: y + 1, z })) continue;
          const adentro = dentro(x, z);
          // Por encima del piso: lo natural (y dentro de la obra, también las plantas).
          let tope = alto;
          for (let h = 1; h <= tope; h++) {
            const b = blockAt(dim, { x, y: y + h, z });
            if (!b) break;
            if (b.isAir) continue;
            const k = clave(x, y + h, z);
            // Dentro de la huella (Robot multi): también la tierra o piedra donde va la obra.
            if (ocupadas.has(k) && !(todoAdentro && adentro && estorbaEnLaObra(b, ocupadas.get(k)))) continue;
            const planta = reemplazable(b);
            const todo = todoAdentro && adentro && !NUNCA.test(b.typeId);
            if (!todo && (planta ? !adentro : !esNatural(b))) continue;
            if (h === tope && tope < 32 && ARBOL.test(b.typeId)) tope++; // un árbol: hasta la copa
            picar.push({ tipo: "quitar", pos: { x, y: y + h, z }, terreno: true });
          }
          // El piso y lo de abajo: rellena huecos, plantas y agua hasta tocar suelo firme.
          for (let h = 0; h >= -hondo; h--) {
            const pos = { x, y: y + h, z };
            const b = blockAt(dim, pos);
            if (!b) break;
            const hueco = b.isAir || b.isLiquid || reemplazable(b);
            if (!hueco) break;
            if (ocupadas.has(clave(x, y + h, z))) continue;
            const bloque = h === 0 ? "minecraft:grass_block" : adentro ? relleno : "minecraft:dirt";
            rellenar.push({ tipo: "rellenar", pos, bloque, terreno: true });
          }
          yield;
        }
      }
    } catch {
      // Mundo sin cargar: se construye con lo que se alcanzó a medir.
    }
    picar.sort((a, b) => b.pos.y - a.pos.y);
    rellenar.sort((a, b) => a.pos.y - b.pos.y);
    listo([...picar, ...rellenar]);
  }
  try {
    system.runJob(trabajo());
  } catch {
    listo([]);
  }
}

// Rectángulo (en coordenadas del mundo) de una obra con ejes "a" (frente) y "b"
// (derecha) alrededor de "c": a de a0 a a1 y b de b0 a b1.
export function rectangulo(c, frente, a0, a1, b0, b1) {
  const F = { north: { x: 0, z: -1 }, south: { x: 0, z: 1 }, west: { x: -1, z: 0 }, east: { x: 1, z: 0 } }[frente];
  const xs = [];
  const zs = [];
  for (const a of [a0, a1]) for (const b of [b0, b1]) {
    xs.push(c.x + F.x * a - F.z * b);
    zs.push(c.z + F.z * a + F.x * b);
  }
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}
