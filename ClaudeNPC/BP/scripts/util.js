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

export function soundAt(dimension, location, id, pitch = 1, volume = 1) {
  try {
    dimension.playSound(id, location, { pitch, volume });
  } catch {
    // Sonido no disponible.
  }
}

export function sound(entity, id, pitch = 1, volume = 1) {
  soundAt(entity.dimension, entity.location, id, pitch, volume);
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

export function impulse(entity, v) {
  try {
    entity.applyImpulse(v);
  } catch {
    // Entidad descargada.
  }
}

export function flat(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const d = Math.hypot(dx, dz) || 1;
  return { x: dx / d, z: dz / d, d };
}

export function distancia(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

export const piso = (p) => ({ x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) });
export const centro = (p) => ({ x: Math.floor(p.x) + 0.5, y: Math.floor(p.y), z: Math.floor(p.z) + 0.5 });
export const centroBloque = (p) => ({ x: Math.floor(p.x) + 0.5, y: Math.floor(p.y) + 0.5, z: Math.floor(p.z) + 0.5 });

// Ángulo de giro (yaw) de Minecraft para mirar de "from" hacia "to".
export function yawHacia(from, to) {
  return (Math.atan2(-(to.x - from.x), to.z - from.z) * 180) / Math.PI;
}

export function blockAt(dimension, location) {
  try {
    return dimension.getBlock({ x: Math.floor(location.x), y: Math.floor(location.y), z: Math.floor(location.z) });
  } catch {
    return undefined;
  }
}

// Plantas y capas finas que un jugador reemplaza al construir.
const PLANTAS = new Set([
  "minecraft:short_grass", "minecraft:tall_grass", "minecraft:fern", "minecraft:large_fern", "minecraft:dandelion",
  "minecraft:poppy", "minecraft:blue_orchid", "minecraft:allium", "minecraft:azure_bluet", "minecraft:oxeye_daisy",
  "minecraft:cornflower", "minecraft:lily_of_the_valley", "minecraft:snow_layer", "minecraft:deadbush",
  "minecraft:vine", "minecraft:leaf_litter", "minecraft:wildflowers", "minecraft:pink_petals",
  "minecraft:short_dry_grass", "minecraft:tall_dry_grass", "minecraft:bush", "minecraft:firefly_bush",
  "minecraft:sunflower", "minecraft:lilac", "minecraft:rose_bush", "minecraft:peony", "minecraft:sweet_berry_bush",
]);

export function reemplazable(block) {
  if (!block) return false;
  if (block.isAir) return true;
  const id = block.typeId;
  return PLANTAS.has(id) || id.endsWith("_tulip") || id.endsWith("_sapling");
}

// Coloca un bloque (tipo o permutación) si el sitio está libre (o "forzar" para reemplazar).
export function colocar(dimension, pos, bloque, forzar = false) {
  const b = blockAt(dimension, pos);
  if (!b || (!forzar && !reemplazable(b))) return false;
  try {
    if (typeof bloque === "string") b.setType(bloque);
    else b.setPermutation(bloque);
    particleAt(dimension, "claudenpc:construir", { x: b.location.x + 0.5, y: b.location.y + 0.5, z: b.location.z + 0.5 });
    return true;
  } catch {
    return false;
  }
}

// Altura hasta el suelo debajo de la entidad (Infinity si no hay suelo cargado).
export function alturaSuelo(entity, max = 40) {
  try {
    const hit = entity.dimension.getBlockFromRay(entity.location, { x: 0, y: -1, z: 0 },
      { maxDistance: max, includeLiquidBlocks: true });
    return hit ? entity.location.y - (hit.block.location.y + 1) : Infinity;
  } catch {
    return Infinity;
  }
}

export function mirarA(entity, location) {
  try {
    entity.teleport(entity.location, { facingLocation: location, keepVelocity: true });
  } catch {
    // Sin giro.
  }
}

export function superficie(dimension, x, z) {
  try {
    return dimension.getTopmostBlock({ x: Math.floor(x), z: Math.floor(z) });
  } catch {
    return undefined;
  }
}
