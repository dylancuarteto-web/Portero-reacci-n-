import { OJO_MARCA_OFF, OJO_MARCA_ON, TICKS } from "../config.js";
import { sound } from "../core/feedback.js";
import { getState, now } from "../core/state.js";

// Interfaz del ojo: al equipar el parche, un destello ámbar y la capa
// holográfica de RP/ui/hud_screen.json. El script solo envía un título
// marcador con duración 0 (invisible); el HUD lee ese texto para mostrarse.

const SILENT = { fadeInDuration: 0, stayDuration: 0, fadeOutDuration: 0 };

function sendMarker(player, marker) {
  try {
    player.onScreenDisplay.setTitle(marker, SILENT);
  } catch {
    // El jugador salió.
  }
}

function bootFlash(player) {
  try {
    player.camera.fade({
      fadeColor: { red: 1, green: 0.55, blue: 0.05 },
      fadeTime: { fadeInTime: 0.1, holdTime: 0.05, fadeOutTime: 0.5 },
    });
  } catch {
    // Cámara no disponible.
  }
}

export function actualizarOjo(player, llevaParche) {
  const state = getState(player);
  const visible = llevaParche && state.ojo;
  if (visible && !state.ojoMostrado) {
    bootFlash(player);
    sound(player, "ojoOn");
    sendMarker(player, OJO_MARCA_ON);
    state.ojoMostrado = true;
    state.ojoReafirmado = now();
  } else if (!visible && state.ojoMostrado) {
    sendMarker(player, OJO_MARCA_OFF);
    state.ojoMostrado = false;
  } else if (visible && now() - (state.ojoReafirmado ?? 0) >= TICKS.ojoReafirmar) {
    // Otro título pudo sustituir al marcador; se reafirma cada 10 s.
    sendMarker(player, OJO_MARCA_ON);
    state.ojoReafirmado = now();
  }
}
