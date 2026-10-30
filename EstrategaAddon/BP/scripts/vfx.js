import { MolangVariableMap } from "@minecraft/server";
import { PARTICLES, SOUNDS } from "./config.js";

// Todas las llamadas visuales se protegen: un chunk descargado o una
// dimensión inválida no debe interrumpir la habilidad.
function spawn(dimension, id, location, vars) {
  try {
    dimension.spawnParticle(id, location, vars);
  } catch {
    // Chunk no cargado o ubicación fuera de límites.
  }
}

function facingVars(direction) {
  const vars = new MolangVariableMap();
  const length = Math.hypot(direction.x, direction.z) || 1;
  vars.setFloat("variable.dir_x", direction.x / length);
  vars.setFloat("variable.dir_z", direction.z / length);
  return vars;
}

export function portal(dimension, location, direction) {
  const vars = facingVars(direction);
  spawn(dimension, PARTICLES.portalRing, location, vars);
  spawn(dimension, PARTICLES.portalSpiral, location, vars);
}

export function mindWave(dimension, location) {
  spawn(dimension, PARTICLES.mindWave, location);
}

export function mindLink(entity) {
  try {
    spawn(entity.dimension, PARTICLES.mindLink, entity.getHeadLocation());
  } catch {
    // La entidad pudo descargarse entre la búsqueda y el efecto.
  }
}

export function stealthSmoke(dimension, location) {
  spawn(dimension, PARTICLES.stealthSmoke, location);
}

export function patchGlint(player) {
  const head = player.getHeadLocation();
  const dir = player.getViewDirection();
  // Ojo derecho del personaje: desplazamiento a su derecha y hacia delante.
  const location = {
    x: head.x + dir.x * 0.3 - dir.z * 0.12,
    y: head.y + 0.05,
    z: head.z + dir.z * 0.3 + dir.x * 0.12,
  };
  spawn(player.dimension, PARTICLES.patchGlint, location);
}

export function playOptionalSound(player, key) {
  const id = SOUNDS[key];
  if (!id) return;
  try {
    player.dimension.playSound(id, player.location);
  } catch {
    // Sonido no definido todavía en el resource pack.
  }
}
