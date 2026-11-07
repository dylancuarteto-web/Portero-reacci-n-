import { PARTICLES } from "../config.js";
import { now } from "../util.js";
import { INFINITO_CFG, PART_INF } from "./config.js";

// VFXController: partículas del Infinito con presupuesto por segundo (cada Infinito puede
// lanzar como mucho INFINITO_CFG.particulasPorSegundo). Lo importante (evolución, sello)
// tiene una reserva pequeña aparte. El aura de la fase 20 la dibuja el cliente con un
// controlador de animación (query.mark_variant), así que no cuesta script.

function cupo(s, n, reserva = 0) {
  const seg = Math.floor(now() / 20);
  if (s.vfx.seg !== seg) {
    s.vfx.seg = seg;
    s.vfx.n = 0;
  }
  if (s.vfx.n + n > INFINITO_CFG.particulasPorSegundo + reserva) return false;
  s.vfx.n += n;
  return true;
}

export function particula(s, dimension, id, pos, reserva = 0) {
  if (!cupo(s, 1, reserva)) return false;
  try {
    dimension.spawnParticle(id, pos);
    return true;
  } catch {
    return false;
  }
}

const sobre = (e, y = 1) => ({ x: e.location.x, y: e.location.y + y, z: e.location.z });

export function vfxGolpe(e, s, objetivo, critico) {
  try {
    const p = { x: (e.location.x + objetivo.location.x) / 2, y: objetivo.location.y + 1.1, z: (e.location.z + objetivo.location.z) / 2 };
    particula(s, e.dimension, PART_INF.golpe, p);
    if (critico) particula(s, e.dimension, PART_INF.critico, { x: objetivo.location.x, y: objetivo.location.y + 1, z: objetivo.location.z });
  } catch {
    // Objetivo descargado.
  }
}

export function vfxCambio(e, s) {
  particula(s, e.dimension, PARTICLES.cambio, sobre(e, 1.2));
}

export function vfxPerla(e, s) {
  particula(s, e.dimension, PARTICLES.teletransporte, sobre(e, 1), 2);
}

export function vfxCura(e, s) {
  particula(s, e.dimension, PART_INF.cura, sobre(e, 1));
}

// Evolución: cuanto más alto el tramo, más capas (anillo, chispas de evolución, columna).
export function vfxEvolucion(e, s, tramo) {
  const capas = [{ id: PART_INF.anillo, y: 0.1 }, { id: PART_INF.evolucion, y: 1 }];
  if (tramo >= 1) capas.push({ id: PART_INF.anillo, y: 1.2 });
  if (tramo >= 2) capas.push({ id: PART_INF.evolucion, y: 2 });
  if (tramo >= 3) capas.push({ id: PART_INF.anillo, y: 2.2 }, { id: PART_INF.golpe, y: 1.4 });
  if (tramo >= 4) capas.push({ id: PART_INF.evolucion, y: 0.4 }, { id: PART_INF.anillo, y: 3.2 }, { id: PART_INF.alma, y: 2.4 });
  for (const c of capas) particula(s, e.dimension, c.id, sobre(e, c.y), 12);
}

export function vfxAlma(e, s) {
  particula(s, e.dimension, PART_INF.alma, sobre(e, 1.6), 4);
}

// Marcas del sello: una partícula en cada bloque que falta.
export function vfxMarcas(s, dimension, faltan) {
  for (const p of faltan) particula(s, dimension, PART_INF.selloMarca, { x: p.x + 0.5, y: p.y + 0.5, z: p.z + 0.5 }, 16);
}

export function vfxSello(e, s) {
  for (const y of [0.3, 1, 1.8]) particula(s, e.dimension, PART_INF.selloRomper, sobre(e, y), 12);
}
