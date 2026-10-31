import { system } from "@minecraft/server";
import { ESCUDO, VELOCIDAD } from "./config.js";
import { nivel } from "./iq.js";
import { blockAt, esAgua, flat, impulse, now, rand, reemplazable, yawHacia } from "./util.js";

// Movimiento parecido al de un jugador: camina cerca, corre si el jugador corre o
// se aleja, salta mientras corre (sprint-jump) y, con más IQ, se mueve de lado
// y retrocede tras golpear (w-tap). Con el escudo arriba va despacio.

export function velocidad(npc, valor) {
  try {
    npc.getComponent("minecraft:movement")?.setCurrentValue(valor);
  } catch {
    // Componente no disponible.
  }
}

export function ritmo(npc, state, jugador, dist) {
  if (state.escudoArriba) {
    velocidad(npc, ESCUDO.lento);
    return;
  }
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

// --- Motor de pasos: camina (o nada) hasta un punto con control por tick ---

const motores = new Map();

const atascos = new Map();

export function caminarA(npc, destino, rapidez = 0.2) {
  motores.set(npc.id, { npc, destino: { ...destino }, rapidez, desde: now(), control: { ...npc.location }, revision: now() });
  atascos.delete(npc.id);
}

// ¿Su última caminata terminó porque algo le cerraba el paso?
export function seAtasco(npc) {
  return now() - (atascos.get(npc.id) ?? -1000) < 60;
}

export function detener(npc) {
  motores.delete(npc.id);
}

export function caminando(npc) {
  return motores.has(npc.id);
}

export function destinoActual(npc) {
  return motores.get(npc.id)?.destino;
}

function delante(npc, d, alto) {
  return blockAt(npc.dimension, { x: npc.location.x + d.x * 0.7, y: npc.location.y + alto, z: npc.location.z + d.z * 0.7 });
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
      // Si en 1,5 s casi no avanzó, algo le cierra el paso: deja de empujar contra la pared.
      if (now() - m.revision >= 30) {
        const avance = Math.hypot(npc.location.x - m.control.x, npc.location.z - m.control.z);
        if (avance < 0.4) {
          motores.delete(id);
          atascos.set(id, now());
          continue;
        }
        m.control = { ...npc.location };
        m.revision = now();
      }
      const enAgua = npc.isInWater;
      const quiero = Math.min(m.rapidez, d.d * 0.45);
      // En el suelo la fricción frena mucho: se compensa como lo haría la entrada de
      // un jugador. En el agua nada con brazadas suaves.
      const k = npc.isOnGround ? 1.8 : enAgua ? 0.9 : 0.35;
      const freno = npc.isOnGround ? 1 : enAgua ? 0.5 : 0.3;
      let vy = 0;
      if (enAgua) {
        const cabeza = blockAt(npc.dimension, { x: npc.location.x, y: npc.location.y + 1.5, z: npc.location.z });
        if (esAgua(cabeza)) vy = 0.05; // sube a respirar
        const pie = delante(npc, d, 0.3);
        if (pie && !reemplazable(pie) && !pie.isLiquid && reemplazable(delante(npc, d, 1.3)) && reemplazable(delante(npc, d, 2.1))) {
          vy = 0.34; // sale del agua a la orilla
        }
      }
      impulse(npc, { x: d.x * quiero * k - v.x * freno, y: vy, z: d.z * quiero * k - v.z * freno });
      npc.setRotation({ x: 0, y: yawHacia(npc.location, m.destino) });
      if (npc.isOnGround) {
        const pie = delante(npc, d, 0.3);
        const cabeza = delante(npc, d, 1.3);
        if (pie && !reemplazable(pie) && !pie.isLiquid && reemplazable(cabeza)) impulse(npc, { x: 0, y: 0.42, z: 0 });
      }
    } catch {
      motores.delete(id);
    }
  }
}, 1);
