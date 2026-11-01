import { BlockPermutation, system } from "@minecraft/server";
import { ANIM, PARTICLES } from "../config.js";
import { torreta } from "../construccion.js";
import { sostener } from "../equipo.js";
import { protegido } from "../estructuras.js";
import { practicar, variante } from "../habilidades.js";
import { animate, blockAt, flat, impulse, now, particleAt, sound, soundAt } from "../util.js";

// Combinaciones de redstone que va aprendiendo (nodo "torreta" del combate):
// 1 torreta de flechas · 2 torreta doble (una a cada lado) · 3 torreta de TNT ·
// 4 cañón de TNT (lanza TNT encendida en arco hacia ti) · 5 bobina de Tesla (cobre y
// pararrayos: marca el suelo bajo tus pies y cae un rayo; ¡muévete!).

function libre(dim, p) {
  const b = blockAt(dim, p);
  return !!b && (b.isAir || b.typeId.endsWith("grass") || b.typeId === "minecraft:short_grass") && !protegido(p);
}

function sitioAlLado(npc, jugador, lado, alto) {
  const d = flat(npc.location, jugador.location);
  const base = { x: Math.floor(npc.location.x - d.z * lado * 2), y: Math.floor(npc.location.y), z: Math.floor(npc.location.z + d.x * lado * 2) };
  for (let h = 0; h < alto; h++) if (!libre(npc.dimension, { x: base.x, y: base.y + h, z: base.z })) return undefined;
  return base;
}

function quitar(dim, lista) {
  for (const p of lista) {
    try {
      const b = blockAt(dim, p);
      if (b && !b.isAir) b.setType("minecraft:air");
      particleAt(dim, PARTICLES.construir, { x: p.x + 0.5, y: p.y + 0.5, z: p.z + 0.5 });
    } catch {
      // Chunk descargado.
    }
  }
}

// Cañón: bloque de obsidiana con un dispensador encima que mira hacia ti; dispara
// tres TNT encendidas en arco.
function canon(npc, jugador) {
  const base = sitioAlLado(npc, jugador, Math.random() < 0.5 ? -1 : 1, 2);
  if (!base) return false;
  const dim = npc.dimension;
  const d = flat(npc.location, jugador.location);
  const cara = Math.abs(d.x) > Math.abs(d.z) ? (d.x > 0 ? 5 : 4) : d.z > 0 ? 3 : 2;
  const arriba = { x: base.x, y: base.y + 1, z: base.z };
  try {
    sostener(npc, "minecraft:dispenser");
    animate(npc, ANIM.colocar);
    blockAt(dim, base)?.setType("minecraft:obsidian");
    blockAt(dim, arriba)?.setPermutation(BlockPermutation.resolve("minecraft:dispenser", { facing_direction: cara }));
  } catch {
    return false;
  }
  for (let k = 0; k < 3; k++) {
    system.runTimeout(() => {
      if (!jugador.isValid) return;
      try {
        const salida = { x: arriba.x + 0.5 + d.x * 0.8, y: arriba.y + 0.9, z: arriba.z + 0.5 + d.z * 0.8 };
        const tnt = dim.spawnEntity("minecraft:tnt", salida);
        const v = jugador.getVelocity();
        const t = 30; // ticks de vuelo
        const dx = jugador.location.x + v.x * t * 0.6 - salida.x;
        const dz = jugador.location.z + v.z * t * 0.6 - salida.z;
        const dy = jugador.location.y - salida.y;
        impulse(tnt, { x: dx / t * 1.15, y: 0.04 * t / 2 + dy / t, z: dz / t * 1.15 });
        soundAt(dim, salida, "random.explode", 1.8, 0.35);
        particleAt(dim, PARTICLES.estallido, salida);
      } catch {
        // Sin TNT.
      }
    }, 20 + k * 28);
  }
  system.runTimeout(() => quitar(dim, [arriba, base]), 150);
  return true;
}

// Bobina de Tesla: dos bloques de cobre y un pararrayos. Marca el suelo bajo tus pies
// con chispas y un segundo después cae un rayo ahí (tres veces).
function bobina(npc, jugador) {
  const base = sitioAlLado(npc, jugador, Math.random() < 0.5 ? -1 : 1, 3);
  if (!base) return false;
  const dim = npc.dimension;
  const partes = [base, { x: base.x, y: base.y + 1, z: base.z }, { x: base.x, y: base.y + 2, z: base.z }];
  try {
    sostener(npc, "minecraft:lightning_rod");
    animate(npc, ANIM.colocar);
    blockAt(dim, partes[0])?.setType("minecraft:copper_block");
    blockAt(dim, partes[1])?.setType("minecraft:copper_block");
    blockAt(dim, partes[2])?.setPermutation(BlockPermutation.resolve("minecraft:lightning_rod", { facing_direction: 1 }));
  } catch {
    return false;
  }
  soundAt(dim, base, "beacon.power", 1.6, 1);
  for (let k = 0; k < 3; k++) {
    const marca = 24 + k * 44;
    system.runTimeout(() => {
      if (!jugador.isValid) return;
      const objetivo = { ...jugador.location };
      for (let t = 0; t < 20; t += 4) {
        system.runTimeout(() => {
          particleAt(dim, PARTICLES.aviso, { x: objetivo.x, y: objetivo.y + 0.1, z: objetivo.z });
          particleAt(dim, PARTICLES.chispaElectrica, { x: partes[2].x + 0.5, y: partes[2].y + 1, z: partes[2].z + 0.5 });
        }, t);
      }
      soundAt(dim, partes[2], "random.fizz", 1.6, 0.8);
      system.runTimeout(() => {
        try {
          dim.spawnEntity("minecraft:lightning_bolt", objetivo);
        } catch {
          // Sin rayo.
        }
      }, 22);
    }, marca);
  }
  system.runTimeout(() => quitar(dim, [partes[2], partes[1], partes[0]]), 190);
  return true;
}

// Acción del nodo "torreta": la combinación según lo que sabe.
export function usarRedstone(npc, s, jugador) {
  const n = Math.max(1, variante(npc, s, "redstone"));
  s.ocupadoHasta = now() + 20;
  let hecho = false;
  if (n === 5) hecho = bobina(npc, jugador);
  else if (n === 4) hecho = canon(npc, jugador);
  else if (n === 3) hecho = torreta(npc, jugador, { tnt: true });
  else if (n === 2) hecho = torreta(npc, jugador, { tnt: false, lado: 1 }) && (torreta(npc, jugador, { tnt: false, lado: -1 }) || true);
  if (!hecho) hecho = torreta(npc, jugador);
  if (hecho) practicar(npc, s, "redstone", 0.05);
  return hecho;
}
