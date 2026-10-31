import { VELOCIDAD } from "../config.js";
import { velocidad } from "../movimiento.js";
import { now } from "../util.js";
import { tickExcavar } from "./excavar.js";
import { tickPuente } from "./puente.js";
import { tickTorre } from "./torre.js";

const OBRAS = { torre: tickTorre, puente: tickPuente, excavar: tickExcavar };

// Ejecuta la obra corta en curso (torre, puente o abrirse paso). Devuelve true si
// la obra ocupó el turno.
export function tickObra(npc, state) {
  const o = state.obra;
  if (!o) return false;
  let fin;
  try {
    fin = OBRAS[o.tipo] ? OBRAS[o.tipo](npc, state) : true;
  } catch {
    fin = true;
  }
  if (fin) terminarObra(npc, state);
  return true;
}

export function terminarObra(npc, state) {
  state.obra = undefined;
  state.ocupadoHasta = now() + 4;
  velocidad(npc, VELOCIDAD.caminar);
}
