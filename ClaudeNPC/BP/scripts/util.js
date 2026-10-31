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

// Gira la cabeza y el cuerpo hacia un punto sin teletransportar (así no da tirones).
export function mirarA(entity, location) {
  try {
    const o = entity.getHeadLocation();
    const dx = location.x - o.x;
    const dy = location.y - o.y;
    const dz = location.z - o.z;
    const yaw = (Math.atan2(-dx, dz) * 180) / Math.PI;
    const pitch = (-Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI;
    entity.setRotation({ x: pitch, y: yaw });
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

export function solido(block) {
  return !!block && !block.isAir && !block.isLiquid && !reemplazable(block);
}

export function esAgua(block) {
  return !!block && (block.typeId === "minecraft:water" || block.typeId === "minecraft:flowing_water");
}

export function distancia2D(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

// Clave de un bloque en un mapa (dimensión + coordenadas enteras).
export function clave(dimension, p) {
  return `${dimension.id}|${Math.floor(p.x)},${Math.floor(p.y)},${Math.floor(p.z)}`;
}

// Rompe un bloque como lo haría un jugador: suelta el objeto (y lo que tenga dentro
// un cofre o un horno) con las partículas y el sonido normales del juego.
export function romperDestruyendo(dimension, p) {
  try {
    dimension.runCommand(`setblock ${Math.floor(p.x)} ${Math.floor(p.y)} ${Math.floor(p.z)} air destroy`);
    return true;
  } catch {
    return false;
  }
}

// Orientaciones. "frente" es north/south/west/east.
export const FRENTES = { north: { x: 0, z: -1 }, south: { x: 0, z: 1 }, west: { x: -1, z: 0 }, east: { x: 1, z: 0 } };
export const OPUESTO = { north: "south", south: "north", west: "east", east: "west" };
// facing_direction de carteles y dispensadores: 2 norte, 3 sur, 4 oeste, 5 este.
export const FACING = { north: 2, south: 3, west: 4, east: 5 };
// weirdo_direction de escaleras: lado donde queda el respaldo (0 este, 1 oeste, 2 sur, 3 norte).
export const ESCALON = { east: 0, west: 1, south: 2, north: 3 };

export function nombreDireccion(dx, dz) {
  if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? "east" : "west";
  return dz > 0 ? "south" : "north";
}

// Mensaje corto en la barra de acción para los jugadores cercanos.
export function avisar(dimension, location, texto, radio = 24) {
  try {
    for (const p of dimension.getPlayers({ location, maxDistance: radio })) p.onScreenDisplay.setActionBar(texto);
  } catch {
    // Sin jugadores.
  }
}

// Elige al azar según pesos: lista de { p, ... }.
export function sortear(lista) {
  const total = lista.reduce((t, c) => t + c.p, 0);
  let r = Math.random() * total;
  for (const c of lista) {
    r -= c.p;
    if (r <= 0) return c;
  }
  return lista[lista.length - 1];
}

// true cada "ticks" ticks para esa clave (sin depender de en qué tick empezó el bucle).
export function cada(state, nombre, ticks) {
  const t = now();
  if (t - (state.cd[nombre] ?? -Infinity) < ticks) return false;
  state.cd[nombre] = t;
  return true;
}
