import { Player, system } from "@minecraft/server";
import { MAESTRO, MULTI, NPC } from "./config.js";
import { blockAt, now, soundAt } from "./util.js";

// Puertas y portones: el motor de pasos los abre al llegar a ellos (como un jugador)
// y se cierran solos cuando ya no queda nadie en el hueco. Las de hierro no se abren
// con la mano, así que tampoco las abren los Claudes.

const abiertas = new Map();
const QUIENES = new Set([NPC, MAESTRO, MULTI]);

export function esPuerta(b) {
  return !!b && b.typeId.endsWith("_door") && b.typeId !== "minecraft:iron_door";
}

export function esPorton(b) {
  return !!b && b.typeId.endsWith("fence_gate");
}

function estado(b, nombre) {
  try {
    return b.permutation.getState(nombre);
  } catch {
    return undefined;
  }
}

function poner(b, abierta) {
  try {
    if (estado(b, "open_bit") === abierta) return false;
    b.setPermutation(b.permutation.withState("open_bit", abierta));
    return true;
  } catch {
    return false;
  }
}

// Las dos mitades de una puerta (o el portón entero) a partir de cualquier bloque.
function partes(dim, b) {
  if (esPorton(b)) return [b];
  if (!esPuerta(b)) return [];
  const base = estado(b, "upper_block_bit") ? blockAt(dim, { x: b.location.x, y: b.location.y - 1, z: b.location.z }) : b;
  if (!esPuerta(base)) return [b];
  const arriba = blockAt(dim, { x: base.location.x, y: base.location.y + 1, z: base.location.z });
  return esPuerta(arriba) ? [base, arriba] : [base];
}

// La otra hoja de una puerta doble (la puerta de al lado, mirando hacia el mismo lado).
function otraHoja(dim, base) {
  if (!esPuerta(base)) return [];
  const dir = estado(base, "minecraft:cardinal_direction") ?? estado(base, "direction");
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const n = blockAt(dim, { x: base.location.x + dx, y: base.location.y, z: base.location.z + dz });
    if (!esPuerta(n) || estado(n, "upper_block_bit")) continue;
    const dn = estado(n, "minecraft:cardinal_direction") ?? estado(n, "direction");
    if (dn !== dir) continue;
    return partes(dim, n);
  }
  return [];
}

// Abre la puerta o el portón si está cerrado. Devuelve true si lo abrió. En una puerta
// doble abre las dos hojas a la vez (antes abría solo una: quedaba una abierta y otra
// cerrada, el paso de un bloque y los maestros se trababan).
export function abrirPaso(dim, b) {
  const lista = partes(dim, b);
  if (!lista.length || estado(lista[0], "open_bit") === true) return false;
  let cambio = false;
  for (const p of [...lista, ...otraHoja(dim, lista[0])]) cambio = poner(p, true) || cambio;
  if (!cambio) return false;
  const pos = { ...lista[0].location };
  soundAt(dim, { x: pos.x + 0.5, y: pos.y + 0.5, z: pos.z + 0.5 }, "random.door_open");
  abiertas.set(`${dim.id}|${pos.x},${pos.y},${pos.z}`, { dim, pos, hasta: now() + 50 });
  return true;
}

function alguienEnElHueco(dim, pos) {
  try {
    const centro = { x: pos.x + 0.5, y: pos.y + 0.5, z: pos.z + 0.5 };
    return dim.getEntities({ location: centro, maxDistance: 1.6 }).some((e) => e instanceof Player || QUIENES.has(e.typeId));
  } catch {
    return true;
  }
}

// Cierra las que abrió cuando ya pasaron todos.
system.runInterval(() => {
  for (const [k, a] of abiertas) {
    if (now() < a.hasta) continue;
    if (alguienEnElHueco(a.dim, a.pos)) {
      a.hasta = now() + 20;
      continue;
    }
    abiertas.delete(k);
    const lista = partes(a.dim, blockAt(a.dim, a.pos));
    let cambio = false;
    for (const p of [...lista, ...(lista.length ? otraHoja(a.dim, lista[0]) : [])]) cambio = poner(p, false) || cambio;
    if (cambio) soundAt(a.dim, { x: a.pos.x + 0.5, y: a.pos.y + 0.5, z: a.pos.z + 0.5 }, "random.door_close");
  }
}, 10);
