import { NPC } from "./config.js";
import { armaInicial, pico, sostener, vestir } from "./equipo.js";
import { cargarIQ, mostrarIQ } from "./iq.js";
import { cargarPersonalidad } from "./personalidad.js";
import { reiniciarPostura } from "./postura.js";

// Estado en memoria de cada Claude (lo comparten combate, rutina, obras, bote,
// clases y fusión).
export const estados = new Map();

export function obtenerEstado(npc) {
  let s = estados.get(npc.id);
  if (!s) {
    s = {
      npc, arma: armaInicial(), nivelPico: 0, nivelArmadura: 0, minados: 0, ocupadoHasta: 0, sinCaidaHasta: 0, cd: {},
      iq: cargarIQ(npc), memoria: { torres: 0, arco: 0, golpes: 0, bloqueos: 0, exitos: {} },
      obra: undefined, casa: undefined, bote: undefined, fusion: false, reunion: undefined, clase: undefined,
      actividad: undefined, recientes: [], escudoArriba: false, provocadoHasta: 0,
    };
    estados.set(npc.id, s);
    s.pers = cargarPersonalidad(npc);
    // Cada Claude empieza su día a su ritmo: no todos a la vez.
    s.ocupadoHasta = Math.floor(Math.random() * 60);
    reiniciarPostura(npc, s);
    mostrarIQ(npc, s);
    vestir(npc, 0);
    sostener(npc, pico(s));
    sostener(npc, "minecraft:shield", "slot.weapon.offhand");
  }
  s.npc = npc;
  return s;
}

export function esClaude(entity) {
  return entity?.typeId === NPC;
}
