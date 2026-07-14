// ia/constructor.js — el zombie que coloca bloques.
//
// Adaptación honesta: no existe "construcción libre" en Bedrock. El
// Constructor coloca bloques en PATRONES FIJOS y deterministas:
//  - jugador a >3 bloques de altura → escalón delante de sí mismo (rampa)
//  - hueco delante al mismo nivel   → bloque de puente
//
// Los bloques colocados se MARCAN: siempre son mossy_cobblestone y quedan
// registrados en una lista con timestamp. Un limpiador los devuelve a aire
// a los 2 minutos (si siguen siendo mossy_cobblestone), para no dejar
// cicatrices permanentes en el mundo.
import { system, world, BlockPermutation } from "@minecraft/server";
import { entidadesCercaDeJugadores, jugadorMasCercano, esValido } from "../util.js";

const BLOQUE_MARCADO = "minecraft:mossy_cobblestone";

// Init diferido: BlockPermutation.resolve() no puede usarse en "early
// execution" (al importar el módulo). Se resuelven en el primer uso, ya
// dentro del bucle de ticks.
let AIRE, MOSSY;
function aire() {
  if (!AIRE) AIRE = BlockPermutation.resolve("minecraft:air");
  return AIRE;
}
function mossy() {
  if (!MOSSY) MOSSY = BlockPermutation.resolve(BLOQUE_MARCADO);
  return MOSSY;
}

const VIDA_BLOQUE_TICKS = 2400;  // 2 minutos y el bloque desaparece
const MAX_GLOBAL_POR_PASADA = 4; // presupuesto de bloques colocados por pasada
const MAX_REGISTRO = 400;        // tope duro de la lista de bloques marcados

// { dim, x, y, z, tick }
const colocados = [];

function direccionDominante(desde, hacia) {
  const dx = hacia.x - desde.x, dz = hacia.z - desde.z;
  if (Math.abs(dx) > Math.abs(dz)) return [Math.sign(dx) || 1, 0];
  return [0, Math.sign(dz) || 1];
}

function colocar(dim, x, y, z) {
  try {
    const b = dim.getBlock({ x, y, z });
    if (!b || !b.isAir) return false;
    b.setPermutation(mossy());
    colocados.push({ dim: dim.id, x, y, z, tick: system.currentTick });
    if (colocados.length > MAX_REGISTRO) {
      // Tope alcanzado: limpiar ya el más viejo para no crecer sin límite.
      const viejo = colocados.shift();
      limpiarEntrada(viejo);
    }
    dim.playSound("dig.stone", { x, y, z });
    return true;
  } catch {
    return false;
  }
}

function limpiarEntrada(entrada) {
  try {
    const dim = world.getDimension(entrada.dim);
    const b = dim.getBlock({ x: entrada.x, y: entrada.y, z: entrada.z });
    if (b && b.typeId === BLOQUE_MARCADO) b.setPermutation(aire());
  } catch { }
}

function pasadaDeConstruccion() {
  let presupuesto = MAX_GLOBAL_POR_PASADA;

  const constructores = entidadesCercaDeJugadores(24)
    .filter(e => e.typeId === "za:zombie_constructor");

  for (const e of constructores) {
    if (presupuesto <= 0) break;
    if (!esValido(e)) continue;

    const cerca = jugadorMasCercano(e.location, e.dimension, 20);
    if (!cerca) { apagarAnimacion(e); continue; }

    const objetivo = cerca.jugador;
    const dy = objetivo.location.y - e.location.y;
    const ex = Math.floor(e.location.x), ey = Math.floor(e.location.y), ez = Math.floor(e.location.z);
    const [sx, sz] = direccionDominante(e.location, objetivo.location);
    const fx = ex + sx, fz = ez + sz;

    let construyo = false;
    try {
      if (dy > 3 && cerca.dist > 2.5) {
        // RAMPA: bloque a la altura de sus pies, delante; el zombie salta
        // encima (step de 1 bloque) y repite. Escalera determinista hacia ti.
        construyo = colocar(e.dimension, fx, ey, fz);
      } else if (Math.abs(dy) <= 1.5 && cerca.dist > 2.5) {
        // PUENTE: si delante hay un hueco (aire bajo la celda frontal y bajo
        // esa también), rellena el suelo para cruzar fosos.
        const suelo = e.dimension.getBlock({ x: fx, y: ey - 1, z: fz });
        const abismo = e.dimension.getBlock({ x: fx, y: ey - 2, z: fz });
        if (suelo && suelo.isAir && abismo && (abismo.isAir || abismo.isLiquid)) {
          construyo = colocar(e.dimension, fx, ey - 1, fz);
        }
      }
    } catch { }

    if (construyo) {
      presupuesto--;
      try { e.setProperty("za:accion", 2); } catch { }
    } else {
      apagarAnimacion(e);
    }
  }
}

function apagarAnimacion(e) {
  try { if (e.getProperty("za:accion") !== 0) e.setProperty("za:accion", 0); } catch { }
}

// Devuelve a aire los bloques marcados que ya cumplieron su vida útil.
function limpiarBloquesViejos() {
  const ahora = system.currentTick;
  while (colocados.length > 0 && ahora - colocados[0].tick > VIDA_BLOQUE_TICKS) {
    limpiarEntrada(colocados.shift());
  }
}

export function initConstructor() {
  system.runInterval(pasadaDeConstruccion, 20);
  system.runInterval(limpiarBloquesViejos, 100);
}
