// desesperacion.js — el contador de 1 a 99 que gobierna todo el addon.
//
// - Se guarda POR JUGADOR con dynamic properties (persiste al salir del mundo).
// - HUD: actionbar (ver LEEME.md para el porqué frente a un HUD custom).
// - Sube por: días sobrevividos (+2), cada 10 kills (+1), fortificarse (+1),
//   esconderse bajo tierra (+1). Baja SOLO al morir (-10).
import { world, system } from "@minecraft/server";
import { clamp, jugadores, msg } from "./util.js";

const PROP = "za:desesperacion";
const PROP_KILLS = "za:kills";
const PROP_OCULTO = "za:min_oculto";
const PROP_FORT = "za:min_fortificado";

export function getDesesperacion(p) {
  const v = Number(p.getDynamicProperty(PROP) ?? 1);
  return clamp(Number.isFinite(v) ? Math.round(v) : 1, 1, 99);
}

export function setDesesperacion(p, valor) {
  const antes = getDesesperacion(p);
  const ahora = clamp(Math.round(valor), 1, 99);
  p.setDynamicProperty(PROP, ahora);
  // Aviso al cruzar a una decena superior: "la horda se impacienta".
  if (Math.floor((ahora - 1) / 10) > Math.floor((antes - 1) / 10)) {
    msg(p, "za.msg.tier_up", [String(ahora)]);
    try { p.playSound("mob.wither.ambient", { volume: 0.4, pitch: 0.6 }); } catch { }
  }
}

export function addDesesperacion(p, delta) {
  setDesesperacion(p, getDesesperacion(p) + delta);
}

// Llamado desde combate.js cuando el jugador mata un za_zombie.
export function registrarKill(p) {
  const kills = Number(p.getDynamicProperty(PROP_KILLS) ?? 0) + 1;
  p.setDynamicProperty(PROP_KILLS, kills);
  if (kills % 10 === 0) {
    addDesesperacion(p, 1);
    msg(p, "za.msg.kills");
  }
}

// Llamado desde combate.js cuando el jugador muere.
export function castigoMuerte(p) {
  addDesesperacion(p, -10);
  msg(p, "za.msg.muerte");
}

// ¿El jugador está "bajo tierra"? (muy por debajo de la superficie).
function bajoTierra(p) {
  try {
    const top = p.dimension.getTopmostBlock({ x: Math.floor(p.location.x), z: Math.floor(p.location.z) });
    return top !== undefined && top.y - p.location.y > 5;
  } catch {
    return false;
  }
}

// ¿El jugador está muy fortificado? Muestreo barato: contamos bloques sólidos
// en posiciones fijas de un cascarón de radio 3-4 alrededor suyo.
const OFFSETS_MUESTREO = [];
for (const r of [3, 4]) {
  for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]]) {
    OFFSETS_MUESTREO.push([dx, 0, dz], [dx, 1, dz]);
  }
}
OFFSETS_MUESTREO.push([0, 3, 0], [1, 3, 0], [-1, 3, 0], [0, 3, 1], [0, 3, -1]); // techo

function muyFortificado(p) {
  let solidos = 0, total = 0;
  const base = { x: Math.floor(p.location.x), y: Math.floor(p.location.y), z: Math.floor(p.location.z) };
  for (const [dx, dy, dz] of OFFSETS_MUESTREO) {
    try {
      const b = p.dimension.getBlock({ x: base.x + dx, y: base.y + dy, z: base.z + dz });
      if (!b) continue;
      total++;
      if (!b.isAir && !b.isLiquid) solidos++;
    } catch { }
  }
  return total > 10 && solidos / total > 0.7;
}

export function initDesesperacion() {
  // HUD en actionbar cada 2 segundos. Texto 100% desde .lang.
  system.runInterval(() => {
    for (const p of jugadores()) {
      try {
        p.onScreenDisplay.setActionBar({
          rawtext: [{ translate: "za.hud.desesperacion", with: [String(getDesesperacion(p))] }]
        });
      } catch { }
    }
  }, 40);

  // +2 por cada nuevo día sobrevivido (contador global de día del mundo).
  system.runInterval(() => {
    try {
      const dia = world.getDay();
      const ultimo = Number(world.getDynamicProperty("za:ultimo_dia") ?? dia);
      if (dia > ultimo) {
        for (const p of jugadores()) {
          addDesesperacion(p, 2 * (dia - ultimo));
          msg(p, "za.msg.dia");
        }
      }
      world.setDynamicProperty("za:ultimo_dia", dia);
    } catch { }
  }, 200);

  // Cada 60 s: acumular minutos "oculto" y "fortificado".
  // Diseño: no castiga jugar bien — es la horda impacientándose. Umbrales
  // largos (3 y 5 min CONTINUOS) y el contador se reinicia al salir/moverse.
  system.runInterval(() => {
    for (const p of jugadores()) {
      try {
        // Escondido bajo tierra: +1 cada 3 minutos continuos.
        if (bajoTierra(p)) {
          const m = Number(p.getDynamicProperty(PROP_OCULTO) ?? 0) + 1;
          if (m >= 3) {
            p.setDynamicProperty(PROP_OCULTO, 0);
            addDesesperacion(p, 1);
            msg(p, "za.msg.oculto");
          } else {
            p.setDynamicProperty(PROP_OCULTO, m);
          }
        } else {
          p.setDynamicProperty(PROP_OCULTO, 0);
        }

        // Base muy fortificada: +1 cada 5 minutos continuos.
        if (muyFortificado(p)) {
          const m = Number(p.getDynamicProperty(PROP_FORT) ?? 0) + 1;
          if (m >= 5) {
            p.setDynamicProperty(PROP_FORT, 0);
            addDesesperacion(p, 1);
            msg(p, "za.msg.fortificado");
          } else {
            p.setDynamicProperty(PROP_FORT, m);
          }
        } else {
          p.setDynamicProperty(PROP_FORT, 0);
        }
      } catch { }
    }
  }, 1200);
}
