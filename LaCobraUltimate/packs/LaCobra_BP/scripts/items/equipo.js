// Espada, Balón Dorado, Guantes del GOAT, Amuleto y armadura (pasivas y activas).
import { EquipmentSlot, ItemStack, GameMode } from "@minecraft/server";
import { CONFIG, TPS } from "../config.js";
import { getState, now, flash, addEnergy, saveState } from "../core/state.js";
import { particle, sound, anim, effect, playerSound } from "../core/fx.js";
import { findTargets, isHostileTarget, pushAway, hurt } from "../core/targets.js";
import { cast } from "../abilities/index.js";
import { up } from "../core/vec.js";

const gl = CONFIG.objetos.guantes;

// ---------------------------------------------------------------- espada
export const espadaComponent = {
  onHitEntity(ev) {
    const player = ev.attackingEntity;
    const target = ev.hitEntity;
    if (!player || player.typeId !== "minecraft:player" || !ev.hadEffect) return;
    const s = getState(player);
    const loc = up(target.location, 1);
    particle(target.dimension, "scale_shards", loc);
    particle(target.dimension, "gold_spark", loc);
    addEnergy(player, s, CONFIG.energia.porGolpeEspada);
    if (isHostileTarget(target, player) && Math.random() < CONFIG.objetos.espada.probVeneno) {
      effect(target, "poison", 3, 0);
      particle(target.dimension, "venom_splash", loc);
      sound(target.dimension, "veneno_golpe", loc, 0.6);
    }
  },
  onUse(ev) {
    const player = ev.source;
    const s = getState(player);
    cast(player, s.selected, "espada");
  },
};

// ---------------------------------------------------------------- balón
export const balonComponent = {
  onUse(ev) {
    sound(ev.source.dimension, "balon_patada", ev.source.location);
  },
};

/** Impacto del Balón Dorado: efectos, energía al lanzador y balón recuperable. */
export function balonImpact(projectile, location, dim, hitEntity, owner) {
  const c = up(location, 0.2);
  particle(dim, "gold_spark", c);
  particle(dim, "shockwave", c, { radius: CONFIG.objetos.balon.radioImpacto * 2 });
  sound(dim, "balon_golpe", c);
  if (hitEntity && owner && owner.typeId === "minecraft:player" && isHostileTarget(hitEntity, owner)) {
    hurt(hitEntity, CONFIG.objetos.balon.danio, owner);
    const s = getState(owner);
    addEnergy(owner, s, CONFIG.energia.porGolBalon);
    flash(s, "§6¡GOLAZO! §e+" + CONFIG.energia.porGolBalon + " energía", 1.5);
    particle(dim, "impact_burst", up(hitEntity.location, 1));
    pushAway(hitEntity, location, 0.6, 0.35);
  }
  // el balón se puede recuperar (no se duplica en creativo, donde no se consume)
  let creative = false;
  try {
    creative = owner?.typeId === "minecraft:player" && owner.getGameMode() === GameMode.Creative;
  } catch {
    creative = false;
  }
  if (!creative) {
    try {
      dim.spawnItem(new ItemStack("lacobra:balon_dorado", 1), c);
    } catch {
      // chunk no cargado
    }
  }
}

// ---------------------------------------------------------------- guantes
const HOSTILE_PROJECTILES = new Set([
  "minecraft:arrow", "minecraft:small_fireball", "minecraft:fireball", "minecraft:snowball",
  "minecraft:shulker_bullet", "minecraft:wither_skull", "minecraft:wither_skull_dangerous",
  "minecraft:llama_spit", "minecraft:breeze_wind_charge_projectile", "lacobra:escupitajo",
]);

export const guantesComponent = {
  onUse(ev) {
    atajada(ev.source);
  },
};

/** Activa "Atajada del GOAT": ataja proyectiles, empuja enemigos y protege. */
export function atajada(player) {
  const s = getState(player);
  if (s.atajadaUntil > now()) return;
  const left = (s.cooldowns.guantes ?? 0) - now();
  if (left > 0) {
    flash(s, `§eAtajada del GOAT§c: enfriamiento ${Math.ceil(left / TPS)}s`);
    playerSound(player, "sin_energia", 0.6);
    return;
  }
  if (s.energy < gl.coste) {
    flash(s, `§cEnergía insuficiente: §e${Math.floor(s.energy)}§c/${gl.coste}`);
    playerSound(player, "sin_energia", 0.6);
    return;
  }
  addEnergy(player, s, -gl.coste);
  s.cooldowns.guantes = now() + gl.cooldown * TPS;
  s.atajadaUntil = now() + gl.duracionAtajada * TPS;
  const dim = player.dimension;
  const loc = player.location;
  anim(player, "animation.lacobra.player.atajada");
  sound(dim, "atajada", loc);
  particle(dim, "guard_shield", loc);
  particle(dim, "energy_ring", up(loc, 0.1), { radius: 2 });
  effect(player, "resistance", gl.duracionAtajada, 2);
  let saved = 0;
  try {
    for (const p of dim.getEntities({ location: loc, maxDistance: gl.radio })) {
      if (!HOSTILE_PROJECTILES.has(p.typeId)) continue;
      const owner = p.getComponent("minecraft:projectile")?.owner;
      if (owner && owner.id === player.id) continue;
      particle(dim, "gold_spark", p.location);
      p.remove();
      saved++;
    }
  } catch {
    // ignorado
  }
  for (const t of findTargets(dim, loc, gl.radio * 0.6, player)) pushAway(t, loc, 1.2, 0.3);
  flash(s, saved > 0 ? `§6¡ATAJADA! §e${saved} proyectil(es) detenidos` : "§6¡Atajada del GOAT!", 1.5);
  saveState(player, s);
}

/** Reducción de daño por proyectiles (pasiva de guantes y Atajada activa). */
export function projectileShield(player, s, ev) {
  const proj = ev.damageSource.damagingProjectile;
  if (!proj) return;
  if (s.atajadaUntil > now()) {
    ev.cancel = true;
    return;
  }
  if (s.hasGloves) ev.damage = ev.damage * (1 - gl.reduccionProyectiles);
}

// ---------------------------------------------------------------- pasivas periódicas (cada 20 ticks)
const ARMOR = {
  [EquipmentSlot.Head]: "lacobra:casco_cobra",
  [EquipmentSlot.Chest]: "lacobra:pechera_cobra",
  [EquipmentSlot.Legs]: "lacobra:pantalones_cobra",
  [EquipmentSlot.Feet]: "lacobra:botas_cobra",
};

export function passiveTick(player, s, tick) {
  let eq;
  try {
    eq = player.getComponent("minecraft:equippable");
  } catch {
    return;
  }
  if (!eq) return;
  let pieces = 0;
  for (const slot in ARMOR) {
    if (eq.getEquipment(/** @type {EquipmentSlot} */ (slot))?.typeId === ARMOR[slot]) pieces++;
  }
  const offhand = eq.getEquipment(EquipmentSlot.Offhand)?.typeId;
  s.hasGloves = offhand === "lacobra:guantes_goat";
  // amuleto: en la mano secundaria o en la barra rápida
  let amulet = offhand === "lacobra:amuleto_cobra";
  if (!amulet) {
    try {
      const inv = player.getComponent("minecraft:inventory")?.container;
      for (let i = 0; inv && i < 9 && !amulet; i++) amulet = inv.getItem(i)?.typeId === "lacobra:amuleto_cobra";
    } catch {
      amulet = false;
    }
  }
  const prevFull = s.armorPieces === 4;
  s.armorPieces = pieces;
  s.hasAmulet = amulet;

  if (eq.getEquipment(EquipmentSlot.Head)?.typeId === ARMOR[EquipmentSlot.Head]) effect(player, "water_breathing", 3, 0);
  if (eq.getEquipment(EquipmentSlot.Feet)?.typeId === ARMOR[EquipmentSlot.Feet]) effect(player, "jump_boost", 3, 0);
  if (pieces === 4) {
    effect(player, "speed", 3, 0);
    effect(player, "strength", 3, 0);
    if (!prevFull) {
      flash(s, "§6Conjunto de La Cobra completo: §e+velocidad, +fuerza, +energía", 3);
      sound(player.dimension, "listo", player.location);
    }
    if (tick % 60 === 0) particle(player.dimension, "aura_spiral", up(player.location, 0.1));
  }
  if (s.hasGloves) effect(player, "haste", 3, 0);
  if (amulet) {
    // visión nocturna de 15 s renovada cada segundo: sin parpadeo de aviso
    effect(player, "night_vision", 15, 0);
    particle(player.dimension, "amulet_aura", up(player.location, 0.2));
  }
}

