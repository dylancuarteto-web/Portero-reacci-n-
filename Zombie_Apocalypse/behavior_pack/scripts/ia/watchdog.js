// ia/watchdog.js — anti-atorados. "IA que nunca se atora" es imposible de
// garantizar en Bedrock; esto es la alternativa práctica y barata:
// si un zombie no se ha movido en ~10 s y está lejos de cualquier jugador,
// se despawnea. Si está cerca (peleando contra un muro, cavando, etc.) se le
// da otra oportunidad. Minero/Constructor en plena faena no cuentan como
// atorados (su propiedad za:accion > 0).
import { system } from "@minecraft/server";
import { entidadesCercaDeJugadores, jugadorMasCercano, esValido } from "../util.js";

const INTERVALO = 100;        // pasada cada 5 s
const TICKS_ATORADO = 200;    // 10 s sin moverse = atorado
const UMBRAL_MOV2 = 0.25;     // (0.5 bloques)^2 de tolerancia
const DIST_PERDON = 24;       // cerca del jugador no se despawnea

// entity.id -> { x, y, z, desde, visto }
const seguimiento = new Map();

function pasadaWatchdog() {
  const ahora = system.currentTick;
  const zombies = entidadesCercaDeJugadores(64, { families: ["za_zombie"] });
  const vivos = new Set();

  for (const e of zombies) {
    if (!esValido(e)) continue;
    vivos.add(e.id);

    // ¿Está trabajando? (minando/construyendo/ritual) → no es un atasco.
    let trabajando = false;
    try { trabajando = (e.getProperty("za:accion") ?? 0) > 0; } catch { }

    const prev = seguimiento.get(e.id);
    const loc = e.location;

    if (!prev) {
      seguimiento.set(e.id, { x: loc.x, y: loc.y, z: loc.z, desde: ahora, visto: ahora });
      continue;
    }
    prev.visto = ahora;

    const d2 = (loc.x - prev.x) ** 2 + (loc.y - prev.y) ** 2 + (loc.z - prev.z) ** 2;
    if (d2 > UMBRAL_MOV2 || trabajando) {
      // Se movió (o está ocupado): reiniciar el reloj.
      prev.x = loc.x; prev.y = loc.y; prev.z = loc.z; prev.desde = ahora;
      continue;
    }

    if (ahora - prev.desde >= TICKS_ATORADO) {
      const cerca = jugadorMasCercano(loc, e.dimension, DIST_PERDON);
      if (!cerca) {
        try { e.remove(); } catch { }
        seguimiento.delete(e.id);
      } else {
        prev.desde = ahora; // cerca del jugador: perdón y a seguir intentando
      }
    }
  }

  // Purga de entradas de entidades que ya no existen o quedaron lejos.
  for (const [id, dato] of seguimiento) {
    if (!vivos.has(id) && ahora - dato.visto > 600) seguimiento.delete(id);
  }
}

export function initWatchdog() {
  system.runInterval(pasadaWatchdog, INTERVALO);
}
