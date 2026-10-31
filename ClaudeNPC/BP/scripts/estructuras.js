import { world } from "@minecraft/server";
import { now } from "./util.js";

// Registro de lo que construyen los Claudes (casas) y Claude Maestro (aulas), para
// no construir encima y para que al perseguirte no rompan sus propias obras.

const LISTAS = { casa: "claudenpc:casas", aula: "claudenpc:aulas" };
const RADIO = { casa: 5.5, aula: 8.5 };
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
  for (const tipo of Object.keys(LISTAS)) for (const e of leer(tipo)) cache.push({ ...e, r: RADIO[tipo] });
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
