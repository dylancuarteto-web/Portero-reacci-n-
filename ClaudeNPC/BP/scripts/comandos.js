import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus, Player, system } from "@minecraft/server";
import { IQ, MAESTRO, NPC, PROP, VARIANTES } from "./config.js";
import { obtenerEstado } from "./estado.js";
import { aprender } from "./iq.js";
import { claseAhora } from "./maestro.js";
import { forzarRobot } from "./robot/construccion.js";

// /claudenpc:iq <valor>: pone el IQ de los Claudes cercanos. Sirve para probar la
// robot (5 Claudes con IQ 500) o la fusión (5 con IQ 1000) sin esperar. Requiere trucos.
// /claudenpc:clase: el Claude Maestro más cercano toca la campana y empieza la clase.
// /claudenpc:robot: los Claudes más cercanos (hasta cinco) construyen el robot ya.
export function registrarComandos() {
  system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
    customCommandRegistry.registerCommand(
      {
        name: "claudenpc:iq",
        description: "Pone el IQ de los Claudes cercanos (500: robot, 1000: fusión, con 5 Claudes)",
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
    // /claudenpc:maestro <einstein|tesla|curie|newton|lovelace|maestro>: trae a ese maestro.
    customCommandRegistry.registerEnum("claudenpc:genio", VARIANTES.map((v) => v.id));
    customCommandRegistry.registerCommand(
      {
        name: "claudenpc:maestro",
        description: "Genera a un maestro: maestro, einstein, tesla, curie, newton o lovelace",
        permissionLevel: CommandPermissionLevel.GameDirectors,
        cheatsRequired: true,
        mandatoryParameters: [{ name: "claudenpc:genio", type: CustomCommandParamType.Enum }],
      },
      (origin, id) => {
        const p = origin.sourceEntity;
        if (!(p instanceof Player)) return { status: CustomCommandStatus.Failure, message: "Úsalo como jugador." };
        const i = Math.max(0, VARIANTES.findIndex((v) => v.id === id));
        system.run(() => {
          try {
            const v = p.getViewDirection();
            const e = p.dimension.spawnEntity(MAESTRO, { x: p.location.x + v.x * 2, y: p.location.y, z: p.location.z + v.z * 2 });
            e.setProperty(PROP.variante, i);
            p.sendMessage(`§6Llegó ${VARIANTES[i].nombre} (IQ ${VARIANTES[i].iq}).`);
          } catch {
            p.sendMessage("§cNo se pudo generar al maestro aquí.");
          }
        });
        return { status: CustomCommandStatus.Success };
      },
    );
    customCommandRegistry.registerCommand(
      {
        name: "claudenpc:robot",
        description: "Los Claudes más cercanos (hasta 5) construyen su robot ahora",
        permissionLevel: CommandPermissionLevel.GameDirectors,
        cheatsRequired: true,
      },
      (origin) => {
        const p = origin.sourceEntity;
        if (!(p instanceof Player)) return { status: CustomCommandStatus.Failure, message: "Úsalo como jugador." };
        system.run(() => p.sendMessage(forzarRobot(p)));
        return { status: CustomCommandStatus.Success };
      },
    );
    customCommandRegistry.registerCommand(
      {
        name: "claudenpc:clase",
        description: "El Claude Maestro más cercano empieza la clase ahora",
        permissionLevel: CommandPermissionLevel.GameDirectors,
        cheatsRequired: false,
      },
      (origin) => {
        const p = origin.sourceEntity;
        if (!(p instanceof Player)) return { status: CustomCommandStatus.Failure, message: "Úsalo como jugador." };
        system.run(() => p.sendMessage(`§6${claseAhora(p)}`));
        return { status: CustomCommandStatus.Success };
      },
    );
  });
}
