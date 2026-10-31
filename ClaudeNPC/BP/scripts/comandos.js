import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus, Player, system } from "@minecraft/server";
import { IQ, NPC } from "./config.js";
import { obtenerEstado } from "./estado.js";
import { aprender } from "./iq.js";

// /claudenpc:iq <valor>: pone el IQ de los Claudes cercanos. Sirve para probar la
// fusión (5 Claudes con IQ 300) sin esperar a que aprendan solos. Requiere trucos.
export function registrarComandos() {
  system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
    customCommandRegistry.registerCommand(
      {
        name: "claudenpc:iq",
        description: "Pone el IQ de los Claudes cercanos (300 activa la fusión con 5 Claudes)",
        permissionLevel: CommandPermissionLevel.GameDirectors,
        cheatsRequired: true,
        mandatoryParameters: [{ name: "valor", type: CustomCommandParamType.Integer }],
      },
      (origin, valor) => {
        const p = origin.sourceEntity;
        if (!(p instanceof Player)) return { status: CustomCommandStatus.Failure, message: "Úsalo como jugador." };
        system.run(() => {
          const lista = p.dimension.getEntities({ type: NPC, location: p.location, maxDistance: 48 });
          for (const npc of lista) {
            const s = obtenerEstado(npc);
            s.iq = Math.max(IQ.inicial, Math.min(IQ.maximo, valor));
            aprender(npc, s, 0);
          }
          p.sendMessage(`§aIQ ${valor} para ${lista.length} Claude(s) cercano(s).`);
        });
        return { status: CustomCommandStatus.Success };
      },
    );
  });
}
