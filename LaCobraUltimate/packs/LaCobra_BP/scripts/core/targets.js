// Selección de objetivos y aplicación de daño validada en el servidor.
import { world, EntityDamageCause, GameMode } from "@minecraft/server";
import { CONFIG } from "../config.js";
import { dist, flat, sub } from "./vec.js";

const IGNORE_FAMILIES = ["lacobra_fx", "lacobra_projectile", "inanimate"];
const IGNORE_TYPES = ["minecraft:item", "minecraft:xp_orb", "minecraft:arrow", "minecraft:armor_stand"];

export function pvpEnabled() {
  try {
    return world.gameRules.pvp;
  } catch {
    return true;
  }
}

function families(e) {
  try {
    return e.getComponent("minecraft:type_family");
  } catch {
    return undefined;
  }
}

export function isAlive(e) {
  if (!e || !e.isValid) return false;
  try {
    const h = e.getComponent("minecraft:health");
    return !h || h.currentValue > 0;
  } catch {
    return false;
  }
}

/** ¿Es un objetivo hostil válido para las habilidades de `caster`? */
export function isHostileTarget(e, caster) {
  if (!e || !e.isValid || e === caster || (caster && e.id === caster.id)) return false;
  if (!isAlive(e)) return false;
  const fam = families(e);
  if (e.typeId === "minecraft:player") {
    if (!pvpEnabled() || !caster || caster.typeId !== "minecraft:player") return false;
    try {
      const gm = /** @type {import("@minecraft/server").Player} */ (e).getGameMode();
      if (gm === GameMode.Creative || gm === GameMode.Spectator) return false;
    } catch {
      return false;
    }
    return true;
  }
  if (!fam) return false;
  return fam.hasTypeFamily("monster") || fam.hasTypeFamily("lacobra_boss") || fam.hasTypeFamily("lacobra_minion");
}

/**
 * Objetivos hostiles en un radio, ordenados por cercanía y limitados en número.
 * @param {import("@minecraft/server").Dimension} dim
 */
export function findTargets(dim, center, radius, caster, max = CONFIG.limites.maxObjetivosArea) {
  let list = [];
  try {
    list = dim.getEntities({
      location: center,
      maxDistance: radius,
      excludeFamilies: IGNORE_FAMILIES,
      excludeTypes: IGNORE_TYPES,
    });
  } catch {
    return [];
  }
  return list
    .filter((e) => isHostileTarget(e, caster))
    .sort((a, b) => dist(a.location, center) - dist(b.location, center))
    .slice(0, max);
}

/** Objetivo para Veneno: lo que el jugador mira o el hostil más cercano delante. */
export function pickTarget(player, range) {
  try {
    const hits = player.getEntitiesFromViewDirection({
      maxDistance: range,
      excludeFamilies: IGNORE_FAMILIES,
      excludeTypes: IGNORE_TYPES,
    });
    for (const h of hits) if (isHostileTarget(h.entity, player)) return h.entity;
  } catch {
    // sin línea de visión
  }
  const view = flat(player.getViewDirection());
  const cands = findTargets(player.dimension, player.location, Math.min(range, 16), player, 20);
  for (const e of cands) {
    const d = flat(sub(e.location, player.location));
    if (d.x * view.x + d.z * view.z > 0.35) return e;
  }
  return undefined;
}

let applying = false;
export function isApplyingAbilityDamage() {
  return applying;
}

/** Daño calculado por el servidor; nunca por el cliente. */
export function hurt(target, amount, caster) {
  if (!isAlive(target) || amount <= 0) return false;
  applying = true;
  try {
    const opts = { cause: EntityDamageCause.entityAttack };
    if (caster && caster.isValid) opts.damagingEntity = caster;
    return target.applyDamage(amount, opts);
  } catch {
    return false;
  } finally {
    applying = false;
  }
}

export function pushAway(target, from, horizontal, vertical) {
  try {
    const d = flat(sub(target.location, from));
    target.applyKnockback({ x: d.x * horizontal, z: d.z * horizontal }, vertical);
  } catch {
    // algunas entidades no admiten empuje
  }
}
