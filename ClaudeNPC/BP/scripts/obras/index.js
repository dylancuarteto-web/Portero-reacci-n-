import { system } from "@minecraft/server";
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
  // Una vez por tick como mucho (las torres también las mueve el bucle rápido de abajo).
  if (o.tick === now()) return true;
  o.tick = now();
  if (o.tipo === "torre") rapidas.set(npc.id, { npc, state });
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

// Las torres van al ritmo de un jugador que hace "pillar up": se revisan cada tick (el
// cerebro del Claude solo piensa cada 4), así suben unos 3 bloques por segundo.
const rapidas = new Map();
system.runInterval(() => {
  for (const [id, x] of rapidas) {
    if (!x.npc.isValid || x.state.obra?.tipo !== "torre") {
      rapidas.delete(id);
      continue;
    }
    try {
      tickObra(x.npc, x.state);
    } catch {
      rapidas.delete(id);
    }
  }
}, 1);
