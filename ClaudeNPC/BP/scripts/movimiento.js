import { system } from "@minecraft/server";
import { VELOCIDAD } from "./config.js";
import { nivel } from "./iq.js";
import { blockAt, flat, impulse, now, rand, reemplazable, yawHacia } from "./util.js";

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

  if (corre && dist > 7 && now() >= (state.cd.salto ?? 0) && Math.random() < 0.7) {
    state.cd.salto = now() + rand(11, 15);
    impulse(npc, { x: d.x * 0.1, y: 0.42, z: d.z * 0.1 });
    return;
  }
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

// --- Motor de pasos: camina hasta un punto con control de velocidad por tick ---

const motores = new Map();

export function caminarA(npc, destino, rapidez = 0.2) {
  motores.set(npc.id, { npc, destino: { ...destino }, rapidez, desde: now() });
}

export function detener(npc) {
  motores.delete(npc.id);
}

export function caminando(npc) {
  return motores.has(npc.id);
}

system.runInterval(() => {
  for (const [id, m] of motores) {
    const npc = m.npc;
    if (!npc.isValid || now() - m.desde > 400) {
      motores.delete(id);
      continue;
    }
    try {
      const d = flat(npc.location, m.destino);
      const v = npc.getVelocity();
      if (d.d < 0.3) {
        motores.delete(id);
        impulse(npc, { x: -v.x * 0.7, y: 0, z: -v.z * 0.7 });
        continue;
      }
      const quiero = Math.min(m.rapidez, d.d * 0.45);
      // En el suelo la fricción frena mucho: se compensa como lo haría la entrada de un jugador.
      const k = npc.isOnGround ? 1.8 : 0.35;
      impulse(npc, { x: d.x * quiero * k - v.x * (npc.isOnGround ? 1 : 0.3), y: 0,
        z: d.z * quiero * k - v.z * (npc.isOnGround ? 1 : 0.3) });
      npc.setRotation({ x: 0, y: yawHacia(npc.location, m.destino) });
      if (npc.isOnGround) {
        const pie = blockAt(npc.dimension, { x: npc.location.x + d.x * 0.7, y: npc.location.y + 0.3, z: npc.location.z + d.z * 0.7 });
        const cabeza = blockAt(npc.dimension, { x: npc.location.x + d.x * 0.7, y: npc.location.y + 1.3, z: npc.location.z + d.z * 0.7 });
        if (pie && !reemplazable(pie) && !pie.isLiquid && reemplazable(cabeza)) impulse(npc, { x: 0, y: 0.42, z: 0 });
      }
    } catch {
      motores.delete(id);
    }
  }
}, 1);
