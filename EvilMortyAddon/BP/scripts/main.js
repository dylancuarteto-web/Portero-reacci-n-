import { system, world } from "@minecraft/server";
import { ITEMS, TICKS } from "./config.js";
import { wearsPatch } from "./core/patch.js";
import { forgetState, getState } from "./core/state.js";
import {
  alternarEscudo,
  desactivarEscudo,
  limpiarDomos,
  registrarEscudo,
  seguirEscudos,
  vigilarProyectiles,
} from "./abilities/escudo.js";
import { dispararLaser, mejorarLaser, prepararLore } from "./abilities/laser.js";
import { tickPrediccion } from "./abilities/prediccion.js";
import { actualizarOjo } from "./hud/ojo.js";
import { abrirMenu } from "./ui/menu.js";
import { patchGlint } from "./vfx.js";

// Controles:
//   Control del Parche: usar = menú; agachado + usar = escudo on/off.
//   Mano de Rayo Láser: usar = disparar; agachado + usar = mejorar (1 bloque de diamante).
world.afterEvents.itemUse.subscribe(({ source: player, itemStack }) => {
  if (itemStack?.typeId === ITEMS.control) {
    if (player.isSneaking) alternarEscudo(player);
    else abrirMenu(player).catch(() => {});
  } else if (itemStack?.typeId === ITEMS.manoLaser) {
    if (player.isSneaking) mejorarLaser(player);
    else {
      prepararLore(player, itemStack);
      dispararLaser(player, itemStack);
    }
  }
});

registrarEscudo();

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
  const state = forgetState(playerId);
  try {
    if (state?.domo?.isValid) state.domo.remove();
  } catch {
    // La cúpula ya no existe.
  }
});

// Pasiva del parche: interfaz del ojo, predicción y destello.
system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    const state = getState(player);
    const lleva = wearsPatch(player);
    state.llevaParche = lleva;
    actualizarOjo(player, lleva);
    if (!lleva) {
      if (state.escudo) desactivarEscudo(player);
      continue;
    }
    tickPrediccion(player);
    if (system.currentTick % 40 < TICKS.pasiva) patchGlint(player);
  }
}, TICKS.pasiva);

system.runInterval(seguirEscudos, TICKS.escudoSeguir);
system.runInterval(vigilarProyectiles, TICKS.escudoProyectiles);
system.runInterval(limpiarDomos, TICKS.limpiezaDomos);
