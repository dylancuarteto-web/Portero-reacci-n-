// Efectos visuales y sonoros. Todas las llamadas son tolerantes a fallos
// (chunks descargados, entidades eliminadas) para no romper las habilidades.
import { MolangVariableMap } from "@minecraft/server";
import { circlePoint } from "./vec.js";

/** Entidades de efecto vivas (para limpieza garantizada). */
const liveFx = new Map(); // id -> { entity, owner }

/**
 * @param {import("@minecraft/server").Dimension} dim
 * @param {string} id
 * @param {import("@minecraft/server").Vector3} loc
 * @param {Record<string, number>} [vars]
 */
export function particle(dim, id, loc, vars) {
  try {
    if (vars) {
      const m = new MolangVariableMap();
      for (const k in vars) m.setFloat("variable." + k, vars[k]);
      dim.spawnParticle("lacobra:" + id, loc, m);
    } else {
      dim.spawnParticle("lacobra:" + id, loc);
    }
  } catch {
    // ubicación no cargada: se ignora
  }
}

/** Partículas repartidas sobre un círculo horizontal. */
export function ringOf(dim, id, center, radius, count, h = 0, offsetDeg = 0, vars) {
  for (let i = 0; i < count; i++) {
    particle(dim, id, circlePoint(center, radius, offsetDeg + (360 / count) * i, h), vars);
  }
}

export function sound(dim, id, loc, volume = 1, pitch = 1) {
  try {
    dim.playSound("lacobra." + id, loc, { volume, pitch });
  } catch {
    // sin oyentes o ubicación inválida
  }
}

export function playerSound(player, id, volume = 1, pitch = 1) {
  try {
    player.playSound("lacobra." + id, { volume, pitch });
  } catch {
    // jugador desconectado
  }
}

export function anim(entity, name, blendOut = 0.2) {
  try {
    entity.playAnimation(name, { blendOutTime: blendOut });
  } catch {
    // entidad inválida
  }
}

/**
 * Crea una entidad de efecto y la registra para su limpieza.
 * @returns {import("@minecraft/server").Entity | undefined}
 */
export function spawnFx(dim, type, loc, owner) {
  try {
    const e = dim.spawnEntity(type, loc);
    liveFx.set(e.id, { entity: e, owner });
    return e;
  } catch {
    return undefined;
  }
}

export function removeFx(entity) {
  if (!entity) return;
  liveFx.delete(entity.id);
  try {
    if (entity.isValid) entity.remove();
  } catch {
    // ya eliminada
  }
}

/** Animación de desaparición y eliminación diferida (la hace quien llama vía tarea). */
export function vanish(entity, animation = "animation.lacobra.fx.vanish") {
  if (!entity || !entity.isValid) return;
  anim(entity, animation, 0);
}

export function removeOwnerFx(owner) {
  for (const [id, rec] of liveFx) {
    if (rec.owner === owner) {
      liveFx.delete(id);
      try {
        if (rec.entity.isValid) rec.entity.remove();
      } catch {
        // ignorado
      }
    }
  }
}

export function liveFxCount(owner) {
  let n = 0;
  for (const rec of liveFx.values()) if (!owner || rec.owner === owner) n++;
  return n;
}

export function effect(entity, id, seconds, amplifier = 0) {
  try {
    entity.addEffect(id, Math.round(seconds * 20), { amplifier, showParticles: false });
  } catch {
    // entidad inválida o efecto no aplicable
  }
}
