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
  const color = iq >= 1000 ? "§6§l" : iq >= 500 ? "§c" : iq >= 200 ? "§d" : iq >= 140 ? "§b" : iq >= 100 ? "§a" : "§e";
  const bono = state.bono && now() < state.bono.hasta ? ` §6x${state.bono.x}` : "";
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
  if (!state.aviso500 && state.iq >= IQ.robot) {
    state.aviso500 = true;
    avisarCerca(npc, "§c¡Un Claude llegó a IQ 500! Cinco así juntos construyen un robot...");
  }
  if (!state.genio && state.iq >= IQ.maximo) {
    state.genio = true;
    avisarCerca(npc, "§6§l¡IQ 1000! §r§dCon cinco Claudes así pasa algo legendario...");
  }
  mostrarIQ(npc, state);
}

function avisarCerca(npc, texto) {
  try {
    for (const p of npc.dimension.getPlayers({ location: npc.location, maxDistance: 48 })) p.onScreenDisplay.setActionBar(texto);
  } catch {
    // Sin jugadores.
  }
}

// 0 con IQ inicial, 1 desde IQ 300: escala la habilidad en todas las tácticas
// (más allá de 300 el IQ sirve para el robot y la fusión).
export function nivel(state) {
  return Math.max(0, Math.min(1, (state.iq - IQ.inicial) / (IQ.habilidad - IQ.inicial)));
}
