// Comandos de prueba/administración (/lacobra:...). No son necesarios para jugar:
// todas las habilidades se usan con objetos táctiles.
import {
  system,
  ItemStack,
  CommandPermissionLevel,
  CustomCommandParamType,
  CustomCommandStatus,
} from "@minecraft/server";
import { CONFIG, HABILIDADES, NOMBRES } from "./config.js";
import { getState, saveState, cooldownLeft, clamp } from "./core/state.js";
import { activeTasks } from "./core/scheduler.js";
import { liveFxCount } from "./core/fx.js";
import { cast } from "./abilities/index.js";
import { summonBoss, bossCount } from "./boss/boss.js";

const KIT = [
  "espada_cobra", "libro_tactico", "runa_instinto", "runa_remate", "runa_veneno", "runa_dominio", "runa_suprema",
  "guantes_goat", "amuleto_cobra", "totem_cobra", "casco_cobra", "pechera_cobra", "pantalones_cobra", "botas_cobra",
  "idolo_serpiente", "nucleo_energia", "escama_cobra", "colmillo_legendario", "esencia_suprema",
];

function playerOf(origin) {
  const e = origin.sourceEntity;
  return e && e.typeId === "minecraft:player" ? /** @type {import("@minecraft/server").Player} */ (e) : undefined;
}

const ok = (message) => ({ status: CustomCommandStatus.Success, message });
const bad = (message) => ({ status: CustomCommandStatus.Failure, message });

/** @param {import("@minecraft/server").CustomCommandRegistry} reg */
export function registerCommands(reg) {
  reg.registerEnum("lacobra:habilidad", HABILIDADES);

  reg.registerCommand(
    {
      name: "lacobra:energia",
      description: "Fija tu energía de La Cobra (0-100)",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      mandatoryParameters: [{ name: "valor", type: CustomCommandParamType.Integer }],
    },
    (origin, valor) => {
      const p = playerOf(origin);
      if (!p) return bad("Solo un jugador puede usar este comando");
      system.run(() => {
        const s = getState(p);
        s.energy = clamp(valor, 0, CONFIG.energia.max);
        saveState(p, s);
      });
      return ok(`Energía fijada en ${clamp(valor, 0, CONFIG.energia.max)}`);
    }
  );

  reg.registerCommand(
    {
      name: "lacobra:reset",
      description: "Recarga la energía y reinicia los enfriamientos",
      permissionLevel: CommandPermissionLevel.GameDirectors,
    },
    (origin) => {
      const p = playerOf(origin);
      if (!p) return bad("Solo un jugador puede usar este comando");
      system.run(() => {
        const s = getState(p);
        s.energy = CONFIG.energia.max;
        s.cooldowns = {};
        saveState(p, s);
      });
      return ok("Energía al máximo y enfriamientos reiniciados");
    }
  );

  reg.registerCommand(
    {
      name: "lacobra:kit",
      description: "Entrega todos los objetos de La Cobra (pruebas)",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      cheatsRequired: true,
    },
    (origin) => {
      const p = playerOf(origin);
      if (!p) return bad("Solo un jugador puede usar este comando");
      system.run(() => {
        const inv = p.getComponent("minecraft:inventory")?.container;
        if (!inv) return;
        for (const id of KIT) {
          const left = inv.addItem(new ItemStack("lacobra:" + id, 1));
          if (left) p.dimension.spawnItem(left, p.location);
        }
        const balls = inv.addItem(new ItemStack("lacobra:balon_dorado", 8));
        if (balls) p.dimension.spawnItem(balls, p.location);
      });
      return ok("Kit de La Cobra entregado");
    }
  );

  reg.registerCommand(
    {
      name: "lacobra:habilidad",
      description: "Lanza una habilidad (con todas las validaciones normales)",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      mandatoryParameters: [{ name: "lacobra:habilidad", type: CustomCommandParamType.Enum }],
    },
    (origin, skill) => {
      const p = playerOf(origin);
      if (!p) return bad("Solo un jugador puede usar este comando");
      system.run(() => cast(p, skill, "comando"));
      return ok(`Intentando lanzar ${NOMBRES[skill] ?? skill}`);
    }
  );

  reg.registerCommand(
    {
      name: "lacobra:jefe",
      description: "Invoca a La Serpiente Legendaria delante de ti (pruebas)",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      cheatsRequired: true,
    },
    (origin) => {
      const p = playerOf(origin);
      if (!p) return bad("Solo un jugador puede usar este comando");
      system.run(() => summonBoss(p, false));
      return ok("Ritual de invocación iniciado");
    }
  );

  reg.registerCommand(
    {
      name: "lacobra:estado",
      description: "Muestra tu energía, enfriamientos y diagnóstico del addon",
      permissionLevel: CommandPermissionLevel.Any,
    },
    (origin) => {
      const p = playerOf(origin);
      if (!p) return bad("Solo un jugador puede usar este comando");
      const s = getState(p);
      const cds = HABILIDADES.map((sk) => `${NOMBRES[sk]}: ${Math.ceil(cooldownLeft(s, sk) / 20)}s`).join(", ");
      return ok(
        `Energía ${Math.floor(s.energy)}/${CONFIG.energia.max} | ${cds} | ` +
          `tareas activas ${activeTasks()}, efectos vivos ${liveFxCount()}, jefes ${bossCount()}`
      );
    }
  );
}
