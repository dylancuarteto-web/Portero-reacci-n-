import { world } from "@minecraft/server";
import { IQ, PARTICLES } from "./config.js";
import { burst } from "./util.js";

// IQ del NPC: experiencia que gana observando al jugador y peleando. Se guarda en
// la entidad y en el mundo, así cada Claude nuevo hereda parte de lo aprendido.

export function cargarIQ(npc) {
  const propio = npc.getDynamicProperty(IQ.propiedad);
  if (typeof propio === "number") return propio;
  const global = world.getDynamicProperty(IQ.global);
  return typeof global === "number" ? Math.max(IQ.inicial, Math.round(global * 0.85)) : IQ.inicial;
}

export function mostrarIQ(npc, state) {
  const iq = Math.floor(state.iq);
  const color = iq >= 200 ? "§d" : iq >= 140 ? "§b" : iq >= 100 ? "§a" : "§e";
  npc.nameTag = `${color}IQ ${iq}§r\nClaude`;
}

// Sube el IQ. Cada 5 puntos enteros muestra una chispa de "idea".
export function aprender(npc, state, puntos) {
  const antes = Math.floor(state.iq / 5);
  state.iq = Math.min(IQ.maximo, state.iq + puntos);
  try {
    npc.setDynamicProperty(IQ.propiedad, state.iq);
    const global = world.getDynamicProperty(IQ.global);
    if (typeof global !== "number" || state.iq > global) world.setDynamicProperty(IQ.global, state.iq);
  } catch {
    // Entidad descargada.
  }
  if (Math.floor(state.iq / 5) > antes) burst(npc, PARTICLES.idea, { x: 0, y: 2.4, z: 0 });
  mostrarIQ(npc, state);
}

// 0 con IQ inicial, 1 con IQ máximo: escala la habilidad en todas las tácticas.
export function nivel(state) {
  return (state.iq - IQ.inicial) / (IQ.maximo - IQ.inicial);
}
