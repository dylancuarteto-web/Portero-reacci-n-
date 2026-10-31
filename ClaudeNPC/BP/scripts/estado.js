import { NPC } from "./config.js";
import { pico, sostener, vestir } from "./equipo.js";
import { cargarIQ, mostrarIQ } from "./iq.js";

// Estado en memoria de cada Claude (lo comparten combate, trabajo, obras, bote y fusión).
export const estados = new Map();

export function obtenerEstado(npc) {
  let s = estados.get(npc.id);
  if (!s) {
    s = {
      arma: 0, nivelPico: 0, nivelArmadura: 0, minados: 0, ocupadoHasta: 0, sinCaidaHasta: 0, cd: {},
      iq: cargarIQ(npc), memoria: { torres: 0, arco: 0, golpes: 0, exitos: {} },
      obra: undefined, casa: undefined, bote: undefined, fusion: false, reunion: undefined,
    };
    estados.set(npc.id, s);
    mostrarIQ(npc, s);
    vestir(npc, 0);
    sostener(npc, pico(s));
  }
  return s;
}

export function esClaude(entity) {
  return entity?.typeId === NPC;
}
