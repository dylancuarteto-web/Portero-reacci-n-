import { EntityDamageCause, system } from "@minecraft/server";
import { ANIMATIONS, ENTITIES, LASER_NIVELES, PARTICLES, PROPS, TICKS } from "../config.js";
import { animate, message, sound, t } from "../core/feedback.js";
import { getState, now } from "../core/state.js";
import { add, burst, length, sub } from "../vfx.js";

// Mano de Rayo Láser: dispara un rayo 3D (entidad evilmorty:rayo_laser)
// que daña al primer objetivo en la línea de visión. Cada bloque de
// diamante sube un nivel (daño y alcance), hasta el nivel 3.

const NIVEL_MAX = LASER_NIVELES.length - 1;
const RAY_EXCLUDED = ["minecraft:item", "minecraft:xp_orb", ENTITIES.domo, ENTITIES.rayo];

export function nivelDe(item) {
  const value = item?.getDynamicProperty(PROPS.nivelLaser);
  return typeof value === "number" ? Math.min(Math.max(value, 0), NIVEL_MAX) : 0;
}

function loreFor(nivel) {
  const stats = LASER_NIVELES[nivel];
  return [
    `§6Nivel ${nivel}/${NIVEL_MAX}`,
    `§cDaño ${stats.dano} §7| §bAlcance ${stats.alcance}`,
    nivel < NIVEL_MAX ? "§7Agáchate y usa con 1 bloque de diamante para mejorar" : "§eNivel máximo",
  ];
}

// Punto de salida del rayo: delante de la mano derecha.
function muzzle(player) {
  const head = player.getHeadLocation();
  const dir = player.getViewDirection();
  const right = { x: -dir.z, y: 0, z: dir.x };
  return add(add(add(head, dir, 0.7), right, 0.35), { x: 0, y: -0.35, z: 0 });
}

function blockHitPoint(hit) {
  const b = hit.block.location;
  return { x: b.x + hit.faceLocation.x, y: b.y + hit.faceLocation.y, z: b.z + hit.faceLocation.z };
}

function spawnBeam(player, start, end, nivel) {
  const delta = sub(end, start);
  const len = length(delta);
  if (len < 0.2) return;
  const yaw = (Math.atan2(-delta.x, delta.z) * 180) / Math.PI;
  const pitch = (-Math.asin(delta.y / len) * 180) / Math.PI;
  try {
    const beam = player.dimension.spawnEntity(ENTITIES.rayo, start);
    beam.setRotation({ x: pitch, y: yaw });
    beam.setProperty(PROPS.longitudRayo, Math.min(len, 64));
    beam.setProperty(PROPS.nivelRayo, nivel);
    // El modelo se orienta con estas propiedades (RP/animations/rayo_laser.animation.json).
    beam.setProperty(PROPS.yawRayo, ((yaw + 540) % 360) - 180);
    beam.setProperty(PROPS.pitchRayo, pitch);
    system.runTimeout(() => {
      try {
        if (beam.isValid) beam.remove();
      } catch {
        // Ya eliminado.
      }
    }, TICKS.rayoVida);
  } catch {
    // Chunk no cargado: el disparo sigue funcionando sin el rayo visual.
  }
}

export function dispararLaser(player, item) {
  const state = getState(player);
  const tick = now();
  if (tick < state.laserListo) return;
  state.laserListo = tick + TICKS.laserCooldown;

  const nivel = nivelDe(item);
  const { dano, alcance } = LASER_NIVELES[nivel];
  const head = player.getHeadLocation();
  const dir = player.getViewDirection();

  let distance = alcance;
  let target;
  try {
    const block = player.getBlockFromViewDirection({ maxDistance: alcance, includeLiquidBlocks: false });
    if (block) distance = length(sub(blockHitPoint(block), head));
    const hit = player
      .getEntitiesFromViewDirection({ maxDistance: alcance, excludeTypes: RAY_EXCLUDED })
      .find((h) => h.entity.id !== player.id && h.distance < distance);
    if (hit) {
      target = hit.entity;
      distance = hit.distance;
    }
  } catch {
    // Raycast fuera del mundo cargado: dispara al alcance máximo.
  }

  const start = muzzle(player);
  const end = add(head, dir, distance);
  animate(player, ANIMATIONS.laserDisparo);
  sound(player, "laser");
  burst(player.dimension, PARTICLES.laserDestello, start);
  spawnBeam(player, start, end, nivel);
  burst(player.dimension, PARTICLES.laserImpacto, end);

  if (target) {
    try {
      target.applyDamage(dano, { cause: EntityDamageCause.entityAttack, damagingEntity: player });
    } catch {
      // Objetivo invulnerable o descargado.
    }
  }
}

function consumeDiamondBlock(container) {
  for (let slot = 0; slot < container.size; slot++) {
    const stack = container.getItem(slot);
    if (stack?.typeId !== "minecraft:diamond_block") continue;
    if (stack.amount > 1) {
      stack.amount -= 1;
      container.setItem(slot, stack);
    } else {
      container.setItem(slot, undefined);
    }
    return true;
  }
  return false;
}

export function mejorarLaser(player) {
  const container = player.getComponent("minecraft:inventory")?.container;
  if (!container) return;
  const slot = player.selectedSlotIndex;
  const item = container.getItem(slot);
  if (!item) return;
  const nivel = nivelDe(item);
  if (nivel >= NIVEL_MAX) {
    message(player, [t("evilmorty.msg.laser_max")]);
    return;
  }
  if (!consumeDiamondBlock(container)) {
    message(player, [t("evilmorty.msg.laser_falta_diamante")]);
    return;
  }
  // Releer el ítem por si el bloque de diamante estaba en otra ranura.
  const updated = container.getItem(slot) ?? item;
  updated.setDynamicProperty(PROPS.nivelLaser, nivel + 1);
  updated.setLore(loreFor(nivel + 1));
  container.setItem(slot, updated);
  animate(player, ANIMATIONS.mejora);
  burst(player.dimension, PARTICLES.mejora, player.location);
  sound(player, "mejora");
  const stats = LASER_NIVELES[nivel + 1];
  message(player, [t("evilmorty.msg.laser_mejorado", nivel + 1, stats.dano, stats.alcance)]);
}

// Asegura que una mano láser nueva muestre sus estadísticas.
export function prepararLore(player, item) {
  if (item.getLore().length) return;
  const container = player.getComponent("minecraft:inventory")?.container;
  if (!container) return;
  item.setLore(loreFor(nivelDe(item)));
  container.setItem(player.selectedSlotIndex, item);
}
