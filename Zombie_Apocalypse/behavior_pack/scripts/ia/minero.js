// ia/minero.js — el corazón del addon: zombies que rompen bloques.
//
// Cubre a Minero (túnel 2x2 hacia el jugador), Demoledor (rompe muros) y
// Mutante (rompe lo que toque). Adaptación honesta: no hay "romper bloques
// inteligente" en Bedrock, así que usamos RAYCAST hacia el jugador + lista
// permitida de bloques + cooldown por dureza (obsidiana = lentísimo).
//
// Rendimiento:
// - Corre cada 10 ticks, no cada tick.
// - Máximo 2 bloques por zombie por operación y 6 bloques globales por pasada.
// - Cooldown por entidad guardado en un Map (nada de scans extra).
import { system, BlockPermutation } from "@minecraft/server";
import { entidadesCercaDeJugadores, jugadorMasCercano, costeBloque, esValido } from "../util.js";

const AIRE = BlockPermutation.resolve("minecraft:air");

// Parámetros por tipo: radio de trabajo y cooldown base entre operaciones.
const EXCAVADORES = new Map([
  ["za:zombie_minero", { radio: 32, cdBase: 15 }],
  ["za:zombie_demoledor", { radio: 20, cdBase: 10 }],
  ["za:zombie_mutante", { radio: 16, cdBase: 8 }]
]);

const MAX_BLOQUES_POR_ZOMBIE = 2; // túnel 2x2 se abre en 2 operaciones
const MAX_BLOQUES_GLOBAL = 6;     // presupuesto global por pasada

const cooldowns = new Map(); // entity.id -> tick en el que puede volver a picar

// ¿Tiene línea de visión al jugador? Si sí, no hace falta cavar.
function veAlJugador(e, objetivo, dist) {
  try {
    const origen = { x: e.location.x, y: e.location.y + 1.6, z: e.location.z };
    const destino = { x: objetivo.location.x, y: objetivo.location.y + 1.0, z: objetivo.location.z };
    const dir = {
      x: destino.x - origen.x,
      y: destino.y - origen.y,
      z: destino.z - origen.z
    };
    const len = Math.max(0.01, Math.sqrt(dir.x ** 2 + dir.y ** 2 + dir.z ** 2));
    dir.x /= len; dir.y /= len; dir.z /= len;
    const hit = e.dimension.getBlockFromRay(origen, dir, {
      maxDistance: Math.min(dist, 16),
      includePassableBlocks: false,
      includeLiquidBlocks: false
    });
    return hit === undefined; // sin bloque en medio → lo ve
  } catch {
    return true; // ante la duda, no cavar
  }
}

// Celdas del túnel 2x2 delante del zombie, en dirección al jugador.
function celdasFrente(e, objetivo) {
  const ex = Math.floor(e.location.x), ey = Math.floor(e.location.y), ez = Math.floor(e.location.z);
  const dx = objetivo.location.x - e.location.x;
  const dy = objetivo.location.y - e.location.y;
  const dz = objetivo.location.z - e.location.z;

  // Eje dominante: cavamos en X o en Z, nunca en diagonal (túnel limpio).
  let sx = 0, sz = 0;
  if (Math.abs(dx) > Math.abs(dz)) sx = Math.sign(dx) || 1; else sz = Math.sign(dz) || 1;
  const fx = ex + sx, fz = ez + sz;

  // Escalón hacia arriba/abajo si el jugador está claramente más alto/bajo.
  let baseY = ey;
  if (dy > 2) baseY = ey + 1;

  const celdas = [
    [fx, baseY, fz], [fx, baseY + 1, fz] // columna frontal (pies + cabeza)
  ];
  // Ensanchar a 2 de ancho (perpendicular) para que la horda pase detrás.
  const px = sz !== 0 ? 1 : 0, pz = sx !== 0 ? 1 : 0;
  celdas.push([fx + px, baseY, fz + pz], [fx + px, baseY + 1, fz + pz]);

  // Si el jugador está muy abajo, cavar también bajo los pies (baja él solo).
  if (dy < -2) celdas.unshift([ex, ey - 1, ez]);
  return celdas;
}

function pasadaDeExcavacion() {
  const ahora = system.currentTick;
  let presupuesto = MAX_BLOQUES_GLOBAL;

  const excavadores = entidadesCercaDeJugadores(40)
    .filter(e => EXCAVADORES.has(e.typeId));

  for (const e of excavadores) {
    if (presupuesto <= 0) break;
    if (!esValido(e)) continue;
    if ((cooldowns.get(e.id) ?? 0) > ahora) continue;

    const cfg = EXCAVADORES.get(e.typeId);
    const cerca = jugadorMasCercano(e.location, e.dimension, cfg.radio);
    if (!cerca) { apagarAnimacion(e); continue; }
    if (cerca.dist < 2.5) { apagarAnimacion(e); continue; } // ya está encima
    if (veAlJugador(e, cerca.jugador, cerca.dist)) { apagarAnimacion(e); continue; }

    // Romper hasta 2 bloques permitidos del frente. El coste del bloque más
    // duro roto define el cooldown (obsidiana ≈ 30 s, tierra casi nada).
    let rotos = 0, peorCoste = 0;
    for (const [x, y, z] of celdasFrente(e, cerca.jugador)) {
      if (rotos >= MAX_BLOQUES_POR_ZOMBIE || presupuesto <= 0) break;
      try {
        const b = e.dimension.getBlock({ x, y, z });
        if (!b || b.isAir || b.isLiquid) continue;
        const coste = costeBloque(b.typeId);
        if (coste < 0) continue; // fuera de la lista permitida: NO se toca
        b.setPermutation(AIRE);
        rotos++;
        presupuesto--;
        peorCoste = Math.max(peorCoste, coste);
      } catch { }
    }

    if (rotos > 0) {
      try { e.dimension.playSound("dig.stone", e.location); } catch { }
      // Solo el Minero tiene la propiedad de animación za:accion.
      if (e.typeId === "za:zombie_minero") {
        try { e.setProperty("za:accion", 1); } catch { }
      }
      cooldowns.set(e.id, ahora + cfg.cdBase + peorCoste);
    } else {
      apagarAnimacion(e);
      cooldowns.set(e.id, ahora + 20); // nada que romper aquí: reintenta luego
    }
  }

  // Limpieza del Map de cooldowns (entidades muertas/despawneadas).
  if (cooldowns.size > 128) {
    const vivos = new Set(excavadores.map(e => e.id));
    for (const id of cooldowns.keys()) if (!vivos.has(id)) cooldowns.delete(id);
  }
}

function apagarAnimacion(e) {
  if (e.typeId === "za:zombie_minero") {
    try { if (e.getProperty("za:accion") !== 0) e.setProperty("za:accion", 0); } catch { }
  }
}

export function initMinero() {
  system.runInterval(pasadaDeExcavacion, 10);
}
