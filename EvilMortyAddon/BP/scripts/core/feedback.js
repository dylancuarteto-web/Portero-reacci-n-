import { SOUNDS, TICKS } from "../config.js";
import { getState, now } from "./state.js";

// Mensaje en la barra de acción. Los mensajes de habilidades reservan la
// barra unos ticks para que la ficha de predicción no los tape.
export function message(player, rawtext, hold = true) {
  try {
    player.onScreenDisplay.setActionBar({ rawtext });
    if (hold) getState(player).mensajeHasta = now() + TICKS.mensaje;
  } catch {
    // El jugador salió.
  }
}

export function animate(player, animation) {
  try {
    player.playAnimation(animation, { blendOutTime: 0.2 });
  } catch {
    // Resource pack no activo.
  }
}

export function sound(player, key) {
  const id = SOUNDS[key];
  if (!id) return;
  try {
    player.dimension.playSound(id, player.location);
  } catch {
    // Sonido aún no definido.
  }
}

export function t(key, ...values) {
  return values.length ? { translate: key, with: values.map(String) } : { translate: key };
}
