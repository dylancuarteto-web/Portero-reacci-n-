import { GameMode, system, world } from "@minecraft/server";
import { COMBATE, NPC } from "./config.js";
import { tickCombate } from "./combate.js";
import { sostener, vestir } from "./equipo.js";
import { tickTrabajo } from "./trabajo.js";

// Cerebro del NPC Claude: pelea cuando hay un jugador cerca y, si no, mina y craftea.
const estados = new Map();
const DIMENSIONES = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];

function estado(npc) {
  let s = estados.get(npc.id);
  if (!s) {
    s = { arma: -1, nivelPico: 0, nivelArmadura: 0, minados: 0, ocupadoHasta: 0, cd: {} };
    estados.set(npc.id, s);
    npc.nameTag = "Claude";
    vestir(npc, 0);
    sostener(npc, "minecraft:wooden_pickaxe");
  }
  return s;
}

system.runInterval(() => {
  for (const id of DIMENSIONES) {
    let npcs = [];
    try {
      npcs = world.getDimension(id).getEntities({ type: NPC });
    } catch {
      continue;
    }
    for (const npc of npcs) {
      try {
        const s = estado(npc);
        const [jugador] = npc.dimension.getPlayers({
          location: npc.location, maxDistance: COMBATE.radio, closest: 1,
          excludeGameModes: [GameMode.Creative, GameMode.Spectator],
        });
        if (jugador) tickCombate(npc, s, jugador);
        else tickTrabajo(npc, s);
      } catch {
        // NPC descargado durante el tick.
      }
    }
  }
}, 4);

world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => estados.delete(removedEntityId));
