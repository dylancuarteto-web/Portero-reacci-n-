import { VELOCIDAD } from "./config.js";
import { nivel } from "./iq.js";
import { flat, impulse, now, rand } from "./util.js";

// Movimiento parecido al de un jugador: camina cerca, corre si el jugador corre o
// se aleja, salta mientras corre (sprint-jump) y, con más IQ, se mueve de lado
// y retrocede tras golpear (w-tap). Sin impulsos bruscos.

export function velocidad(npc, valor) {
  try {
    npc.getComponent("minecraft:movement")?.setCurrentValue(valor);
  } catch {
    // Componente no disponible.
  }
}

export function ritmo(npc, state, jugador, dist) {
  const v = jugador.getVelocity();
  const jugadorCorre = Math.hypot(v.x, v.z) > 0.2;
  const corre = jugadorCorre || dist > 6;
  velocidad(npc, corre ? VELOCIDAD.correr : VELOCIDAD.caminar);
  if (!npc.isOnGround) return;
  const d = flat(npc.location, jugador.location);

  // Correr saltando, como hace un jugador para ir más rápido.
  if (corre && dist > 7 && now() >= (state.cd.salto ?? 0) && Math.random() < 0.7) {
    state.cd.salto = now() + rand(11, 15);
    impulse(npc, { x: d.x * 0.1, y: 0.42, z: d.z * 0.1 });
    return;
  }
  // Cuerpo a cuerpo: paso lateral suave; cambia de lado de vez en cuando.
  const n = nivel(state);
  if (dist < 4 && now() >= (state.cd.lateral ?? 0) && Math.random() < 0.25 + n * 0.5) {
    state.cd.lateral = now() + rand(12, 22);
    if (Math.random() < 0.35) state.lado = -(state.lado ?? 1);
    const s = (state.lado ?? 1) * 0.11;
    impulse(npc, { x: -d.z * s, y: 0, z: d.x * s });
  }
}

// Tras acertar un golpe, retrocede un poco para no recibir el contraataque.
export function wTap(npc, jugador, state) {
  if (nivel(state) < 0.1 || !npc.isOnGround) return;
  const d = flat(npc.location, jugador.location);
  impulse(npc, { x: -d.x * 0.16, y: 0, z: -d.z * 0.16 });
}
