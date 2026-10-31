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

  if (corre && dist > 7 && now() >= (state.cd.salto ?? 0) && Math.random() < 0.6) {
    state.cd.salto = now() + rand(12, 18);
    impulse(npc, { x: d.x * 0.08, y: 0.42, z: d.z * 0.08 });
    return;
  }
  // A media distancia, de vez en cuando rodea al jugador con un paso lateral suave
  // (nunca justo después de golpear ni con tirones).
  const n = nivel(state);
  if (dist > 2.6 && dist < 6 && now() >= (state.cd.lateral ?? 0) && now() - (state.ultimoGolpe ?? -100) > 14) {
    state.cd.lateral = now() + rand(40, 70);
    if (Math.random() < 0.15 + n * 0.3) {
      if (Math.random() < 0.4) state.lado = -(state.lado ?? 1);
      esquivar(npc, jugador, state.lado ?? 1);
    }
  }
}

// Paso lateral suave alrededor del jugador: acelera y frena poco a poco.
const esquivas = new Map();

export function esquivar(npc, objetivo, lado, ticks = 20, fuerza = 0.04) {
  esquivas.set(npc.id, { npc, objetivo, lado, desde: now(), ticks, fuerza });
}

system.runInterval(() => {
  for (const [id, e] of esquivas) {
    const t = now() - e.desde;
    if (!e.npc.isValid || !e.objetivo.isValid || t > e.ticks) {
      esquivas.delete(id);
      continue;
    }
    try {
      const d = flat(e.npc.location, e.objetivo.location);
      const k = Math.sin((t / e.ticks) * Math.PI) * e.fuerza * e.lado;
      impulse(e.npc, { x: -d.z * k, y: 0, z: d.x * k });
    } catch {
      esquivas.delete(id);
    }
  }
}, 1);

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

// Sube un escalón de un bloque: salta hacia delante y, si el salto no alcanzó (el
// motor de físicas a veces frena a los mobs contra el borde), termina de subir como
// lo haría un salto bien hecho. Así nunca se quedan trabados frente a un bloque.
export function escalar(npc, d) {
  const y0 = npc.location.y;
  impulse(npc, { x: d.x * 0.14, y: 0.46, z: d.z * 0.14 });
  system.runTimeout(() => {
    try {
      if (!npc.isValid || npc.location.y >= y0 + 0.75) return;
      const dim = npc.dimension;
      const x = Math.floor(npc.location.x + d.x * 0.85);
      const z = Math.floor(npc.location.z + d.z * 0.85);
      const y = Math.floor(y0) + 1;
      const suelo = blockAt(dim, { x, y: y - 1, z });
      if (!suelo || reemplazable(suelo) || suelo.isLiquid) return;
      if (!reemplazable(blockAt(dim, { x, y, z })) || !reemplazable(blockAt(dim, { x, y: y + 1, z }))) return;
      npc.teleport({ x: x + 0.5, y, z: z + 0.5 }, { keepVelocity: false, rotation: npc.getRotation() });
    } catch {
      // Sin ayuda.
    }
  }, 9);
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
      if (npc.isOnGround && now() >= (m.saltoHasta ?? 0)) {
        const pie = delante(npc, d, 0.3);
        if (pie && !reemplazable(pie) && !pie.isLiquid && reemplazable(delante(npc, d, 1.3)) && reemplazable(delante(npc, d, 2.3))) {
          m.saltoHasta = now() + 14;
          escalar(npc, d);
          m.control = { ...npc.location }; // el salto cuenta como avance
          m.revision = now();
        }
      }
    } catch {
      motores.delete(id);
    }
  }
}, 1);
