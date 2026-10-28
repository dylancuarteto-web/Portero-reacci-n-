// Indicador de energía y enfriamientos en la barra de acción (funciona en Android).
import { EquipmentSlot } from "@minecraft/server";
import { CONFIG, HABILIDADES, ABREV, NOMBRES } from "../config.js";
import { now, cooldownLeft } from "./state.js";
import { playerSound } from "./fx.js";

export function energyBar(energy, segments = 20) {
  const filled = Math.round((energy / CONFIG.energia.max) * segments);
  const col = energy >= CONFIG.energia.max ? "§6" : energy >= 40 ? "§e" : energy >= 15 ? "§6" : "§c";
  return col + "|".repeat(filled) + "§8" + "|".repeat(segments - filled);
}

function holdsCobraItem(player) {
  try {
    const eq = player.getComponent("minecraft:equippable");
    const main = eq?.getEquipment(EquipmentSlot.Mainhand)?.typeId ?? "";
    const off = eq?.getEquipment(EquipmentSlot.Offhand)?.typeId ?? "";
    return main.startsWith("lacobra:") || off.startsWith("lacobra:");
  } catch {
    return false;
  }
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {import("./state.js").PlayerState} s
 */
export function updateHud(player, s) {
  const t = now();
  const active = s.busy || s.instintoUntil > t || s.dominioUntil > t || s.totemUntil > t || s.atajadaUntil > t;
  const hasMsg = s.msg && s.msgUntil > t;
  // aviso de habilidad lista (solo una vez por enfriamiento)
  for (const sk of HABILIDADES) {
    if (s.readyNotified[sk] === false && cooldownLeft(s, sk) === 0) {
      s.readyNotified[sk] = true;
      if (sk === "suprema" || sk === "dominio") playerSound(player, "listo", 0.5);
    }
  }
  const show = active || hasMsg || holdsCobraItem(player);
  if (!show) {
    if (s.wasShowingHud) {
      try {
        player.onScreenDisplay.setActionBar(" ");
      } catch {
        // ignorado
      }
      s.wasShowingHud = false;
    }
    return;
  }
  s.wasShowingHud = true;
  let line2 = "";
  for (const sk of HABILIDADES) {
    const cd = Math.ceil(cooldownLeft(s, sk) / 20);
    const cost = CONFIG.habilidades[sk].coste;
    const col = cd > 0 ? "§c" : s.energy >= cost ? "§a" : "§7";
    line2 += `${col}${ABREV[sk]}${cd > 0 ? " " + cd : ""}§8  `;
  }
  let line1 = `§6Energía ${energyBar(s.energy)} §f${Math.floor(s.energy)}`;
  if (s.busy) line1 += `  §d» ${NOMBRES[s.busy]}`;
  else if (s.instintoUntil > t) line1 += `  §6Instinto ${Math.ceil((s.instintoUntil - t) / 20)}s`;
  else if (s.dominioUntil > t) line1 += `  §5Dominio ${Math.ceil((s.dominioUntil - t) / 20)}s`;
  const text = hasMsg ? `${s.msg}\n${line1}` : `${line1}\n${line2.trim()}`;
  try {
    player.onScreenDisplay.setActionBar(text);
  } catch {
    // ignorado
  }
}
