import { TICKS } from "../config.js";
import { getState } from "../core/state.js";

// Visión nocturna del parche: se activa o desactiva desde el menú.
// Solo renueva el efecto cuando le quedan pocos ticks, para que no parpadee.
export function tickVisionNocturna(player) {
  const state = getState(player);
  try {
    const current = player.getEffect("night_vision");
    if (!state.nocturna) {
      if (state.nocturnaPuesta && current) player.removeEffect("night_vision");
      state.nocturnaPuesta = false;
      return;
    }
    if (!current || current.duration < TICKS.nocturnaRenovar) {
      player.addEffect("night_vision", TICKS.nocturna, { amplifier: 0, showParticles: false });
    }
    state.nocturnaPuesta = true;
  } catch {
    // El jugador salió durante el tick.
  }
}

export function quitarVisionNocturna(player) {
  const state = getState(player);
  if (!state.nocturnaPuesta) return;
  state.nocturnaPuesta = false;
  try {
    player.removeEffect("night_vision");
  } catch {
    // Ya no tenía el efecto.
  }
}
