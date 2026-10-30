import { EquipmentSlot } from "@minecraft/server";
import { ITEM_PARCHE, NIGHT_VISION_DURATION } from "./config.js";
import { patchGlint } from "./vfx.js";

export function wearsPatch(player) {
  try {
    const equippable = player.getComponent("minecraft:equippable");
    return equippable?.getEquipment(EquipmentSlot.Head)?.typeId === ITEM_PARCHE;
  } catch {
    return false;
  }
}

// Visión del Estratega: visión nocturna y un destello en el parche
// mientras se lleva puesto. Se ejecuta cada PASSIVE_INTERVAL ticks.
export function tickPassive(player) {
  if (!player.isValid || !wearsPatch(player)) return;
  try {
    player.addEffect("night_vision", NIGHT_VISION_DURATION, { amplifier: 0, showParticles: false });
  } catch {
    // El jugador pudo salir durante el tick.
  }
  patchGlint(player);
}
