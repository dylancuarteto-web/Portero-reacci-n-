import { MolangVariableMap } from "@minecraft/server";
import { PARTICLES } from "./config.js";

// Partículas visibles para todos.
export function burst(dimension, id, location) {
  try {
    dimension.spawnParticle(id, location);
  } catch {
    // Chunk no cargado.
  }
}

// Partículas visibles solo para un jugador (predicción).
export function forPlayer(player, id, location) {
  try {
    player.spawnParticle(id, location);
  } catch {
    // Fuera de rango o jugador inválido.
  }
}

// Estela de chispas a lo largo de un segmento (rayo láser). Una sola llamada:
// la partícula reparte sus chispas entre start y end con variables Molang.
export function trail(dimension, id, start, end) {
  const d = sub(end, start);
  const len = length(d);
  if (len < 0.3) return;
  const vars = new MolangVariableMap();
  vars.setFloat("variable.dir_x", d.x / len);
  vars.setFloat("variable.dir_y", d.y / len);
  vars.setFloat("variable.dir_z", d.z / len);
  vars.setFloat("variable.longitud", len);
  try {
    dimension.spawnParticle(id, start, vars);
  } catch {
    // Chunk no cargado.
  }
}

export function patchGlint(player) {
  const head = player.getHeadLocation();
  const dir = player.getViewDirection();
  // Ojo derecho del personaje: a su derecha y hacia delante.
  burst(player.dimension, PARTICLES.parcheDestello, {
    x: head.x + dir.x * 0.3 - dir.z * 0.12,
    y: head.y + 0.05,
    z: head.z + dir.z * 0.3 + dir.x * 0.12,
  });
}

export function add(a, b, k = 1) {
  return { x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k };
}

export function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function length(v) {
  return Math.hypot(v.x, v.y, v.z);
}

export function normalize(v) {
  const l = length(v) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}
