import { system } from "@minecraft/server";

export const now = () => system.currentTick;

export function burst(entity, id, offset = { x: 0, y: 1, z: 0 }) {
  try {
    const l = entity.location;
    entity.dimension.spawnParticle(id, { x: l.x + offset.x, y: l.y + offset.y, z: l.z + offset.z });
  } catch {
    // Chunk no cargado.
  }
}

export function particleAt(dimension, id, location) {
  try {
    dimension.spawnParticle(id, location);
  } catch {
    // Chunk no cargado.
  }
}

export function sound(entity, id, pitch = 1) {
  try {
    entity.dimension.playSound(id, entity.location, { pitch });
  } catch {
    // Sonido no disponible.
  }
}

export function animate(entity, animation) {
  try {
    entity.playAnimation(animation, { blendOutTime: 0.15 });
  } catch {
    // Paquete de recursos no activo.
  }
}

export function run(entity, command) {
  try {
    entity.runCommand(command);
    return true;
  } catch {
    return false;
  }
}

export function flat(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const d = Math.hypot(dx, dz) || 1;
  return { x: dx / d, z: dz / d, d };
}

export const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

export function blockAt(dimension, location) {
  try {
    return dimension.getBlock({ x: Math.floor(location.x), y: Math.floor(location.y), z: Math.floor(location.z) });
  } catch {
    return undefined;
  }
}
