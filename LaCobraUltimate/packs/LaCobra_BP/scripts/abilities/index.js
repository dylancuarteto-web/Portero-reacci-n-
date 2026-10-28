// Registro de habilidades y canal único de activación con todas las validaciones.
import { GameMode } from "@minecraft/server";
import { CONFIG, NOMBRES } from "../config.js";
import { getState, cooldownLeft, setCooldown, flash, addEnergy, saveState } from "../core/state.js";
import { playerSound } from "../core/fx.js";
import { isAlive } from "../core/targets.js";
import { instinto } from "./instinto.js";
import { remate } from "./remate.js";
import { veneno } from "./veneno.js";
import { dominio } from "./dominio.js";
import { suprema } from "./suprema.js";

/**
 * @typedef {object} Ability
 * @property {(player: import("@minecraft/server").Player, s: import("../core/state.js").PlayerState) => (string | undefined)} [check]
 *   devuelve un mensaje de error si no se puede lanzar (sin gastar energía)
 * @property {(player: import("@minecraft/server").Player, s: import("../core/state.js").PlayerState, ctx: any) => void} run
 */

/** @type {Record<string, Ability>} */
export const ABILITIES = { instinto, remate, veneno, dominio, suprema };

export function isCreative(player) {
  try {
    return player.getGameMode() === GameMode.Creative;
  } catch {
    return false;
  }
}

/** Una habilidad está desbloqueada si el jugador tiene su runa (o está en creativo). */
export function hasRune(player, skill) {
  if (isCreative(player)) return true;
  try {
    const inv = player.getComponent("minecraft:inventory")?.container;
    if (!inv) return false;
    const id = "lacobra:runa_" + skill;
    for (let i = 0; i < inv.size; i++) {
      if (inv.getItem(i)?.typeId === id) return true;
    }
  } catch {
    // inventario no disponible
  }
  return false;
}

/**
 * Lanza una habilidad tras validar en el servidor: jugador vivo, sin otra
 * secuencia en curso, runa desbloqueada, enfriamiento y energía suficientes.
 * @param {import("@minecraft/server").Player} player
 * @param {string} skill
 * @param {"runa"|"libro"|"espada"|"comando"} source
 */
export function cast(player, skill, source) {
  const ab = ABILITIES[skill];
  if (!ab || !player || !player.isValid) return false;
  const s = getState(player);
  const cfg = CONFIG.habilidades[skill];
  const fail = (msg) => {
    flash(s, msg);
    playerSound(player, "sin_energia", 0.6);
    return false;
  };
  if (!isAlive(player)) return false;
  if (s.busy) return fail(`§c${NOMBRES[s.busy]} está en curso`);
  if (source !== "runa" && source !== "comando" && !hasRune(player, skill)) {
    return fail(`§cNecesitas la §6Runa de ${NOMBRES[skill]}§c para usar esta habilidad`);
  }
  const cd = cooldownLeft(s, skill);
  if (cd > 0) return fail(`§e${NOMBRES[skill]}§c: enfriamiento ${Math.ceil(cd / 20)}s`);
  if (s.energy < cfg.coste) {
    return fail(`§cEnergía insuficiente: §e${Math.floor(s.energy)}§c/${cfg.coste}`);
  }
  const err = ab.check ? ab.check(player, s) : undefined;
  if (err) return fail(err);

  addEnergy(player, s, -cfg.coste);
  setCooldown(s, skill, cfg.cooldown);
  saveState(player, s);
  flash(s, `§6» ${NOMBRES[skill]}`, 1.5);
  ab.run(player, s, { source });
  return true;
}
