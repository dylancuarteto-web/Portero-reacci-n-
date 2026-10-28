// Tótem de La Cobra: consumible defensivo con serpiente guardiana.
// Se activa usándolo o, si se lleva en una mano, automáticamente ante un golpe letal.
import { EquipmentSlot, GameMode } from "@minecraft/server";
import { CONFIG, TPS } from "../config.js";
import { addTask } from "../core/scheduler.js";
import { getState, now, flash } from "../core/state.js";
import { particle, sound, anim, effect, spawnFx, removeFx, vanish, playerSound } from "../core/fx.js";
import { findTargets, hurt } from "../core/targets.js";
import { circlePoint, up } from "../core/vec.js";

const cfg = CONFIG.objetos.totem;

export const totemComponent = {
  onUse(ev) {
    activateTotem(ev.source, false);
  },
};

function consumeTotem(player) {
  try {
    if (player.getGameMode() === GameMode.Creative) return true;
    const eq = player.getComponent("minecraft:equippable");
    for (const slot of [EquipmentSlot.Mainhand, EquipmentSlot.Offhand]) {
      const it = eq.getEquipment(slot);
      if (it?.typeId === "lacobra:totem_cobra") {
        if (it.amount > 1) {
          it.amount -= 1;
          eq.setEquipment(slot, it);
        } else {
          eq.setEquipment(slot, undefined);
        }
        return true;
      }
    }
  } catch {
    // ignorado
  }
  return false;
}

export function totemReady(player) {
  const s = getState(player);
  return (s.cooldowns.totem ?? 0) <= now() && s.totemUntil <= now();
}

export function holdsTotem(player) {
  try {
    const eq = player.getComponent("minecraft:equippable");
    return (
      eq.getEquipment(EquipmentSlot.Mainhand)?.typeId === "lacobra:totem_cobra" ||
      eq.getEquipment(EquipmentSlot.Offhand)?.typeId === "lacobra:totem_cobra"
    );
  } catch {
    return false;
  }
}

/** @param {import("@minecraft/server").Player} player */
export function activateTotem(player, automatic) {
  const s = getState(player);
  if (s.totemUntil > now()) {
    flash(s, "§eEl Tótem ya está protegiéndote");
    return false;
  }
  const left = (s.cooldowns.totem ?? 0) - now();
  if (left > 0) {
    flash(s, `§eTótem de La Cobra§c: enfriamiento ${Math.ceil(left / TPS)}s`);
    playerSound(player, "sin_energia", 0.6);
    return false;
  }
  if (!consumeTotem(player)) return false;
  s.cooldowns.totem = now() + cfg.cooldown * TPS;
  s.totemUntil = now() + cfg.duracion * TPS;
  const dim = player.dimension;
  const loc = player.location;
  if (automatic) {
    try {
      const h = player.getComponent("minecraft:health");
      h.setCurrentValue(Math.max(h.currentValue, 8));
    } catch {
      // ignorado
    }
  }
  effect(player, "resistance", cfg.duracion, 2);
  effect(player, "regeneration", cfg.duracion, 1);
  effect(player, "absorption", cfg.duracion, 2);
  effect(player, "fire_resistance", cfg.duracion, 0);
  anim(player, "animation.lacobra.player.totem");
  sound(dim, "totem", loc, 1.2);
  particle(dim, "guard_shield", loc);
  particle(dim, "supreme_pillar", loc);
  particle(dim, "gold_spark", up(loc, 1));
  try {
    player.onScreenDisplay.setTitle("§6Tótem de La Cobra", {
      subtitle: automatic ? "§e¡Te salvó de la derrota!" : "§eLa serpiente guardiana te protege",
      fadeInDuration: 4, stayDuration: 30, fadeOutDuration: 10,
    });
  } catch {
    // ignorado
  }

  const guard = spawnFx(dim, "lacobra:serpiente_energia", up(loc, 1.2), player.id);
  try {
    guard?.triggerEvent("lacobra:guardiana");
  } catch {
    // ignorado
  }
  const total = cfg.duracion * TPS;
  let ang = 0;
  let vanishAt = -1;
  addTask({
    name: "totem",
    owner: player.id,
    every: 2,
    tick(age) {
      if (!player.isValid) return false;
      if (vanishAt >= 0) return age < vanishAt + 10;
      if (age >= total) {
        if (guard) vanish(guard);
        particle(player.dimension, "fade_dust", up(player.location, 1));
        vanishAt = age;
        return true;
      }
      ang += 16;
      const pos = circlePoint(player.location, 1.6, ang, 1.1 + Math.sin(age * 0.15) * 0.2);
      if (guard && guard.isValid) {
        try {
          guard.teleport(pos, { facingLocation: circlePoint(player.location, 1.6, ang + 20, 1.1) });
        } catch {
          // ignorado
        }
      }
      if (age % 30 === 0) {
        const t = findTargets(player.dimension, player.location, cfg.radioGuardiana, player, 1)[0];
        if (t) {
          hurt(t, cfg.danioGuardiana, player);
          particle(player.dimension, "energy_beam", t.location);
          particle(player.dimension, "gold_spark", up(t.location, 1));
          sound(player.dimension, "guardian_zap", t.location, 0.8);
        }
      }
      return true;
    },
    onEnd() {
      s.totemUntil = 0;
      removeFx(guard);
    },
  });
  return true;
}
