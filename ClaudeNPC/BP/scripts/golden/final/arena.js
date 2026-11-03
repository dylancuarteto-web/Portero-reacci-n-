import { BlockPermutation, StructureAnimationMode, StructureSaveMode, system, world } from "@minecraft/server";
import { GOLDEN_FINAL, PARTICLES } from "../../config.js";
import { particleAt, soundAt } from "../../util.js";

// Arena dorada: al chasquear los dedos en la cinemática, el terreno alrededor de Golden se
// vuelve una zona de combate de oro CERRADA: piso con rayos y anillos de luz, paredes y techo
// de vidrio dorado con columnas, columnas con velas, faroles y pedestales para los relojes.
// Antes se guarda el terreno original como estructura del mundo; al morir Golden la arena
// "se rompe" y el terreno vuelve bloque por bloque.

const REGISTRO = "claudenpc:arenas";
export const arenas = new Map(); // id de Golden → arena

function leerRegistro() {
  try {
    return JSON.parse(String(world.getDynamicProperty(REGISTRO) ?? "[]"));
  } catch {
    return [];
  }
}

function guardarRegistro(lista) {
  try {
    world.setDynamicProperty(REGISTRO, JSON.stringify(lista));
  } catch {
    // Sin propiedades dinámicas.
  }
}

function nombreDe(id) {
  return `claudenpc:arena_${String(id).replace(/-/g, "m").replace(/[^0-9a-z_]/gi, "_")}`;
}

// Puntos de la arena (relativos a su centro): columnas, faroles y pedestales de los relojes.
const memo = new Map();
function puntos(nombre, R, fn) {
  const k = `${nombre}:${R}`;
  if (!memo.has(k)) memo.set(k, fn());
  return memo.get(k);
}

export function columnas(R = GOLDEN_FINAL.arenaRadio) {
  return puntos("col", R, () => {
    const lista = [];
    for (let k = 0; k < 8; k++) {
      const a = ((22.5 + 45 * k) * Math.PI) / 180;
      lista.push({ x: Math.round(Math.cos(a) * (R - 4)), z: Math.round(Math.sin(a) * (R - 4)) });
    }
    return lista;
  });
}

export function faroles(R = GOLDEN_FINAL.arenaRadio) {
  return puntos("far", R, () => {
    const lista = [];
    for (let k = 0; k < 16; k++) {
      const a = ((11.25 + 22.5 * k) * Math.PI) / 180;
      lista.push({ x: Math.round(Math.cos(a) * (R - 1.8)), z: Math.round(Math.sin(a) * (R - 1.8)) });
    }
    return lista;
  });
}

export function pedestales(R = GOLDEN_FINAL.arenaRadio) {
  const d = Math.round(R * 0.62);
  return [{ x: d, z: 0 }, { x: -d, z: 0 }, { x: 0, z: d }, { x: 0, z: -d }];
}

// Un punto dentro de la arena (a "margen" de la pared y bajo el techo).
export function limitar(arena, p, margen = 2.5) {
  if (!arena) return p;
  const cx = arena.centro.x + 0.5;
  const cz = arena.centro.z + 0.5;
  const dx = p.x - cx;
  const dz = p.z - cz;
  const d = Math.hypot(dx, dz);
  const max = arena.R - margen;
  const k = d > max ? max / d : 1;
  return { x: cx + dx * k, y: Math.min(Math.max(p.y, arena.centro.y + 0.05), arena.centro.y + GOLDEN_FINAL.arenaAlto - 3.5), z: cz + dz * k };
}

export function crearArena(id, dim, centro) {
  const R = GOLDEN_FINAL.arenaRadio;
  const H = GOLDEN_FINAL.arenaAlto;
  const c = { x: Math.floor(centro.x), y: Math.floor(centro.y), z: Math.floor(centro.z) };
  let min = -64;
  let max = 320;
  try {
    min = dim.heightRange.min;
    max = dim.heightRange.max - 1;
  } catch {
    // Rango por defecto.
  }
  const desde = { x: c.x - R - 1, y: Math.max(min, c.y - 2), z: c.z - R - 1 };
  const hasta = { x: c.x + R + 1, y: Math.min(max, c.y + H - 1), z: c.z + R + 1 };
  const arena = { id, dim, dimId: dim.id, centro: c, desde, hasta, R, nombre: nombreDe(id), guardada: false, puesta: false };
  arenas.set(id, arena);
  return arena;
}

// Guarda el terreno original (para devolverlo al terminar).
export function guardarTerreno(arena) {
  const sm = world.structureManager;
  // Si ya hay un terreno guardado (el mundo se cerró a la mitad), es el original: no se pisa.
  const previo = leerRegistro().find((a) => a.id === arena.id);
  try {
    if (sm.get(arena.nombre)) {
      const igual = previo && previo.dim === arena.dimId && ["x", "y", "z"].every((k) => previo.desde[k] === arena.desde[k]);
      if (igual) {
        arena.guardada = true;
        return true;
      }
      // Era de otro lugar: primero se devuelve aquel terreno.
      if (previo) sm.place(arena.nombre, world.getDimension(previo.dim), previo.desde);
      sm.delete(arena.nombre);
    }
  } catch {
    // No había.
  }
  try {
    sm.createFromWorld(arena.nombre, arena.dim, arena.desde, arena.hasta,
      { includeBlocks: true, includeEntities: false, saveMode: StructureSaveMode.World });
    arena.guardada = true;
    const lista = leerRegistro().filter((a) => a.id !== arena.id);
    lista.push({ id: arena.id, nombre: arena.nombre, dim: arena.dimId, desde: arena.desde, hasta: arena.hasta, centro: arena.centro });
    guardarRegistro(lista);
  } catch {
    arena.guardada = false;
  }
  return arena.guardada;
}

const P = {};
function perm(nombre, estados) {
  const clave = nombre + JSON.stringify(estados ?? {});
  if (!P[clave]) {
    try {
      P[clave] = BlockPermutation.resolve(nombre, estados);
    } catch {
      P[clave] = BlockPermutation.resolve("minecraft:gold_block");
    }
  }
  return P[clave];
}

// Qué bloque va en cada lugar de la arena (relativo al centro; y = 0 es el nivel de los pies).
export function bloqueArena(dx, dy, dz, R = GOLDEN_FINAL.arenaRadio) {
  const d = Math.hypot(dx, dz);
  if (d > R + 0.5) return undefined;
  const techo = GOLDEN_FINAL.arenaAlto - 1;
  const a = Math.atan2(dz, dx);
  if (dy === -2) return "minecraft:gold_block";
  if (dy === -1) {
    if (d < 1.5) return "minecraft:ochre_froglight";
    if (d < 3.5) return "minecraft:raw_gold_block";
    if ((d >= 7 && d < 7.9) || (d >= 14 && d < 14.9 && Math.abs(Math.sin(8 * a)) > 0.3)) return "minecraft:ochre_froglight";
    if (d >= R - 1.5) return "minecraft:raw_gold_block";
    if (Math.abs(Math.sin(4 * a)) < 0.12) return "minecraft:raw_gold_block";
    return "minecraft:gold_block";
  }
  // Pared (anillo exterior) y techo: vidrio dorado con columnas de oro.
  if (d >= R - 1) {
    if (dy > techo) return undefined;
    const pilar = Math.abs(Math.sin(12 * a)) < 0.14;
    if (dy === 0 || dy === techo || dy === techo - 1) return "minecraft:gold_block";
    if (pilar) return dy === 6 ? "minecraft:ochre_froglight" : "minecraft:gold_block";
    return "minecraft:yellow_stained_glass";
  }
  if (dy === techo) {
    if (d < 2.5) return "minecraft:ochre_froglight";
    if ((d >= 9 && d < 9.9) || (d >= R - 3 && d < R - 2)) return "minecraft:gold_block";
    if (Math.abs(Math.sin(4 * a)) < 0.06) return "minecraft:gold_block";
    return "minecraft:yellow_stained_glass";
  }
  if (dy > techo) return undefined;
  const es = (lista) => lista.some((c) => c.x === dx && c.z === dz);
  if (es(columnas(R))) {
    if (dy === 0) return "minecraft:raw_gold_block";
    if (dy <= 3) return "minecraft:gold_block";
    if (dy === 4) return "minecraft:ochre_froglight";
    if (dy === 5) return "vela";
    return "minecraft:air";
  }
  if (es(pedestales(R))) {
    if (dy === 0) return "minecraft:raw_gold_block";
    if (dy === 1) return "minecraft:gold_block";
    return "minecraft:air";
  }
  if (es(faroles(R))) {
    if (dy === 0) return "minecraft:raw_gold_block";
    if (dy === 1) return "farol";
    return "minecraft:air";
  }
  return "minecraft:air";
}

// Los que quedaron fuera (o dentro de la pared) entran a la arena, mirando al centro.
export function llevarDentro(arena, jugadores) {
  const c = { x: arena.centro.x + 0.5, y: arena.centro.y, z: arena.centro.z + 0.5 };
  for (const p of jugadores) {
    try {
      if (!p.isValid || p.dimension.id !== arena.dimId) continue;
      const dx = p.location.x - c.x;
      const dz = p.location.z - c.z;
      const d = Math.hypot(dx, dz);
      const dentro = d <= arena.R - 2 && p.location.y >= c.y - 0.5 && p.location.y <= c.y + GOLDEN_FINAL.arenaAlto - 3;
      if (dentro) continue;
      const k = d > 0.5 ? (arena.R - 6) / d : 0;
      const lugar = { x: c.x + (d > 0.5 ? dx * k : arena.R - 6), y: c.y + 0.05, z: c.z + (d > 0.5 ? dz * k : 0) };
      p.teleport(lugar, { facingLocation: { x: c.x, y: c.y + 1.5, z: c.z }, keepVelocity: false });
    } catch {
      // Jugador no disponible.
    }
  }
}

// Prepara la arena dorada en memoria poco a poco (durante la cinemática) para ponerla de una
// vez con el chasquido. Solo se anotan los lugares que cambian.
function* armar(arena) {
  const turno = (arena.turno = (arena.turno ?? 0) + 1); // si empieza otro armado, este se detiene
  const sm = world.structureManager;
  const { desde, hasta, centro, R } = arena;
  const tam = { x: hasta.x - desde.x + 1, y: hasta.y - desde.y + 1, z: hasta.z - desde.z + 1 };
  const nombre = `${arena.nombre}_oro`;
  try {
    if (sm.get(nombre)) sm.delete(nombre);
  } catch {
    // No había.
  }
  let s;
  try {
    s = sm.createEmpty(nombre, tam, StructureSaveMode.Memory);
  } catch {
    return;
  }
  let n = 0;
  for (let x = 0; x < tam.x; x++) {
    for (let z = 0; z < tam.z; z++) {
      for (let y = 0; y < tam.y; y++) {
        const b = bloqueArena(desde.x + x - centro.x, desde.y + y - centro.y, desde.z + z - centro.z, R);
        if (!b) continue;
        try {
          s.setBlockPermutation({ x, y, z }, b === "vela" ? perm("minecraft:yellow_candle", { candles: 3, lit: true })
            : b === "farol" ? perm("minecraft:lantern", { hanging: false }) : perm(b));
        } catch {
          // Bloque no disponible.
        }
        if (++n % 300 === 0) {
          yield;
          if (arena.turno !== turno) return;
        }
      }
    }
  }
  if (arena.turno === turno) arena.oro = s;
}

export function prepararArena(arena) {
  if (arena.oro || arena.armando) return;
  arena.armando = true;
  try {
    system.runJob(armar(arena));
  } catch {
    // Sin trabajos: se arma al ponerla.
  }
}

export function ponerArena(arena) {
  const sm = world.structureManager;
  const { centro, R } = arena;
  if (!arena.oro) {
    const g = armar(arena);
    while (!g.next().done) {
      // Todo de una vez.
    }
  }
  if (!arena.oro) return false;
  try {
    sm.place(arena.oro, arena.dim, arena.desde);
    arena.puesta = true;
  } catch {
    arena.puesta = false;
  }
  try {
    sm.delete(arena.oro);
  } catch {
    // Ya no está.
  }
  arena.oro = undefined;
  // Los que están cerca quedan dentro de la arena cerrada (nadie queda en la pared).
  try {
    llevarDentro(arena, arena.dim.getPlayers({ location: { x: centro.x + 0.5, y: centro.y, z: centro.z + 0.5 }, maxDistance: R + 8 }));
  } catch {
    // Jugadores no disponibles.
  }
  return arena.puesta;
}

export function dentroDeArena(dimId, p) {
  for (const a of arenas.values()) {
    if (!a.puesta || a.dimId !== dimId) continue;
    if (p.x >= a.desde.x && p.x <= a.hasta.x + 0.999 && p.y >= a.desde.y && p.y <= a.hasta.y + 0.999 && p.z >= a.desde.z && p.z <= a.hasta.z + 0.999) return a;
  }
  return undefined;
}

// La arena se rompe: el terreno original vuelve bloque por bloque y saltan trozos de oro.
export function romperArena(arena, segundos = 4) {
  if (!arena) return;
  arenas.delete(arena.id);
  const sm = world.structureManager;
  const { centro, R, dim } = arena;
  if (arena.guardada) {
    try {
      sm.place(arena.nombre, dim, arena.desde, segundos > 0
        ? { animationMode: StructureAnimationMode.Blocks, animationSeconds: segundos } : undefined);
    } catch {
      // El terreno se queda como está.
    }
  }
  if (segundos > 0) {
    let t = 0;
    const id = system.runInterval(() => {
      t += 2;
      if (t > segundos * 20) {
        system.clearRun(id);
        return;
      }
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * R;
        const p = { x: centro.x + 0.5 + Math.cos(a) * r, y: centro.y - 0.5 + Math.random() * 2, z: centro.z + 0.5 + Math.sin(a) * r };
        particleAt(dim, PARTICLES.fragmento, p);
        if (i === 0) soundAt(dim, p, Math.random() < 0.5 ? "random.break" : "dig.stone", 0.6 + Math.random() * 0.5, 0.8);
      }
    }, 2);
  }
  system.runTimeout(() => {
    try {
      sm.delete(arena.nombre);
    } catch {
      // Ya no está.
    }
    guardarRegistro(leerRegistro().filter((a) => a.id !== arena.id));
  }, Math.max(1, segundos * 20 + 40));
}

// Al cargar el mundo: arenas que quedaron puestas sin su Golden vuelven a su terreno.
export function revisarArenasHuerfanas(hayGolden) {
  for (const r of leerRegistro()) {
    if (hayGolden(r.id)) continue;
    try {
      const dim = world.getDimension(r.dim);
      const b = dim.getBlock(r.centro);
      if (!b) continue; // sin cargar: más adelante
      world.structureManager.place(r.nombre, dim, r.desde);
      world.structureManager.delete(r.nombre);
    } catch {
      continue;
    }
    guardarRegistro(leerRegistro().filter((a) => a.id !== r.id));
  }
}

// La arena no se puede picar ni romper con explosiones mientras dure la pelea.
world.beforeEvents.playerBreakBlock.subscribe((ev) => {
  try {
    if (dentroDeArena(ev.block.dimension.id, ev.block.location)) ev.cancel = true;
  } catch {
    // Bloque no disponible.
  }
});

world.beforeEvents.explosion.subscribe((ev) => {
  try {
    const dimId = ev.dimension.id;
    if (![...arenas.values()].some((a) => a.puesta && a.dimId === dimId)) return;
    const bloques = ev.getImpactedBlocks();
    const quedan = bloques.filter((b) => !dentroDeArena(dimId, b.location));
    if (quedan.length !== bloques.length) ev.setImpactedBlocks(quedan);
  } catch {
    // Sin cambios.
  }
});
