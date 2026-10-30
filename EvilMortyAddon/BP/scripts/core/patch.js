import { EquipmentSlot } from "@minecraft/server";
import { ITEMS } from "../config.js";

export function wearsPatch(player) {
  try {
    const equippable = player.getComponent("minecraft:equippable");
    return equippable?.getEquipment(EquipmentSlot.Head)?.typeId === ITEMS.parche;
  } catch {
    return false;
  }
}

export function heldItem(player) {
  try {
    return player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand);
  } catch {
    return undefined;
  }
}
