import { system } from "@minecraft/server";
import { ANIM, MODIFICA_MUNDO, PARTICLES, PICOS } from "./config.js";
import { romper } from "./construccion.js";
import { pico, sostener, vestir } from "./equipo.js";
import { animate, blockAt, burst, now, particleAt, rand, sound } from "./util.js";

// Lo que "saca" de la mesa cuando no tiene materiales para una mejora.
const EXTRAS = ["minecraft:torch", "minecraft:bread", "minecraft:arrow", "minecraft:bow", "minecraft:ladder",
  "minecraft:compass", "minecraft:lantern"];

function frente(npc) {
  const v = npc.getViewDirection();
  const d = Math.hypot(v.x, v.z) || 1;
  return { x: v.x / d, z: v.z / d };
}

// Busca un bloque delante (a la altura de los pies o de la cabeza) y lo mina.
function minar(npc, state) {
  const f = frente(npc);
  for (const dy of [0, 1, -1]) {
    const block = blockAt(npc.dimension, { x: npc.location.x + f.x * 1.2, y: npc.location.y + dy, z: npc.location.z + f.z * 1.2 });
    if (!block || block.isAir || block.isLiquid) continue;
    sostener(npc, pico(state));
    animate(npc, ANIM.minar);
    state.ocupadoHasta = now() + 20;
    system.runTimeout(() => {
      if (npc.isValid) romper(npc, state, block);
    }, 16);
    return true;
  }
  return false;
}

// Simula craftear: pone una mesa, la mira, "trabaja" y saca un objeto.
function craftear(npc, state) {
  const f = frente(npc);
  const pos = { x: npc.location.x + f.x * 1.5, y: npc.location.y, z: npc.location.z + f.z * 1.5 };
  const mesa = blockAt(npc.dimension, pos);
  const suelo = blockAt(npc.dimension, { x: pos.x, y: pos.y - 1, z: pos.z });
  if (!mesa?.isAir || !suelo || suelo.isAir) return false;
  sostener(npc, "minecraft:crafting_table");
  animate(npc, ANIM.colocar);
  const where = { ...mesa.location };
  const centro = { x: where.x + 0.5, y: where.y + 1, z: where.z + 0.5 };
  try {
    mesa.setType("minecraft:crafting_table");
  } catch {
    return false;
  }
  state.ocupadoHasta = now() + 80;
  system.runTimeout(() => {
    if (!npc.isValid) return;
    sostener(npc, "minecraft:air");
    try {
      npc.teleport(npc.location, { facingLocation: centro });
    } catch {
      // Sigue sin girarse.
    }
    animate(npc, ANIM.crafteo);
  }, 8);
  for (const t of [20, 40, 60]) {
    system.runTimeout(() => {
      particleAt(npc.dimension, PARTICLES.crafteo, centro);
      if (npc.isValid) sound(npc, "random.wood_click", 1.2);
    }, t);
  }
  system.runTimeout(() => {
    if (!npc.isValid) return;
    let resultado;
    if (state.minados >= 4 && state.nivelPico < PICOS.length - 1) {
      state.minados -= 4;
      state.nivelPico++;
      resultado = pico(state);
    } else if (state.minados >= 6 && state.nivelArmadura < 4) {
      state.minados -= 6;
      state.nivelArmadura++;
      vestir(npc, state.nivelArmadura);
      resultado = "minecraft:anvil";
    } else {
      resultado = EXTRAS[rand(0, EXTRAS.length - 1)];
    }
    sostener(npc, resultado);
    burst(npc, PARTICLES.cambio, { x: 0, y: 1.4, z: 0 });
    sound(npc, "random.levelup", 1.6);
    // Recoge la mesa.
    try {
      const b = blockAt(npc.dimension, where);
      if (b?.typeId === "minecraft:crafting_table") b.setType("minecraft:air");
    } catch {
      // La mesa ya no está.
    }
  }, 72);
  return true;
}

export function tickTrabajo(npc, state) {
  if (!MODIFICA_MUNDO || now() < state.ocupadoHasta) return;
  if (now() >= (state.cd.craftear ?? 0) && craftear(npc, state)) {
    state.cd.craftear = now() + rand(500, 800);
    return;
  }
  if (Math.random() < 0.5) minar(npc, state);
}
