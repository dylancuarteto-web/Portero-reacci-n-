import { system, world } from "@minecraft/server";
import { ITEMS, PARTICLES, TICKS } from "./config.js";
import { registrarComandos } from "./core/comandos.js";
import { message, t } from "./core/feedback.js";
import { registrarGestos } from "./core/gestos.js";
import { wearsPatch } from "./core/patch.js";
import { forgetState, getState } from "./core/state.js";
import {
  desactivarEscudo,
  limpiarDomos,
  registrarEscudo,
  seguirEscudos,
  vigilarProyectiles,
} from "./abilities/escudo.js";
import { dispararLaser, mejorarLaser, prepararLore } from "./abilities/laser.js";
import { tickPrediccion } from "./abilities/prediccion.js";
import { quitarVisionNocturna, tickVisionNocturna } from "./abilities/vision_nocturna.js";
import { actualizarOjo } from "./hud/ojo.js";
import { burst, patchGlint } from "./vfx.js";

// Controles:
//   Parche puesto: agacharse mirando arriba = menú; dos veces = escudo on/off.
//   Mano de Rayo Láser: usar = disparar; agachado + usar = mejorar (1 bloque de diamante).
//   Comando de respaldo: /evilmorty:parche
registrarComandos();
registrarGestos();
registrarEscudo();

world.afterEvents.itemUse.subscribe(({ source: player, itemStack }) => {
  if (itemStack?.typeId !== ITEMS.manoLaser) return;
  if (player.isSneaking) mejorarLaser(player);
  else {
    prepararLore(player, itemStack);
    dispararLaser(player, itemStack);
  }
});

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
  const state = forgetState(playerId);
  try {
    if (state?.domo?.isValid) state.domo.remove();
  } catch {
    // La cúpula ya no existe.
  }
});

// Pasiva del parche: interfaz del ojo, visión nocturna, predicción y destello.
system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    const state = getState(player);
    const lleva = wearsPatch(player);
    if (lleva && !state.llevaParche) {
      message(player, [t("evilmorty.msg.parche_en_linea")]);
      burst(player.dimension, PARTICLES.parcheActivar, player.getHeadLocation());
    }
    state.llevaParche = lleva;
    actualizarOjo(player, lleva);
    if (!lleva) {
      if (state.escudo) desactivarEscudo(player);
      quitarVisionNocturna(player);
      continue;
    }
    tickVisionNocturna(player);
    tickPrediccion(player);
    if (system.currentTick % 40 < TICKS.pasiva) patchGlint(player);
  }
}, TICKS.pasiva);

system.runInterval(seguirEscudos, TICKS.escudoSeguir);
system.runInterval(vigilarProyectiles, TICKS.escudoProyectiles);
system.runInterval(limpiarDomos, TICKS.limpiezaDomos);
