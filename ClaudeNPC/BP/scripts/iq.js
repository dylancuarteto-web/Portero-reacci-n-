import { world } from "@minecraft/server";
import { IQ, PARTICLES } from "./config.js";
import { burst, now } from "./util.js";

// IQ del NPC: experiencia que gana observando al jugador, peleando, trabajando y
// en las clases de Claude Maestro. Se guarda en la entidad y en el mundo, así cada
// Claude nuevo hereda parte de lo aprendido.

export function cargarIQ(npc) {
  const propio = npc.getDynamicProperty(IQ.propiedad);
  if (typeof propio === "number") return propio;
  const global = world.getDynamicProperty(IQ.global);
  return typeof global === "number" ? Math.max(IQ.inicial, Math.round(global * 0.85)) : IQ.inicial;
}

// Nombre de tres líneas: IQ, "Claude · personalidad" y lo que está haciendo.
export function mostrarIQ(npc, state) {
  const iq = Math.floor(state.iq);
  const color = iq >= 200 ? "§d" : iq >= 140 ? "§b" : iq >= 100 ? "§a" : "§e";
  const bono = state.bono && now() < state.bono.hasta ? " §6x2" : "";
  const titulo = state.pers ? ` §8·§7 ${state.pers.titulo}` : "";
  const haciendo = state.haciendo ? `\n§o§7${state.haciendo}` : "";
  const texto = `${color}IQ ${iq}${bono}§r\nClaude${titulo}§r${haciendo}`;
  try {
    if (npc.nameTag !== texto) npc.nameTag = texto;
  } catch {
    // Entidad descargada.
  }
}

export function ponerHaciendo(npc, state, texto) {
  if (state.haciendo === texto) return;
  state.haciendo = texto;
  mostrarIQ(npc, state);
}

// Sube el IQ. Después de una clase aprende el doble durante un rato.
// Cada 5 puntos enteros muestra una chispa de "idea".
export function aprender(npc, state, puntos) {
  if (puntos > 0 && state.bono && now() < state.bono.hasta) puntos *= state.bono.x;
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
  if (!state.genio && state.iq >= IQ.maximo) {
    state.genio = true;
    try {
      for (const p of npc.dimension.getPlayers({ location: npc.location, maxDistance: 48 })) {
        p.onScreenDisplay.setActionBar("§d¡Un Claude alcanzó IQ 300! Con cinco juntos pasa algo especial...");
      }
    } catch {
      // Sin jugadores.
    }
  }
  mostrarIQ(npc, state);
}

// 0 con IQ inicial, 1 con IQ máximo: escala la habilidad en todas las tácticas.
export function nivel(state) {
  return (state.iq - IQ.inicial) / (IQ.maximo - IQ.inicial);
}
