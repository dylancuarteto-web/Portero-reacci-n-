import { BlockPermutation } from "@minecraft/server";
import { protegido } from "../estructuras.js";
import { blockAt, ESCALON, nombreDireccion, reemplazable } from "../util.js";

// Combinaciones de construcción del Robot multi: cada una devuelve una lista de
// acciones { tipo: "poner" | "quitar", pos, bloque } para que los Claudes te alcancen.
//   rampa      escalones rectos de piedra hasta tu altura (con soporte y techo libre)
//   caracol    escalera en espiral alrededor de una columna (si no hay sitio para la rampa)
//   puente     pasarela de dos de ancho sobre huecos, agua o lava
//   tunel      pasillo de 2 x 2 a través de una pared o una montaña
//   bajada     escalera excavada hacia abajo (si estás más abajo)
//   desatascar quita el bloque que un Claude no puede escalar (o el techo que no lo deja saltar)

const NUNCA = /bedrock|barrier|command_block|structure_|jigsaw|end_portal|^minecraft:portal$|end_gateway|reinforced_deepslate|border_block|^minecraft:allow$|^minecraft:deny$|light_block|moving_block|spawner|vault|chest|barrel|shulker|_bed$|^minecraft:bed$/;

const perm = (id, estados) => {
  try {
    return BlockPermutation.resolve(id, estados);
  } catch {
    return id;
  }
};

function libre(b) {
  return !b || b.isAir || reemplazable(b);
}

function hueco(b) {
  return !b || b.isAir || b.isLiquid || reemplazable(b);
}

export function sePuedeQuitar(b, p) {
  return !!b && !b.isAir && !NUNCA.test(b.typeId) && !protegido(p);
}

// En la obra de su maestro sí puede romper (lo protegido es la obra misma).
export function quitable(b, p, enSuObra) {
  return enSuObra ? !!b && !b.isAir && !NUNCA.test(b.typeId) : sePuedeQuitar(b, p);
}

const piso = (p) => ({ x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) });

export function cardinal(desde, hacia) {
  const dx = hacia.x - desde.x;
  const dz = hacia.z - desde.z;
  if (Math.abs(dx) > Math.abs(dz)) return { x: Math.sign(dx) || 1, z: 0 };
  return { x: 0, z: Math.sign(dz) || 1 };
}

// Suelo debajo, aunque esté muy abajo (hasta 96 bloques): la altura de los pies.
export function sueloBajo(dim, x, y, z) {
  for (let h = Math.floor(y); h >= Math.floor(y) - 96; h--) {
    const b = blockAt(dim, { x, y: h - 1, z });
    if (b && !b.isAir && !reemplazable(b)) return h;
  }
  return Math.floor(y);
}

// Suelo (altura de los pies) cerca de "y": busca hacia abajo el primer bloque firme.
export function sueloEn(dim, x, y, z) {
  for (let h = Math.floor(y) + 3; h >= Math.floor(y) - 8; h--) {
    const b = blockAt(dim, { x, y: h, z });
    if (b && !hueco(b)) {
      if (libre(blockAt(dim, { x, y: h + 1, z })) && libre(blockAt(dim, { x, y: h + 2, z }))) return h + 1;
    }
  }
  return Math.floor(y);
}

function escalon(dir) {
  return perm("minecraft:stone_brick_stairs", { weirdo_direction: ESCALON[nombreDireccion(dir.x, dir.z)], upside_down_bit: false });
}

// Pone soporte bajo un bloque (hasta tocar suelo) y deja libre el espacio de arriba.
function soporteYTecho(dim, acc, pos, techo = 3, soporte = true) {
  for (let h = 1; h <= 8 && soporte; h++) {
    const p = { x: pos.x, y: pos.y - h, z: pos.z };
    if (!hueco(blockAt(dim, p)) || protegido(p)) break;
    acc.push({ tipo: "poner", pos: p, bloque: "minecraft:cobblestone" });
  }
  for (let h = 1; h <= techo; h++) {
    const p = { x: pos.x, y: pos.y + h, z: pos.z };
    const b = blockAt(dim, p);
    if (!libre(b) && sePuedeQuitar(b, p)) acc.push({ tipo: "quitar", pos: p });
  }
}

// --- Rampa: escalones rectos desde donde están los Claudes hasta tu altura ---
export function rampa(dim, jugador, desde) {
  const j = piso(jugador.location);
  const dir = cardinal(desde, j);
  const alto = Math.max(1, Math.min(24, j.y - Math.floor(desde.y)));
  const acc = [];
  // El último escalón queda pegado a tu columna, a la altura de tus pies menos uno.
  for (let k = alto; k >= 1; k--) {
    const pos = { x: j.x - dir.x * (alto - k + 1), y: j.y - 1 - (alto - k), z: j.z - dir.z * (alto - k + 1) };
    const b = blockAt(dim, pos);
    if (b && !hueco(b) && !sePuedeQuitar(b, pos)) return undefined; // algo que no se puede tocar en el camino
    // Nunca escaleras encima de la obra de un maestro, una casa o la escuela.
    if (protegido(pos) || protegido({ x: pos.x, y: pos.y - 1, z: pos.z })) return undefined;
  }
  for (let k = 1; k <= alto; k++) {
    const pos = { x: j.x - dir.x * (alto - k + 1), y: j.y - 1 - (alto - k), z: j.z - dir.z * (alto - k + 1) };
    const b = blockAt(dim, pos);
    // Si ahí ya hay un bloque firme (tierra, un escalón ya puesto) sirve de escalón: no lo
    // rompe (así tampoco deshace su propia rampa al volver a pensar). Solo libra el techo.
    if (!b || hueco(b)) {
      soporteYTecho(dim, acc, pos);
      acc.push({ tipo: "poner", pos, bloque: escalon(dir) });
    } else soporteYTecho(dim, acc, pos, 3, false);
  }
  return { nombre: "rampa", acciones: acc };
}

// --- Caracol: escalera en espiral pegada a tu columna (cuando no hay sitio para la rampa) ---
const VUELTA = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
export function caracol(dim, jugador, desde) {
  const j = piso(jugador.location);
  const lado = cardinal(j, desde);
  const c = { x: j.x + lado.x * 2, z: j.z + lado.z * 2 }; // columna central, a dos bloques de ti
  const base = sueloEn(dim, c.x, desde.y, c.z);
  const alto = Math.max(1, Math.min(24, j.y - base));
  const acc = [];
  for (let h = 0; h < alto; h++) {
    const p = { x: c.x, y: base + h, z: c.z };
    if (protegido(p)) return undefined; // no en la obra de un maestro ni en una casa
    const b = blockAt(dim, p);
    if (hueco(b)) acc.push({ tipo: "poner", pos: p, bloque: "minecraft:cobblestone" });
  }
  for (let k = 0; k < alto; k++) {
    const [ox, oz] = VUELTA[k % VUELTA.length];
    const [nx, nz] = VUELTA[(k + 1) % VUELTA.length];
    const pos = { x: c.x + ox, y: base + k, z: c.z + oz };
    if (protegido(pos)) return undefined;
    const b = blockAt(dim, pos);
    if (b && !hueco(b)) {
      soporteYTecho(dim, acc, pos, 2, false); // ya hay un escalón firme: solo libra el techo
      continue;
    }
    soporteYTecho(dim, acc, pos, 2);
    acc.push({ tipo: "poner", pos, bloque: escalon({ x: nx - ox, z: nz - oz }) });
  }
  return { nombre: "escalera de caracol", acciones: acc };
}

// --- Puente: pasarela de dos de ancho sobre huecos, agua o lava ---
export function puente(dim, jugador, desde) {
  const j = piso(jugador.location);
  const a = piso(desde);
  const dir = cardinal(a, j);
  const lado = { x: -dir.z, z: dir.x };
  const largo = Math.min(28, Math.abs(j.x - a.x) + Math.abs(j.z - a.z));
  const y = a.y - 1;
  const acc = [];
  for (let k = 1; k <= largo; k++) {
    for (const l of [0, 1]) {
      const pos = { x: a.x + dir.x * k + lado.x * l, y, z: a.z + dir.z * k + lado.z * l };
      if (hueco(blockAt(dim, pos)) && !protegido(pos)) acc.push({ tipo: "poner", pos, bloque: "minecraft:spruce_planks" });
    }
  }
  return acc.length ? { nombre: "puente", acciones: acc } : undefined;
}

// --- Túnel: pasillo de 2 x 2 que atraviesa paredes o montañas hacia ti ---
export function tunel(dim, jugador, desde) {
  const j = piso(jugador.location);
  const a = piso(desde);
  const dir = cardinal(a, j);
  const lado = { x: -dir.z, z: dir.x };
  const largo = Math.min(16, Math.abs(j.x - a.x) + Math.abs(j.z - a.z));
  const acc = [];
  for (let k = 1; k <= largo; k++) {
    for (const l of [0, 1]) for (const h of [0, 1]) {
      const pos = { x: a.x + dir.x * k + lado.x * l, y: a.y + h, z: a.z + dir.z * k + lado.z * l };
      const b = blockAt(dim, pos);
      if (!libre(b) && sePuedeQuitar(b, pos)) acc.push({ tipo: "quitar", pos });
    }
  }
  return acc.length ? { nombre: "túnel", acciones: acc } : undefined;
}

// --- Bajada: escalera excavada hacia abajo, hacia ti ---
export function bajada(dim, jugador, desde) {
  const j = piso(jugador.location);
  const a = piso(desde);
  const dir = cardinal(a, j);
  const hondo = Math.min(16, a.y - j.y);
  const acc = [];
  for (let k = 1; k <= hondo; k++) {
    const x = a.x + dir.x * k;
    const z = a.z + dir.z * k;
    const y = a.y - k;
    for (const h of [0, 1, 2]) {
      const pos = { x, y: y + h, z };
      const b = blockAt(dim, pos);
      if (!libre(b) && sePuedeQuitar(b, pos)) acc.push({ tipo: "quitar", pos });
    }
    const piso1 = { x, y: y - 1, z };
    if (hueco(blockAt(dim, piso1)) && !protegido(piso1)) acc.push({ tipo: "poner", pos: piso1, bloque: "minecraft:cobblestone" });
  }
  return acc.length ? { nombre: "bajada", acciones: acc } : undefined;
}

// --- Desatascar: el bloque que un Claude no puede escalar ---
// Si tiene delante una pared de dos (o más), quita la parte de arriba para que quede un
// escalón; si tiene un techo encima que no lo deja saltar, quita el techo.
export function desatascar(dim, claude, hacia) {
  const l = claude.location;
  const dir = cardinal(l, hacia);
  const p = piso(l);
  const acc = [];
  const frente = (h) => ({ x: p.x + dir.x, y: p.y + h, z: p.z + dir.z });
  const pie = blockAt(dim, frente(0));
  const cabeza = blockAt(dim, frente(1));
  if (!libre(pie) && !libre(cabeza)) {
    for (const h of [1, 2]) {
      const pos = frente(h);
      const b = blockAt(dim, pos);
      if (!libre(b) && sePuedeQuitar(b, pos)) acc.push({ tipo: "quitar", pos });
    }
  }
  const techo = { x: p.x, y: p.y + 2, z: p.z };
  const bt = blockAt(dim, techo);
  if (!libre(pie) && !libre(bt) && sePuedeQuitar(bt, techo)) acc.push({ tipo: "quitar", pos: techo });
  return acc;
}

// ¿Hay un hueco (aire, agua o lava) bajo la línea que va de "desde" hasta ti?
export function hayHueco(dim, desde, jugador) {
  const a = piso(desde);
  const j = piso(jugador.location);
  const dir = cardinal(a, j);
  const largo = Math.min(24, Math.abs(j.x - a.x) + Math.abs(j.z - a.z));
  let huecos = 0;
  for (let k = 1; k < largo; k++) {
    if (hueco(blockAt(dim, { x: a.x + dir.x * k, y: a.y - 1, z: a.z + dir.z * k }))) huecos++;
  }
  return huecos >= 2;
}

// ¿Hay pared entre "desde" y tú (a la altura del pecho)?
export function hayPared(dim, desde, jugador) {
  try {
    const o = { x: desde.x, y: desde.y + 1.2, z: desde.z };
    const j = jugador.location;
    const dx = j.x - o.x;
    const dz = j.z - o.z;
    const d = Math.hypot(dx, dz) || 1;
    const choque = dim.getBlockFromRay(o, { x: dx / d, y: 0, z: dz / d }, { maxDistance: d });
    return !!choque;
  } catch {
    return false;
  }
}
