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

function options(entry) {
  return { pitch: entry.pitch ?? 1, volume: entry.volume ?? 1 };
}

// Sonido en el mundo: lo oyen los jugadores cercanos.
export function soundAt(dimension, location, key) {
  const entry = SOUNDS[key];
  if (!entry?.id) return;
  try {
    dimension.playSound(entry.id, location, options(entry));
  } catch {
    // Sonido no definido o chunk no cargado.
  }
}

export function sound(player, key) {
  soundAt(player.dimension, player.location, key);
}

// Sonido de interfaz: solo lo oye este jugador.
export function uiSound(player, key) {
  const entry = SOUNDS[key];
  if (!entry?.id) return;
  try {
    player.playSound(entry.id, options(entry));
  } catch {
    // Sonido no definido.
  }
}

export function t(key, ...values) {
  return values.length ? { translate: key, with: values.map(String) } : { translate: key };
}
