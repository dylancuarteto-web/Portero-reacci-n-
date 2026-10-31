import { VELOCIDAD } from "../config.js";
import { velocidad } from "../movimiento.js";
import { now } from "../util.js";
import { tickPuente } from "./puente.js";
import { tickTorre } from "./torre.js";

// Ejecuta la obra corta en curso (torre o puente). Devuelve true si la obra ocupó el turno.
export function tickObra(npc, state) {
  const o = state.obra;
  if (!o) return false;
  let fin;
  try {
    fin = o.tipo === "torre" ? tickTorre(npc, state) : o.tipo === "puente" ? tickPuente(npc, state) : true;
  } catch {
    fin = true;
  }
  if (fin) {
    state.obra = undefined;
    state.ocupadoHasta = now() + 4;
    velocidad(npc, VELOCIDAD.caminar);
  }
  return true;
}
