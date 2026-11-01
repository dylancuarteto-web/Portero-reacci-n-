import { system, world } from "@minecraft/server";
import { ANIM, PARTICLES, REFLEJO } from "../config.js";
import { practicar, variante } from "../habilidades.js";
import { esquivar } from "../movimiento.js";
import { animate, burst, flat, impulse, now, particleAt, sound, soundAt } from "../util.js";

// Reflejos: copias de luz del Claude, con su mismo nombre, que corren hacia ti para
// que ataques a la equivocada. Nivel 1: un señuelo. 2: dos. 3: además cambia de
// lugar con uno de ellos. 4: un destello que te ciega un momento. 5 (lo usa
// solo cuando le pegas): esquiva el golpe y contraataca (ver contraataque()).

const reflejos = new Map(); // id → { e, dueno, jugador, hasta }

function romperReflejo(r) {
  reflejos.delete(r.e.id);
  try {
    if (!r.e.isValid) return;
    const l = r.e.location;
    for (const h of [0.5, 1.2, 1.9]) particleAt(r.e.dimension, PARTICLES.espejo, { x: l.x, y: l.y + h, z: l.z });
    soundAt(r.e.dimension, l, "random.glass", 1.3, 0.8);
    r.e.remove();
  } catch {
    // Ya no está.
  }
}

function crearReflejo(npc, jugador, pos) {
  try {
    const e = npc.dimension.spawnEntity(REFLEJO, pos);
    e.nameTag = npc.nameTag;
    e.teleport(pos, { facingLocation: jugador.getHeadLocation() });
    for (const h of [0.6, 1.4]) particleAt(npc.dimension, PARTICLES.espejo, { x: pos.x, y: pos.y + h, z: pos.z });
    reflejos.set(e.id, { e, dueno: npc, jugador, hasta: now() + 160, golpe: 0 });
    return e;
  } catch {
    return undefined;
  }
}

function aUnLado(npc, jugador, lado, dist = 1.8) {
  const d = flat(npc.location, jugador.location);
  return { x: npc.location.x - d.z * lado * dist, y: npc.location.y, z: npc.location.z + d.x * lado * dist };
}

// Acción del nodo "reflejo" en combate.
export function usarReflejo(npc, s, jugador) {
  const n = variante(npc, s, "reflejos");
  if (!n) return;
  s.ocupadoHasta = now() + 16;
  animate(npc, ANIM.lanzar);
  sound(npc, "beacon.activate", 1.8, 0.6);
  const lados = n >= 2 ? [-1, 1] : [Math.random() < 0.5 ? -1 : 1];
  const copias = lados.map((lado) => crearReflejo(npc, jugador, aUnLado(npc, jugador, lado))).filter((e) => !!e);
  // El verdadero se aparta hacia el lado contrario a su único reflejo.
  if (lados.length === 1) esquivar(npc, jugador, -lados[0], 16, 0.06);
  if (n >= 3 && copias.length) {
    // Cambio de lugar: aparece donde estaba uno de sus reflejos (y el reflejo donde estaba él).
    system.runTimeout(() => {
      const otra = copias.find((e) => e.isValid);
      if (!npc.isValid || !otra) return;
      try {
        const yo = { ...npc.location };
        const ella = { ...otra.location };
        burst(npc, PARTICLES.espejo, { x: 0, y: 1, z: 0 });
        npc.teleport(ella, { facingLocation: jugador.getHeadLocation() });
        otra.teleport(yo, { facingLocation: jugador.getHeadLocation() });
        sound(npc, "mob.shulker.teleport", 1.4, 0.7);
      } catch {
        // No se pudo cambiar.
      }
    }, 22);
  }
  if (n >= 4) {
    // Destello cegador: un fogonazo de luz entre los dos.
    system.runTimeout(() => {
      if (!npc.isValid || !jugador.isValid) return;
      const m = { x: (npc.location.x + jugador.location.x) / 2, y: jugador.location.y + 1.4, z: (npc.location.z + jugador.location.z) / 2 };
      particleAt(npc.dimension, PARTICLES.sol, m);
      particleAt(npc.dimension, PARTICLES.estallido, m);
      soundAt(npc.dimension, m, "random.explode", 2, 0.25);
      try {
        if (Math.hypot(jugador.location.x - npc.location.x, jugador.location.z - npc.location.z) < 14) {
          jugador.addEffect("blindness", 50, { amplifier: 0, showParticles: false });
        }
      } catch {
        // Sin efecto.
      }
    }, 8);
  }
  practicar(npc, s, "reflejos", 0.05);
}

// Nivel 5: cuando le pegas cuerpo a cuerpo a veces no le das: era un reflejo. Se
// aparta, la copia se rompe en tu cara y él te devuelve el golpe.
export function contraataque(npc, s, jugador, golpear) {
  const lado = Math.random() < 0.5 ? -1 : 1;
  const antes = { ...npc.location };
  const copia = crearReflejo(npc, jugador, antes);
  if (copia) system.runTimeout(() => {
    const r = reflejos.get(copia.id);
    if (r) romperReflejo(r);
  }, 6);
  try {
    npc.teleport(aUnLado(npc, jugador, lado, 1.6), { facingLocation: jugador.getHeadLocation(), checkForBlocks: true });
  } catch {
    // Sin sitio a un lado.
  }
  system.runTimeout(() => {
    if (!npc.isValid || !jugador.isValid) return;
    animate(npc, ANIM.espadazo);
    sound(npc, "game.player.attack.strong", 1.1, 0.8);
    golpear(npc, jugador, 6, 0.7, 0.35);
  }, 5);
  practicar(npc, s, "reflejos", 0.03);
}

// Los reflejos corren hacia el jugador (sin hacer daño: son luz) y se rompen al tocarlos.
system.runInterval(() => {
  for (const r of [...reflejos.values()]) {
    const e = r.e;
    if (!e.isValid || !r.jugador.isValid || now() > r.hasta) {
      romperReflejo(r);
      continue;
    }
    try {
      const d = flat(e.location, r.jugador.location);
      const v = e.getVelocity();
      if (d.d > 1.6) {
        impulse(e, { x: d.x * 0.2 - v.x * 0.6, y: 0, z: d.z * 0.2 - v.z * 0.6 });
        e.setRotation({ x: 0, y: (Math.atan2(-d.x, d.z) * 180) / Math.PI });
      } else if (now() >= r.golpe) {
        r.golpe = now() + 16;
        animate(e, ANIM.espadazo);
        sound(e, "game.player.attack.nodamage", 1.2, 0.6);
      }
    } catch {
      romperReflejo(r);
    }
  }
}, 2);

world.afterEvents.entityHurt.subscribe(({ hurtEntity }) => {
  if (hurtEntity.typeId !== REFLEJO) return;
  const r = reflejos.get(hurtEntity.id);
  if (r) romperReflejo(r);
});

world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
  const r = reflejos.get(deadEntity.id);
  if (r) reflejos.delete(deadEntity.id);
});

// Práctica en su tiempo libre: crea un reflejo a su lado, cambia de lugar con él y lo
// deshace (sin jugador cerca, el reflejo solo se queda quieto mirándolo).
export function reflejoDePractica(npc) {
  const v = npc.getViewDirection();
  const pos = { x: npc.location.x - v.z * 1.8, y: npc.location.y, z: npc.location.z + v.x * 1.8 };
  try {
    const e = npc.dimension.spawnEntity(REFLEJO, pos);
    e.nameTag = npc.nameTag;
    for (const h of [0.6, 1.4]) particleAt(npc.dimension, PARTICLES.espejo, { x: pos.x, y: pos.y + h, z: pos.z });
    sound(npc, "beacon.activate", 1.8, 0.4);
    system.runTimeout(() => {
      if (!npc.isValid || !e.isValid) return;
      const yo = { ...npc.location };
      try {
        npc.teleport({ ...e.location });
        e.teleport(yo);
      } catch {
        // Sin cambio.
      }
    }, 24);
    system.runTimeout(() => {
      if (!e.isValid) return;
      for (const h of [0.5, 1.2, 1.9]) particleAt(e.dimension, PARTICLES.espejo, { x: e.location.x, y: e.location.y + h, z: e.location.z });
      soundAt(e.dimension, e.location, "random.glass", 1.3, 0.6);
      e.remove();
    }, 50);
  } catch {
    // Sin reflejo.
  }
}
