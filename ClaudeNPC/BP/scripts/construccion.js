import { BlockPermutation, ItemStack, system } from "@minecraft/server";
import { ANIM, NIVEL_BLOQUE, PARTICLES } from "./config.js";
import { sostener } from "./equipo.js";
import { animate, blockAt, flat, particleAt, sound } from "./util.js";

const BLOQUE = "minecraft:cobblestone";

function colocar(dimension, location, type) {
  try {
    const block = blockAt(dimension, location);
    if (!block || !block.isAir) return false;
    block.setType(type);
    particleAt(dimension, PARTICLES.construir, { x: block.location.x + 0.5, y: block.location.y + 0.5, z: block.location.z + 0.5 });
    return true;
  } catch {
    return false;
  }
}

function solido(block) {
  return !!block && !block.isAir && !block.isLiquid;
}

// Rompe un bloque si su pico tiene nivel suficiente y suelta el objeto.
export function romper(npc, state, block) {
  if (!block || block.isAir || block.isLiquid) return false;
  const nivel = NIVEL_BLOQUE[block.typeId];
  if (nivel === undefined || nivel > state.nivelPico) return false;
  try {
    const center = { x: block.location.x + 0.5, y: block.location.y + 0.5, z: block.location.z + 0.5 };
    const drop = block.typeId === "minecraft:stone" ? "minecraft:cobblestone" : block.typeId;
    block.setType("minecraft:air");
    npc.dimension.spawnItem(new ItemStack(drop, 1), center);
    particleAt(npc.dimension, PARTICLES.construir, center);
    sound(npc, "dig.stone");
    state.minados++;
    return true;
  } catch {
    return false;
  }
}

// Sube construyendo un pilar bajo sus pies.
export function pilar(npc) {
  sostener(npc, BLOQUE);
  const pie = { ...npc.location };
  try {
    npc.applyImpulse({ x: 0, y: 0.48, z: 0 });
  } catch {
    return;
  }
  animate(npc, ANIM.colocar);
  system.runTimeout(() => {
    if (npc.isValid) colocar(npc.dimension, pie, BLOQUE);
  }, 6);
}

// Cava hacia abajo para alcanzar a un jugador que está más abajo.
export function cavar(npc, state) {
  animate(npc, ANIM.golpe);
  romper(npc, state, blockAt(npc.dimension, { x: npc.location.x, y: npc.location.y - 1, z: npc.location.z }));
}

// Tiende un puente si delante hay un hueco.
export function puente(npc, objetivo) {
  const dir = flat(npc.location, objetivo.location);
  const delante = { x: npc.location.x + dir.x, y: npc.location.y - 1, z: npc.location.z + dir.z };
  const block = blockAt(npc.dimension, delante);
  if (!block?.isAir) return false;
  sostener(npc, BLOQUE);
  animate(npc, ANIM.colocar);
  return colocar(npc.dimension, delante, BLOQUE);
}

// Trampa: TNT bajo una placa de presión en el camino previsto del jugador.
export function trampa(npc, jugador) {
  const v = jugador.getVelocity();
  const p = { x: jugador.location.x + v.x * 12, y: jugador.location.y, z: jugador.location.z + v.z * 12 };
  const placa = blockAt(npc.dimension, p);
  const suelo = blockAt(npc.dimension, { x: p.x, y: p.y - 1, z: p.z });
  if (!placa?.isAir || !solido(suelo) || suelo.typeId === "minecraft:bedrock") return false;
  try {
    sostener(npc, "minecraft:tnt");
    animate(npc, ANIM.colocar);
    suelo.setType("minecraft:tnt");
    placa.setType("minecraft:stone_pressure_plate");
    return true;
  } catch {
    return false;
  }
}

function direccionDispensador(dir) {
  // facing_direction: 2 norte (-z), 3 sur (+z), 4 oeste (-x), 5 este (+x).
  if (Math.abs(dir.x) > Math.abs(dir.z)) return dir.x > 0 ? 5 : 4;
  return dir.z > 0 ? 3 : 2;
}

// Torreta de redstone: dispensador cargado (flechas o TNT) que dispara al jugador
// con pulsos de un bloque de redstone; se desmonta sola.
export function torreta(npc, jugador) {
  const dir = flat(npc.location, jugador.location);
  const lado = { x: -dir.z * 2, z: dir.x * 2 };
  const base = { x: npc.location.x + lado.x, y: npc.location.y, z: npc.location.z + lado.z };
  const pos = blockAt(npc.dimension, base);
  const arriba = blockAt(npc.dimension, { x: base.x, y: base.y + 1, z: base.z });
  if (!pos?.isAir || !arriba?.isAir) return false;
  const tnt = Math.random() < 0.3;
  try {
    sostener(npc, "minecraft:dispenser");
    animate(npc, ANIM.colocar);
    pos.setPermutation(BlockPermutation.resolve("minecraft:dispenser", { facing_direction: direccionDispensador(dir) }));
    pos.getComponent("minecraft:inventory")?.container?.addItem(
      new ItemStack(tnt ? "minecraft:tnt" : "minecraft:arrow", tnt ? 3 : 32));
  } catch {
    return false;
  }
  const where = { ...pos.location };
  let disparos = 0;
  const pulsos = tnt ? 3 : 10;
  const id = system.runInterval(() => {
    try {
      const d = blockAt(npc.dimension, where);
      const r = blockAt(npc.dimension, { x: where.x, y: where.y + 1, z: where.z });
      if (!d || d.typeId !== "minecraft:dispenser" || disparos >= pulsos * 2) {
        if (d?.typeId === "minecraft:dispenser") d.setType("minecraft:air");
        if (r?.typeId === "minecraft:redstone_block") r.setType("minecraft:air");
        system.clearRun(id);
        return;
      }
      // Alterna bloque de redstone encima: cada encendido dispara una vez.
      r?.setType(disparos % 2 === 0 ? "minecraft:redstone_block" : "minecraft:air");
      disparos++;
    } catch {
      system.clearRun(id);
    }
  }, 8);
  return true;
}
