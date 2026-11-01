import { world } from "@minecraft/server";
import { blockAt, now } from "./util.js";

// Registro de lo que construyen los Claudes (casas) y Claude Maestro (aulas), para
// no construir encima y para que al perseguirte no rompan sus propias obras.

const LISTAS = { casa: "claudenpc:casas", aula: "claudenpc:aulas", proyecto: "claudenpc:proyectos" };
const RADIO = { casa: 5.5, aula: 8.5, proyecto: 5 };
let cache;
let cacheHasta = -1;

function leer(tipo) {
  try {
    const raw = world.getDynamicProperty(LISTAS[tipo]);
    const lista = typeof raw === "string" ? JSON.parse(raw) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

export function listar(tipo) {
  return leer(tipo);
}

export function registrar(tipo, datos) {
  const lista = leer(tipo).filter((e) => Math.hypot(e.x - datos.x, e.z - datos.z) > 1 || e.y !== datos.y);
  lista.push(datos);
  try {
    world.setDynamicProperty(LISTAS[tipo], JSON.stringify(lista.slice(-50)));
  } catch {
    // Mundo sin espacio para propiedades.
  }
  cacheHasta = -1;
}

function todas() {
  if (now() < cacheHasta && cache) return cache;
  cache = [];
  for (const tipo of Object.keys(LISTAS)) for (const e of leer(tipo)) cache.push({ ...e, tipo, r: e.r ?? RADIO[tipo] });
  cacheHasta = now() + 100;
  return cache;
}

// ¿Este bloque es parte de una casa o un aula de los Claudes?
export function protegido(p) {
  for (const e of todas()) {
    if (Math.abs(p.x + 0.5 - (e.x + 0.5)) <= e.r && Math.abs(p.z + 0.5 - (e.z + 0.5)) <= e.r
      && p.y >= e.y - 1 && p.y <= e.y + 8) return true;
  }
  return false;
}

// ¿Hay alguna obra registrada a menos de "distancia" bloques?
export function ocupado(x, z, distancia) {
  return todas().some((e) => Math.hypot(e.x - x, e.z - z) < distancia + e.r);
}

// Igual, pero sin contar las obras para las que "salvo(e)" es true (su propia escuela).
export function ocupadoSalvo(x, z, distancia, salvo) {
  return todas().some((e) => !salvo(e) && Math.hypot(e.x - x, e.z - z) < distancia + e.r);
}

// --- Puertas: para entrar y salir de casas y aulas sin chocar con las paredes --------

const clave = (e) => `${e.tipo}|${e.x},${e.y},${e.z}`;

// ¿Está "p" dentro de una casa o un aula? (devuelve la obra o undefined)
export function estructuraEn(p) {
  for (const e of todas()) {
    if (e.tipo === "proyecto") continue;
    const dx = p.x - (e.x + 0.5);
    const dz = p.z - (e.z + 0.5);
    let ax = 2.9;
    let az = 2.9;
    if (e.tipo === "aula") {
      const largoEnZ = e.frente === "north" || e.frente === "south";
      ax = largoEnZ ? 4.9 : 5.9;
      az = largoEnZ ? 5.9 : 4.9;
    }
    if (Math.abs(dx) <= ax && Math.abs(dz) <= az && p.y >= e.y + 0.5 && p.y <= e.y + 5.5) return e;
  }
  return undefined;
}

export function mismaEstructura(a, b) {
  return (!a && !b) || (!!a && !!b && clave(a) === clave(b));
}

const puertas = new Map();

// Busca la puerta en el contorno de la casa o el aula.
export function puertaDe(dimension, e) {
  const k = clave(e);
  const guardada = puertas.get(k);
  if (guardada && now() < guardada.hasta) return guardada.puerta;
  let rx = 3;
  let rz = 3;
  if (e.tipo === "aula") {
    const largoEnZ = e.frente === "north" || e.frente === "south";
    rx = largoEnZ ? 5 : 6;
    rz = largoEnZ ? 6 : 5;
  }
  let puerta;
  for (let i = -rx; i <= rx && !puerta; i++) {
    for (let j = -rz; j <= rz && !puerta; j++) {
      if (Math.abs(i) !== rx && Math.abs(j) !== rz) continue;
      const pos = { x: e.x + i, y: e.y + 1, z: e.z + j };
      const b = blockAt(dimension, pos);
      if (!b || !/_door$/.test(b.typeId) || b.typeId === "minecraft:iron_door") continue;
      const out = Math.abs(i) === rx ? { x: Math.sign(i), z: 0 } : { x: 0, z: Math.sign(j) };
      puerta = {
        pos,
        dentro: { x: pos.x + 0.5 - out.x, y: pos.y, z: pos.z + 0.5 - out.z },
        fuera: { x: pos.x + 0.5 + out.x * 1.5, y: pos.y, z: pos.z + 0.5 + out.z * 1.5 },
      };
    }
  }
  puertas.set(k, { puerta, hasta: now() + (puerta ? 600 : 40) });
  return puerta;
}

// Al poner o quitar una puerta en una obra, se vuelve a buscar (así la ruta la usa ya).
export function olvidarPuertas() {
  puertas.clear();
}

// ¿El bloque "p" está dentro de otra obra registrada (hasta sus paredes)?
// "esPropia(e)" marca las obras que no cuentan (la que se está construyendo).
export function dentroDeOtra(p, esPropia) {
  for (const e of todas()) {
    if (esPropia?.(e)) continue;
    if (p.y < e.y - 1 || p.y > e.y + 12) continue;
    const dx = Math.abs(p.x - e.x);
    const dz = Math.abs(p.z - e.z);
    let ax = 4;
    let az = 4;
    if (e.tipo === "aula") {
      // Hasta las paredes (el alero no cuenta: así el aula vecina puede unir los techos).
      const largoEnZ = e.frente === "north" || e.frente === "south";
      ax = largoEnZ ? 5 : 6;
      az = largoEnZ ? 6 : 5;
    } else if (e.tipo === "proyecto") {
      ax = e.r ?? 5;
      az = e.r ?? 5;
    }
    if (dx <= ax && dz <= az) return true;
  }
  return false;
}

export const mismaObra = (tipo, c) => (e) => e.tipo === tipo && e.x === c.x && e.y === c.y && e.z === c.z;
