// Estado por jugador (energía, enfriamientos, efectos activos). Vive en el
// servidor: el cliente nunca decide energía, daño ni enfriamientos.
import { system } from "@minecraft/server";
import { CONFIG, TPS } from "../config.js";

const PROP_ENERGIA = "lacobra:energia";
const PROP_SELECCION = "lacobra:seleccion";

/** @type {Map<string, PlayerState>} */
const states = new Map();

export class PlayerState {
  constructor(id) {
    this.id = id;
    this.energy = CONFIG.energia.inicial;
    /** @type {Record<string, number>} tick en el que vuelve a estar lista */
    this.cooldowns = {};
    /** habilidad en carga/secuencia (bloquea lanzamientos simultáneos) */
    this.busy = null;
    this.instintoUntil = 0;
    this.dominioUntil = 0;
    this.atajadaUntil = 0;
    this.totemUntil = 0;
    this.selected = "instinto";
    this.msg = null;
    this.msgUntil = 0;
    this.lastSavedEnergy = -1;
    this.lastHitBonus = 0;
    this.wasShowingHud = false;
    this.armorPieces = 0;
    this.hasAmulet = false;
    this.hasGloves = false;
    this.readyNotified = {};
  }
}

/** @param {import("@minecraft/server").Player} player */
export function getState(player) {
  let s = states.get(player.id);
  if (!s) {
    s = new PlayerState(player.id);
    try {
      const e = player.getDynamicProperty(PROP_ENERGIA);
      if (typeof e === "number") s.energy = clamp(e, 0, CONFIG.energia.max);
      const sel = player.getDynamicProperty(PROP_SELECCION);
      if (typeof sel === "string") s.selected = sel;
    } catch {
      // propiedad inexistente o lectura no permitida: usamos valores por defecto
    }
    states.set(player.id, s);
  }
  return s;
}

export function dropState(playerId) {
  states.delete(playerId);
}

export function allStates() {
  return states;
}

export function now() {
  return system.currentTick;
}

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function addEnergy(player, s, amount) {
  s.energy = clamp(s.energy + amount, 0, CONFIG.energia.max);
}

export function saveState(player, s) {
  const e = Math.round(s.energy);
  if (e === s.lastSavedEnergy) return;
  try {
    player.setDynamicProperty(PROP_ENERGIA, e);
    player.setDynamicProperty(PROP_SELECCION, s.selected);
    s.lastSavedEnergy = e;
  } catch {
    // en contexto de solo lectura se reintenta en el siguiente guardado periódico
  }
}

export function cooldownLeft(s, skill) {
  return Math.max(0, (s.cooldowns[skill] ?? 0) - now());
}

export function setCooldown(s, skill, seconds) {
  s.cooldowns[skill] = now() + Math.round(seconds * TPS);
  s.readyNotified[skill] = false;
}

/** Mensaje breve en la barra de acción (sin llenar el chat). */
export function flash(s, text, seconds = 2) {
  s.msg = text;
  s.msgUntil = now() + seconds * TPS;
}
