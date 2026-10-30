import { system, world } from "@minecraft/server";
import { ITEM_TRANSMISOR, PASSIVE_INTERVAL } from "./config.js";
import { castCurrent, cycleAbility, forgetPlayer } from "./abilities.js";
import { tickPassive } from "./passive.js";

// Transmisor: usar = lanzar la habilidad elegida; agachado + usar = cambiar.
world.afterEvents.itemUse.subscribe(({ source: player, itemStack }) => {
  if (itemStack?.typeId !== ITEM_TRANSMISOR) return;
  if (player.isSneaking) cycleAbility(player);
  else castCurrent(player);
});

world.afterEvents.playerLeave.subscribe(({ playerId }) => forgetPlayer(playerId));

system.runInterval(() => {
  for (const player of world.getAllPlayers()) tickPassive(player);
}, PASSIVE_INTERVAL);
