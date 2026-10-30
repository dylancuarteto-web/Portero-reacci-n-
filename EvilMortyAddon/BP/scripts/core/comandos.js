import { CommandPermissionLevel, CustomCommandStatus, Player, system } from "@minecraft/server";
import { COMANDO_MENU } from "../config.js";
import { abrirMenu } from "../ui/menu.js";

// Respaldo del gesto: /evilmorty:parche abre el menú. No requiere trucos.
export function registrarComandos() {
  system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
    customCommandRegistry.registerCommand(
      {
        name: COMANDO_MENU,
        description: "Abre el menú del Parche de Evil Morty",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
      },
      (origin) => {
        const player = origin.sourceEntity;
        if (!(player instanceof Player)) {
          return { status: CustomCommandStatus.Failure, message: "Solo un jugador puede abrir el menú." };
        }
        // Los comandos se ejecutan en modo restringido: el menú se abre en el siguiente tick.
        system.run(() => abrirMenu(player).catch(() => {}));
        return { status: CustomCommandStatus.Success };
      },
    );
  });
}
