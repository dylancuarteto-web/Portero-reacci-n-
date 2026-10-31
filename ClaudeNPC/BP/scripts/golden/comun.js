import { EntityDamageCause, GameMode } from "@minecraft/server";
import { PARTICLES } from "../config.js";
import { flat, now, particleAt, superficie } from "../util.js";

// Herramientas comunes de Claude Golden y sus poderes.

export const goldens = new Map(); // id → estado del jefe
export const historial = new Map(); // jugador → posiciones de los últimos segundos

// Jugadores a los que puede atacar (no creativo ni espectador).
export function objetivos(dimension, location, radio) {
  try {
    return dimension.getPlayers({ location, maxDistance: radio, excludeGameModes: [GameMode.Creative, GameMode.Spectator] });
  } catch {
    return [];
  }
}

export function danar(jugador, cantidad, golden, causa = EntityDamageCause.magic) {
  try {
    jugador.applyDamage(cantidad, golden?.isValid ? { cause: causa, damagingEntity: golden } : { cause: causa });
    return true;
  } catch {
    return false;
  }
}

export function empujar(jugador, desde, fuerza, alto) {
  try {
    const d = flat(desde, jugador.location);
    jugador.applyKnockback({ x: d.x * fuerza, z: d.z * fuerza }, alto);
  } catch {
    // Jugador no disponible.
  }
}

// Nombre del poder en la barra de acción de los jugadores cercanos.
export function anunciar(g, nombre, color = "§6") {
  g.anuncioHasta = now() + 50;
  for (const p of objetivos(g.entidad.dimension, g.entidad.location, 48)) {
    try {
      p.onScreenDisplay.setActionBar(`§6Claude Golden: ${color}§l« ${nombre} »`);
    } catch {
      // Sin pantalla.
    }
  }
}

export function avisarJugador(jugador, texto) {
  try {
    jugador.onScreenDisplay.setActionBar(texto);
  } catch {
    // Sin pantalla.
  }
}

// Suelo (bloque de aire sobre algo sólido) cerca de una altura de referencia.
export function sueloEn(dimension, x, z, yRef, rango = 6) {
  const top = superficie(dimension, x, z);
  if (!top || top.isLiquid || Math.abs(top.location.y + 1 - yRef) > rango) return undefined;
  return { x: Math.floor(x) + 0.5, y: top.location.y + 1, z: Math.floor(z) + 0.5 };
}

export function aviso(dimension, p) {
  particleAt(dimension, PARTICLES.aviso, { x: p.x, y: p.y + 0.06, z: p.z });
}

export function estallido(dimension, p) {
  particleAt(dimension, PARTICLES.estallido, p);
  particleAt(dimension, PARTICLES.bloqueo, p);
}

export function lerp(a, b, k) {
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k };
}

// Posición del jugador hace "ticks" ticks (para rebobinar).
export function posicionHace(jugador, ticks) {
  const h = historial.get(jugador.id) ?? [];
  return h.find((p) => now() - p.t >= ticks && p.dim === jugador.dimension.id);
}
