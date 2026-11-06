import { system, world } from "@minecraft/server";
import { now } from "./util.js";

// Daño compatible con Minecraft 1.21.132 (Script API 2.4.0).
//
// Hasta la v8.2 el add-on cancelaba o cambiaba los golpes ANTES de que llegaran
// (world.beforeEvents.entityHurt), pero ese evento no existe en la 1.21.132. Ahora:
//   1. Las entidades del add-on tienen sensores de daño (minecraft:damage_sensor) que leen
//      ETIQUETAS: el script pone y quita las etiquetas según el estado (fusión, escudo
//      levantado, sin daño por caída, cinemática...) y el propio juego cancela el golpe.
//   2. Los golpes que matarían a un jefe (o que el add-on quiere ver antes de que maten) no
//      se aplican: el sensor lanza el evento "claudenpc:golpe_fatal" y el script decide
//      (Golden empieza su muerte, el Robot multi se apaga, una marioneta se deshace...).
//   3. Lo que se cambiaba en el momento (golpes máximos, daño doble, la mitad con escudo)
//      se ajusta justo después del golpe devolviendo o quitando vida.
// Así funciona igual en la 1.21.132 y en las versiones nuevas.

export const TAG = {
  intocable: "claudenpc_intocable", // no recibe daño (fusión, cinemáticas, Golden curándose)
  sinCaida: "claudenpc_sin_caida", // sin daño por caída (water drop, clutch, maza, plataforma)
  escudo: "claudenpc_escudo", // escudo arriba y el jugador enfrente: para golpes sin hacha
  escudoFlechas: "claudenpc_escudo_flechas", // escudo arriba hacia quien dispara: para flechas
  esquiva: "claudenpc_esquiva", // reflejos 5: este golpe le da a un reflejo
  refleja: "claudenpc_refleja", // Golden: devuelve las flechas
  escudoRobot: "claudenpc_escudo_robot", // escudo de energía del robot
};

export const EVENTO = {
  fatal: "claudenpc:golpe_fatal",
  bloqueo: "claudenpc:bloqueo",
  esquiva: "claudenpc:esquiva",
  refleja: "claudenpc:refleja",
};

// Pone o quita una etiqueta solo si cambia (así no se manda nada al cliente cada tick).
export function etiqueta(e, tag, si) {
  try {
    if (!e?.isValid) return;
    if (si) {
      if (!e.hasTag(tag)) e.addTag(tag);
    } else if (e.hasTag(tag)) {
      e.removeTag(tag);
    }
  } catch {
    // Entidad descargada.
  }
}

// --- Quién golpeó a quién -----------------------------------------------------------------
// Los sensores avisan del golpe pero no dicen quién fue: se anota con los eventos de golpe y
// de proyectil (que llegan aunque el sensor haya cancelado el daño).
const golpes = new Map();

world.afterEvents.entityHitEntity.subscribe(({ damagingEntity, hitEntity }) => {
  try {
    golpes.set(hitEntity.id, { quien: damagingEntity, proyectil: undefined, t: now() });
  } catch {
    // Sin datos.
  }
});

world.afterEvents.projectileHitEntity.subscribe((ev) => {
  try {
    const hit = ev.getEntityHit()?.entity;
    if (hit) golpes.set(hit.id, { quien: ev.source, proyectil: ev.projectile, t: now() });
  } catch {
    // Sin datos.
  }
});

world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => golpes.delete(removedEntityId));

system.runInterval(() => {
  const t = now();
  for (const [id, g] of golpes) if (t - g.t > 200) golpes.delete(id);
}, 200);

// El último golpe que recibió (si fue hace poco).
export function ultimoGolpe(e, ventana = 4) {
  try {
    const g = golpes.get(e.id);
    return g && now() - g.t <= ventana ? g : undefined;
  } catch {
    return undefined;
  }
}

// --- Eventos de los sensores --------------------------------------------------------------
const oyentes = new Map();

// fn(entidad, golpe) cuando el sensor de una entidad de ese tipo lanza ese evento. Se llama
// un tick después, cuando ya se sabe quién golpeó.
export function alSensor(evento, tipos, fn) {
  const lista = oyentes.get(evento) ?? [];
  lista.push({ tipos: new Set(tipos), fn });
  oyentes.set(evento, lista);
}

world.afterEvents.dataDrivenEntityTrigger.subscribe((ev) => {
  const lista = oyentes.get(ev.eventId);
  if (!lista) return;
  const e = ev.entity;
  let tipo;
  try {
    tipo = e.typeId;
  } catch {
    return;
  }
  system.run(() => {
    if (!e.isValid) return;
    const g = ultimoGolpe(e);
    for (const o of lista) {
      if (!o.tipos.has(tipo)) continue;
      try {
        o.fn(e, g);
      } catch {
        // Un oyente con error no frena a los demás.
      }
    }
  });
}, { eventTypes: Object.values(EVENTO) });

// --- Vida ----------------------------------------------------------------------------------
export function vida(e) {
  try {
    const h = e.getComponent("minecraft:health");
    return { h, actual: h?.currentValue ?? 0, max: h?.effectiveMax ?? 1 };
  } catch {
    return { h: undefined, actual: 0, max: 1 };
  }
}

export function ponerVida(e, valor) {
  try {
    const h = e.getComponent("minecraft:health");
    if (h) h.setCurrentValue(Math.max(0, Math.min(h.effectiveMax, valor)));
  } catch {
    // Sin vida.
  }
}

// Devuelve vida (para "cancelar" o reducir un golpe que ya se aplicó).
export function devolverVida(e, cantidad) {
  if (!(cantidad > 0)) return;
  const { actual } = vida(e);
  if (actual > 0) ponerVida(e, actual + cantidad);
}

// --- Jugadores en cinemáticas ---------------------------------------------------------------
// A los jugadores no se les puede poner sensores: mientras ven una cinemática tienen
// Resistencia V (no reciben daño) y resistencia al fuego. Se renueva mientras dure.
export function protegerJugador(p, ticks = 30) {
  try {
    p.addEffect("resistance", ticks, { amplifier: 4, showParticles: false });
    p.addEffect("fire_resistance", ticks, { amplifier: 0, showParticles: false });
  } catch {
    // Jugador desconectado.
  }
}

export function desprotegerJugador(p) {
  try {
    p.removeEffect("resistance");
    p.removeEffect("fire_resistance");
  } catch {
    // Jugador desconectado.
  }
}

// --- Niebla ---------------------------------------------------------------------------------
// Player.fogSettings no existe en la 1.21.132: se usa el comando /fog (mismo resultado).
export function niebla(p, idNiebla, etiquetaNiebla, poner) {
  try {
    if (poner) p.runCommand(`fog @s push ${idNiebla} ${etiquetaNiebla}`);
    else p.runCommand(`fog @s remove ${etiquetaNiebla}`);
    return true;
  } catch {
    return false;
  }
}
