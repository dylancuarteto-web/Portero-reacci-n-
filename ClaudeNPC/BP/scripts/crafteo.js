import { system } from "@minecraft/server";
import { ANIM, CRAFTEO, PARTICLES } from "./config.js";
import { sostener } from "./equipo.js";
import { aprender } from "./iq.js";
import { animate, blockAt, burst, mirarA, now, particleAt, sound } from "./util.js";

const CARDINALES = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];

function lugarMesa(npc) {
  for (const d of CARDINALES) {
    const p = { x: npc.location.x + d.x * 1.3, y: npc.location.y, z: npc.location.z + d.z * 1.3 };
    const b = blockAt(npc.dimension, p);
    const suelo = blockAt(npc.dimension, { x: p.x, y: p.y - 1, z: p.z });
    if (b?.isAir && suelo && !suelo.isAir && !suelo.isLiquid) return b;
  }
  return undefined;
}

// Simula craftear como un jugador: saca la mesa, la coloca, la mira trabajando,
// saca el objeto que devuelve "resultado()" y luego recoge la mesa.
export function simularCrafteo(npc, state, resultado, duracion = CRAFTEO.duracion, despues) {
  const mesa = lugarMesa(npc);
  if (!mesa) return false;
  const where = { ...mesa.location };
  const arriba = { x: where.x + 0.5, y: where.y + 1, z: where.z + 0.5 };
  sostener(npc, "minecraft:crafting_table");
  mirarA(npc, arriba);
  animate(npc, ANIM.colocar);
  try {
    mesa.setType("minecraft:crafting_table");
  } catch {
    return false;
  }
  sound(npc, "use.wood", 1);
  state.ocupadoHasta = now() + duracion + 50;
  system.runTimeout(() => npc.isValid && sostener(npc, "minecraft:air"), 12);
  for (let t = 16; t < duracion; t += 60) {
    system.runTimeout(() => {
      if (!npc.isValid) return;
      mirarA(npc, arriba);
      animate(npc, ANIM.crafteo);
    }, t);
  }
  for (let t = 30; t < duracion; t += 25) {
    system.runTimeout(() => {
      particleAt(npc.dimension, PARTICLES.crafteo, arriba);
      if (npc.isValid) sound(npc, "random.wood_click", 1.1, 0.7);
    }, t);
  }
  system.runTimeout(() => {
    if (!npc.isValid) return;
    sostener(npc, resultado());
    burst(npc, PARTICLES.cambio, { x: 0, y: 1.4, z: 0 });
    sound(npc, "random.levelup", 1.6, 0.6);
    aprender(npc, state, 0.5);
  }, duracion);
  system.runTimeout(() => {
    try {
      const b = blockAt(npc.dimension, where);
      if (b?.typeId === "minecraft:crafting_table") b.setType("minecraft:air");
    } catch {
      // La mesa ya no está.
    }
    if (npc.isValid && despues) despues();
  }, duracion + 40);
  return true;
}
