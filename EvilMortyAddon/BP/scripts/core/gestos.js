import { ButtonState, InputButton, system, world } from "@minecraft/server";
import { GESTO } from "../config.js";
import { alternarEscudo } from "../abilities/escudo.js";
import { abrirMenu } from "../ui/menu.js";
import { wearsPatch } from "./patch.js";
import { getState } from "./state.js";

// Controles integrados en el parche, pensados para móvil:
//   agacharse mirando hacia arriba      → abre el menú del parche
//   agacharse dos veces mirando arriba → escudo on/off sin abrir el menú
// Agacharse mirando al frente o hacia abajo no hace nada (no molesta al construir).
export function registrarGestos() {
  world.afterEvents.playerButtonInput.subscribe(
    ({ player }) => {
      if (player.getRotation().x > GESTO.pitchArriba || !wearsPatch(player)) return;
      const state = getState(player);
      if (state.gestoPendiente !== undefined) {
        system.clearRun(state.gestoPendiente);
        state.gestoPendiente = undefined;
        alternarEscudo(player);
        return;
      }
      state.gestoPendiente = system.runTimeout(() => {
        state.gestoPendiente = undefined;
        if (player.isValid) abrirMenu(player).catch(() => {});
      }, GESTO.ventanaDoble);
    },
    { buttons: [InputButton.Sneak], state: ButtonState.Pressed },
  );
}
