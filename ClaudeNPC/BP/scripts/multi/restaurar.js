import { world } from "@minecraft/server";
import { listar } from "../estructuras.js";
import { now } from "../util.js";

// Si alguien rompe un bloque de la obra de un maestro (su aula o la escuela), se anota con
// el bloque exacto que había (con su forma: escalones, puertas, letreros...) para que un
// Robot multi cercano lo vuelva a poner igual. Las anotaciones duran 10 minutos.

const pendientes = [];
const DURA = 12000;

function enObraDeMaestro(p) {
  for (const a of listar("aula")) {
    if (Math.abs(p.x - a.x) <= 7 && Math.abs(p.z - a.z) <= 7 && p.y >= a.y - 1 && p.y <= a.y + 8) return true;
  }
  for (const e of listar("proyecto")) {
    if (!e.rect) continue; // solo la fachada de la escuela (las otras son de los Claudes)
    if (p.x >= e.rect.x0 && p.x <= e.rect.x1 && p.z >= e.rect.z0 && p.z <= e.rect.z1 && p.y >= e.y - 1 && p.y <= e.y + (e.alto ?? 13)) return true;
  }
  return false;
}

export function anotar(dim, pos, perm) {
  if (!perm || perm.type?.id === "minecraft:air" || !enObraDeMaestro(pos)) return;
  pendientes.push({ dim: dim.id, pos: { ...pos }, perm, t: now() });
  // Una puerta tiene dos mitades: se rompen juntas y se reponen juntas.
  try {
    if (/_door$/.test(perm.type.id)) {
      const arriba = perm.getState("upper_block_bit") === true;
      pendientes.push({ dim: dim.id, pos: { x: pos.x, y: pos.y + (arriba ? -1 : 1), z: pos.z }, perm: perm.withState("upper_block_bit", !arriba), t: now() });
    }
  } catch {
    // Sin esos estados.
  }
  if (pendientes.length > 300) pendientes.splice(0, pendientes.length - 300);
}

world.afterEvents.playerBreakBlock.subscribe(({ block, brokenBlockPermutation, dimension }) => {
  try {
    anotar(dimension, block.location, brokenBlockPermutation);
  } catch {
    // Bloque no disponible.
  }
});

world.afterEvents.blockExplode.subscribe(({ block, explodedBlockPermutation, dimension }) => {
  try {
    anotar(dimension, block.location, explodedBlockPermutation);
  } catch {
    // Bloque no disponible.
  }
});

/**
 * Saca las reparaciones pendientes cerca de "pos" (para que un robot las haga).
 * @param {string} dimId
 * @param {{x:number,y:number,z:number}} pos
 */
export function tomarPendientes(dimId, pos, radio = 64) {
  while (pendientes.length && now() - pendientes[0].t > DURA) pendientes.shift();
  const mias = [];
  for (let i = pendientes.length - 1; i >= 0; i--) {
    const x = pendientes[i];
    if (x.dim !== dimId || Math.hypot(x.pos.x - pos.x, x.pos.z - pos.z) > radio) continue;
    mias.push(x);
    pendientes.splice(i, 1);
  }
  return mias.reverse();
}
