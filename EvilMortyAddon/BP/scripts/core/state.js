import { system } from "@minecraft/server";

// Estado en memoria por jugador. Las preferencias (visión, ojo, modo del
// escudo) se guardan también en propiedades dinámicas del jugador.
const states = new Map();

const PREFS = {
  vision: "evilmorty:vision",
  ojo: "evilmorty:ojo",
  nocturna: "evilmorty:nocturna",
  modoEscudo: "evilmorty:modo_escudo",
};

function readBool(player, key, fallback) {
  const value = player.getDynamicProperty(key);
  return typeof value === "boolean" ? value : fallback;
}

export function getState(player) {
  let state = states.get(player.id);
  if (!state) {
    const modo = player.getDynamicProperty(PREFS.modoEscudo);
    state = {
      escudo: false,
      domo: undefined,
      modoEscudo: modo === "destruir" ? "destruir" : "reflejar",
      vision: readBool(player, PREFS.vision, true),
      ojo: readBool(player, PREFS.ojo, true),
      nocturna: readBool(player, PREFS.nocturna, true),
      gestoPendiente: undefined,
      llevaParche: false,
      ojoMostrado: false,
      laserListo: 0,
      mensajeHasta: 0,
    };
    states.set(player.id, state);
  }
  return state;
}

export function savePrefs(player, state) {
  player.setDynamicProperty(PREFS.vision, state.vision);
  player.setDynamicProperty(PREFS.ojo, state.ojo);
  player.setDynamicProperty(PREFS.nocturna, state.nocturna);
  player.setDynamicProperty(PREFS.modoEscudo, state.modoEscudo);
}

export function forgetState(playerId) {
  const state = states.get(playerId);
  states.delete(playerId);
  return state;
}

export function allStates() {
  return states;
}

export function now() {
  return system.currentTick;
}

// Lectura sin crear estado; segura dentro de eventos "before" de solo lectura.
export function peekState(playerId) {
  return states.get(playerId);
}
