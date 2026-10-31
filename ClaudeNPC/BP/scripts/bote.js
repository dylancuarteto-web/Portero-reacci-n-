import { system } from "@minecraft/server";
import { ANIM, BOTE, MODIFICA_MUNDO, PARTICLES, VELOCIDAD } from "./config.js";
import { sostener } from "./equipo.js";
import { ponerHaciendo } from "./iq.js";
import { caminarA, caminando, destinoActual, detener, velocidad } from "./movimiento.js";
import {
  animate, blockAt, distancia2D, esAgua, flat, impulse, mirarA, now, particleAt, sound, superficie, yawHacia,
} from "./util.js";

// Agua y bote. En el agua nunca se queda quieto: nada hacia la orilla (o hacia ti si
// te persigue) y sale saltando. Si hay mucha agua por delante saca un bote, se sube,
// rema girando poco a poco (como un jugador), se baja en la orilla y lo recoge.
// Si algo falla (no pudo subirse, el bote se atasca) se baja y sigue nadando.

const botes = new Map();

export function enBote(npc) {
  return botes.has(npc.id);
}

// ¿Hay agua justo delante (en dirección al destino)?
export function aguaDelante(npc, destino) {
  const d = flat(npc.location, destino);
  return esAgua(blockAt(npc.dimension, { x: npc.location.x + d.x * 1.4, y: npc.location.y - 1, z: npc.location.z + d.z * 1.4 }));
}

// Agua profunda bajo sus pies (no un charco).
export function aguaProfunda(npc) {
  return npc.isInWater && esAgua(blockAt(npc.dimension, { x: npc.location.x, y: npc.location.y - 1, z: npc.location.z }));
}

// ¿Lago o río grande alrededor? (casi todo agua a 6 bloques)
function muchaAgua(npc) {
  let n = 0;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    if (esAgua(superficie(npc.dimension, npc.location.x + Math.cos(a) * 6, npc.location.z + Math.sin(a) * 6))) n++;
  }
  return n >= 6;
}

// Busca un punto de agua (superficie) alrededor de "origen", entre rmin y rmax bloques.
export function buscarAgua(dimension, origen, rmin, rmax) {
  for (let r = rmin; r <= rmax; r += 2) {
    const pasos = Math.max(8, Math.round(r * 1.5));
    const inicio = Math.random() * Math.PI * 2;
    for (let i = 0; i < pasos; i++) {
      const a = inicio + (i / pasos) * Math.PI * 2;
      const top = superficie(dimension, origen.x + Math.cos(a) * r, origen.z + Math.sin(a) * r);
      if (esAgua(top)) return { x: top.location.x + 0.5, y: top.location.y + 1, z: top.location.z + 0.5 };
    }
  }
  return undefined;
}

// Busca orilla (suelo seco junto al agua) cerca: la más cercana primero.
export function buscarOrilla(dimension, origen, rmax = 24) {
  for (let r = 2; r <= rmax; r += 2) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const top = superficie(dimension, origen.x + Math.cos(a) * r, origen.z + Math.sin(a) * r);
      if (top && !top.isLiquid && !esAgua(top) && Math.abs(top.location.y + 1 - origen.y) < 3) {
        return { x: top.location.x + 0.5, y: top.location.y + 1, z: top.location.z + 0.5 };
      }
    }
  }
  return undefined;
}

export function subirABote(npc, state, destino, paseo = false) {
  if (botes.has(npc.id) || now() < (state.cd.bote ?? 0)) return false;
  let pos;
  if (npc.isInWater) {
    pos = { x: npc.location.x, y: Math.floor(npc.location.y) + 0.9, z: npc.location.z };
  } else {
    const d = flat(npc.location, destino);
    const f = { x: npc.location.x + d.x * 1.4, y: npc.location.y - 1, z: npc.location.z + d.z * 1.4 };
    if (!esAgua(blockAt(npc.dimension, f))) return false;
    pos = { x: Math.floor(f.x) + 0.5, y: Math.floor(f.y) + 0.9, z: Math.floor(f.z) + 0.5 };
  }
  detener(npc);
  sostener(npc, "minecraft:oak_boat");
  mirarA(npc, pos);
  animate(npc, ANIM.colocar);
  let boat;
  try {
    boat = npc.dimension.spawnEntity("minecraft:boat", pos);
  } catch {
    state.cd.bote = now() + 600;
    return false;
  }
  sound(npc, "random.splash", 1.2, 0.6);
  const entrada = { npc, boat, destino: { ...destino }, inicio: now(), yaw: yawHacia(pos, destino), paseo, llego: false, lento: 0 };
  botes.set(npc.id, entrada);
  state.bote = entrada;
  state.ocupadoHasta = now() + 10;
  ponerHaciendo(npc, state, paseo ? "paseando en bote" : "en bote");
  system.runTimeout(() => {
    try {
      const ok = boat.getComponent("minecraft:rideable")?.addRider(npc);
      if (!ok) return bajar(npc, state, true);
      sostener(npc, "minecraft:air");
    } catch {
      bajar(npc, state, true);
    }
  }, 6);
  return true;
}

export function rumboBote(npc, destino) {
  const e = botes.get(npc.id);
  if (e) e.destino = { ...destino };
}

// Se baja del bote y lo recoge. Si fue por un fallo, no vuelve a intentarlo en un rato.
export function bajar(npc, state, fallo = false) {
  const e = botes.get(npc.id);
  botes.delete(npc.id);
  state.bote = undefined;
  state.cd.bote = now() + (fallo ? 900 : 300);
  velocidad(npc, VELOCIDAD.caminar);
  if (!e) return;
  try {
    e.boat.getComponent("minecraft:rideable")?.ejectRider(npc);
  } catch {
    // Ya no iba montado.
  }
  system.runTimeout(() => {
    if (!npc.isValid) return;
    const d = flat(npc.location, e.destino);
    impulse(npc, { x: d.x * 0.3, y: 0.42, z: d.z * 0.3 });
  }, 2);
  system.runTimeout(() => {
    try {
      if (e.boat.isValid) {
        particleAt(e.boat.dimension, PARTICLES.construir, e.boat.location);
        e.boat.remove();
      }
    } catch {
      // El bote ya no existe.
    }
    if (!npc.isValid) return;
    sound(npc, "random.pop", 1);
  }, 12);
}

// Si llegó a la orilla o al destino (o algo falló), se baja.
export function tickBote(npc, state) {
  const e = botes.get(npc.id);
  if (!e) {
    state.bote = undefined;
    return;
  }
  if (e.llego || e.fallo) bajar(npc, state, !!e.fallo);
}

// En el agua sin bote: nada hacia el jugador (si pelea) o hacia la orilla.
// Devuelve true si se ocupó del turno.
export function tickAgua(npc, state, jugador) {
  if (state.bote || !aguaProfunda(npc)) {
    state.nado = undefined;
    return false;
  }
  velocidad(npc, VELOCIDAD.caminar); // nunca "tieso" en el agua
  state.nado ??= { desde: now() };
  const n = state.nado;
  if (!n.orilla || now() - (n.buscada ?? 0) > 200) {
    n.orilla = buscarOrilla(npc.dimension, npc.location, 32);
    n.buscada = now();
  }
  const destino = state.hostil && jugador ? jugador.location : n.orilla;
  ponerHaciendo(npc, state, "nadando");
  if (!destino) {
    // Sin orilla a la vista: nada en línea recta hacia donde mira.
    const v = npc.getViewDirection();
    if (!caminando(npc)) caminarA(npc, { x: npc.location.x + v.x * 8, y: npc.location.y, z: npc.location.z + v.z * 8 }, 0.14);
    return true;
  }
  if (MODIFICA_MUNDO && distancia2D(npc.location, destino) > 10 && muchaAgua(npc) && subirABote(npc, state, destino)) return true;
  const actual = destinoActual(npc);
  if (!caminando(npc) || !actual || distancia2D(actual, destino) > 2) caminarA(npc, destino, 0.15);
  return true;
}

// Remo: un tick por bote. Gira gradualmente hacia el destino y empuja hacia delante.
system.runInterval(() => {
  for (const [id, e] of botes) {
    const { npc, boat } = e;
    if (!npc.isValid || !boat.isValid) {
      botes.delete(id);
      try {
        if (boat.isValid) boat.remove();
        if (npc.isValid) velocidad(npc, VELOCIDAD.caminar);
      } catch {
        // Nada que limpiar.
      }
      continue;
    }
    try {
      const t = now() - e.inicio;
      // ¿De verdad va montado? Si no, se cancela y vuelve a nadar.
      if (t > 14 && npc.getComponent("minecraft:riding")?.entityRidingOn?.id !== boat.id) {
        e.fallo = true;
        continue;
      }
      const d = flat(boat.location, e.destino);
      const diff = ((yawHacia(boat.location, e.destino) - e.yaw + 540) % 360) - 180;
      e.yaw += Math.max(-4, Math.min(4, diff));
      boat.setRotation({ x: 0, y: e.yaw });
      const rad = (e.yaw * Math.PI) / 180;
      const fx = -Math.sin(rad);
      const fz = Math.cos(rad);
      const v = boat.getVelocity();
      const rapidez = Math.hypot(v.x, v.z);
      if (t > 8 && Math.abs(diff) < 70 && rapidez < BOTE.velocidad && d.d > 1.5) {
        boat.applyImpulse({ x: fx * 0.035, y: 0, z: fz * 0.035 });
      }
      // Atascado contra algo: gira; si sigue atascado, se baja.
      e.lento = t > 30 && rapidez < 0.03 ? e.lento + 1 : 0;
      if (e.lento === 40) e.yaw += 90;
      if (e.lento > 100) e.llego = true;
      if (t % 24 === 8) {
        animate(npc, ANIM.remar);
        particleAt(boat.dimension, PARTICLES.remo, { x: boat.location.x - fz * 0.9, y: boat.location.y + 0.2, z: boat.location.z + fx * 0.9 });
        particleAt(boat.dimension, PARTICLES.remo, { x: boat.location.x + fz * 0.9, y: boat.location.y + 0.2, z: boat.location.z - fx * 0.9 });
        sound(npc, "random.swim", 1.4, 0.25);
      }
      const delante = blockAt(boat.dimension, { x: boat.location.x + fx * 1.4, y: boat.location.y + 0.4, z: boat.location.z + fz * 1.4 });
      const orilla = delante && !delante.isAir && !delante.isLiquid;
      if (t > 40 && (d.d < 2.2 || orilla)) e.llego = true;
      if (t > 20 * 90) e.llego = true; // no se queda remando para siempre
    } catch {
      botes.delete(id);
    }
  }
}, 1);
