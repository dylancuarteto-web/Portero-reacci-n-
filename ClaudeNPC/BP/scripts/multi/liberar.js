import { estados } from "../estado.js";
import { destinoFallido, seAtasco } from "../movimiento.js";
import { blockAt, now, reemplazable } from "../util.js";
import { desatascar, sePuedeQuitar, tunel } from "./combinaciones.js";

// El Robot multi libera a un Claude atascado:
//   - metido en un bloque, una telaraña, nieve polvo o un arbusto de bayas: lo quita;
//   - encerrado (no puede salir caminando ni subiendo un escalón): abre la salida hacia
//     donde quería ir, dejando un escalón de un bloque y sin techo para el salto;
//   - en un pozo hondo (3 o más): lo saca con el rayo tractor hasta el borde;
//   - si solo se rindió contra una pared: le quita la parte de arriba o le abre un túnel.

const DIRS = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
const TRAMPA = /cobweb|^minecraft:web$|powder_snow|sweet_berry_bush/;

function libre(b) {
  return !b || b.isAir || reemplazable(b) || /(carpet|torch|_sign|rail|_button|pressure_plate|_door|fence_gate)$/.test(b.typeId);
}

function solido(b) {
  return !!b && !b.isAir && !b.isLiquid && !reemplazable(b) && !/(carpet|torch|_sign|rail|_button|pressure_plate|_door|fence_gate)$/.test(b.typeId);
}

const piso = (l) => ({ x: Math.floor(l.x), y: Math.floor(l.y), z: Math.floor(l.z) });

// ¿Puede salir por "d" caminando (dos libres) o subiendo un escalón de un bloque?
function salida(dim, p, d) {
  const a = (h) => blockAt(dim, { x: p.x + d.x, y: p.y + h, z: p.z + d.z });
  if (libre(a(0)) && libre(a(1))) return true;
  return solido(a(0)) && libre(a(1)) && libre(a(2)) && libre(blockAt(dim, { x: p.x, y: p.y + 2, z: p.z }));
}

/**
 * Plan para liberar a un Claude: { motivo, acciones, levantar? } o undefined si no hace falta.
 * @param {import("@minecraft/server").Dimension} dim
 * @param {import("@minecraft/server").Entity} claude
 * @param {{x:number,y:number,z:number}|undefined} hacia adónde quiere ir (tú, en la pelea)
 */
export function planLiberar(dim, claude, hacia) {
  const p = piso(claude.location);
  const acciones = [];
  const quitar = (pos) => {
    const b = blockAt(dim, pos);
    if (b && (solido(b) || TRAMPA.test(b.typeId)) && sePuedeQuitar(b, pos)) acciones.push({ tipo: "quitar", pos });
  };
  // 1. Metido en un bloque o en una trampa.
  for (const h of [0, 1]) quitar({ x: p.x, y: p.y + h, z: p.z });
  if (acciones.length) return { motivo: "estaba metido en un bloque", acciones };

  // 2. ¿Puede salir por algún lado? Primero hacia donde quería ir.
  const meta = hacia ?? destinoFallido(claude);
  const orden = [...DIRS].sort((a, b) => (meta ? (b.x * (meta.x - p.x) + b.z * (meta.z - p.z)) - (a.x * (meta.x - p.x) + a.z * (meta.z - p.z)) : 0));
  if (orden.some((d) => salida(dim, p, d))) {
    // Tiene salida, pero si se rindió contra una pared camino de algún sitio, le abre paso.
    const s = estados.get(claude.id);
    const rindio = seAtasco(claude) || (s?.atascadoDesde && now() - s.atascadoDesde > 30);
    if (!rindio || !meta) return undefined;
    const pared = desatascar(dim, claude, meta);
    if (pared.length) return { motivo: "no podía pasar", acciones: pared };
    const t = tunel(dim, { location: meta }, claude.location);
    return t ? { motivo: "no podía pasar", acciones: t.acciones.slice(0, 8) } : undefined;
  }

  // 3. Encerrado: abre la salida más útil.
  const d = orden[0];
  const a = (h) => ({ x: p.x + d.x, y: p.y + h, z: p.z + d.z });
  let alto = 0;
  while (alto < 10 && solido(blockAt(dim, a(alto)))) alto++;
  if (alto >= 3 && libre(blockAt(dim, a(alto))) && libre(blockAt(dim, a(alto + 1)))) {
    // Pozo hondo: lo saca con el rayo tractor hasta el borde.
    const borde = a(alto);
    return { motivo: "estaba en un pozo", acciones: [], levantar: { x: borde.x + 0.5, y: borde.y, z: borde.z + 0.5 } };
  }
  if (solido(blockAt(dim, a(0)))) {
    quitar(a(1)); // pared: deja un escalón de un bloque
    quitar(a(2));
  } else quitar(a(1)); // hueco a los pies pero tapado a la cabeza
  quitar({ x: p.x, y: p.y + 2, z: p.z }); // techo que no deja saltar
  return acciones.length ? { motivo: "estaba encerrado", acciones } : undefined;
}
