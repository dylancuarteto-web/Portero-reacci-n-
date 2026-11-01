import { system } from "@minecraft/server";
import { ANIM, PARTICLES } from "../config.js";
import { sostener } from "../equipo.js";
import { practicar, variante } from "../habilidades.js";
import { animate, burst, flat, now, particleAt, sound, soundAt } from "../util.js";

// Química (lo enseña sobre todo Claude Curie): pociones que prepara y usa en la pelea.
// 1 velocidad · 2 fuerza · 3 regeneración (cuando está herido) · 4 veneno (te la lanza)
// · 5 resistencia al fuego (y a los golpes) para pelear sin miedo a la lava.

function vida(npc) {
  try {
    const h = npc.getComponent("minecraft:health");
    return h ? h.currentValue / h.effectiveMax : 1;
  } catch {
    return 1;
  }
}

function beber(npc, s, efectos, color) {
  s.ocupadoHasta = now() + 22;
  sostener(npc, "minecraft:potion");
  animate(npc, ANIM.beber);
  for (const t of [4, 10, 16]) system.runTimeout(() => npc.isValid && sound(npc, "random.drink", 1, 0.7), t);
  system.runTimeout(() => {
    if (!npc.isValid) return;
    for (const [id, ticks, nivel] of efectos) {
      try {
        npc.addEffect(id, ticks, { amplifier: nivel, showParticles: true });
      } catch {
        // Efecto no disponible.
      }
    }
    burst(npc, color, { x: 0, y: 1.2, z: 0 });
    sound(npc, "random.burp", 1.2, 0.5);
  }, 18);
}

function lanzarVeneno(npc, s, jugador) {
  s.ocupadoHasta = now() + 20;
  sostener(npc, "minecraft:splash_potion");
  animate(npc, ANIM.lanzar);
  sound(npc, "random.bow", 0.5, 0.6);
  const v = jugador.getVelocity();
  const destino = { x: jugador.location.x + v.x * 10, y: jugador.location.y, z: jugador.location.z + v.z * 10 };
  const d = Math.hypot(destino.x - npc.location.x, destino.z - npc.location.z);
  const vuelo = Math.max(6, Math.min(20, Math.round(d * 1.2)));
  // Rastro del frasco en el aire.
  for (let t = 0; t <= vuelo; t += 2) {
    system.runTimeout(() => {
      if (!npc.isValid) return;
      const f = t / vuelo;
      particleAt(npc.dimension, PARTICLES.brilloVerde, {
        x: npc.location.x + (destino.x - npc.location.x) * f,
        y: npc.location.y + 1.6 + Math.sin(f * Math.PI) * 2.5 + (destino.y - npc.location.y) * f,
        z: npc.location.z + (destino.z - npc.location.z) * f,
      });
    }, t);
  }
  system.runTimeout(() => {
    if (!npc.isValid) return;
    const dim = npc.dimension;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      particleAt(dim, PARTICLES.brilloVerde, { x: destino.x + Math.cos(a) * 1.2, y: destino.y + 0.3, z: destino.z + Math.sin(a) * 1.2 });
    }
    soundAt(dim, destino, "random.glass", 1, 1);
    try {
      for (const p of dim.getPlayers({ location: destino, maxDistance: 2.8 })) p.addEffect("poison", 110, { amplifier: 0 });
    } catch {
      // Sin efecto.
    }
  }, vuelo);
}

// Acción del nodo "pocion" en combate.
export function usarPocion(npc, s, jugador) {
  let n = variante(npc, s, "quimica");
  if (!n) return;
  // Herido y sabe hacer regeneración: eso primero.
  if (vida(npc) < 0.55 && n >= 3 && Math.random() < 0.7) n = 3;
  if (n === 4 && Math.hypot(jugador.location.x - npc.location.x, jugador.location.z - npc.location.z) > 14) n = 1;
  if (n === 1) beber(npc, s, [["speed", 400, 1]], PARTICLES.idea);
  else if (n === 2) beber(npc, s, [["strength", 400, 0]], PARTICLES.chispaCae);
  else if (n === 3) beber(npc, s, [["regeneration", 160, 1]], PARTICLES.confeti);
  else if (n === 4) lanzarVeneno(npc, s, jugador);
  else beber(npc, s, [["fire_resistance", 1200, 0], ["resistance", 400, 0]], PARTICLES.sol);
  practicar(npc, s, "quimica", 0.05);
  const dir = flat(npc.location, jugador.location);
  try {
    npc.setRotation({ x: 0, y: (Math.atan2(-dir.x, dir.z) * 180) / Math.PI });
  } catch {
    // Sin giro.
  }
}
