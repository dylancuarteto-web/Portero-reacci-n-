import { system, world } from "@minecraft/server";
import { ANIMATIONS, ENTITIES, ESCUDO, PARTICLES, PROPS } from "../config.js";
import { animate, message, sound, soundAt, t } from "../core/feedback.js";
import { wearsPatch } from "../core/patch.js";
import { allStates, getState, peekState } from "../core/state.js";
import { burst, length, normalize, sub } from "../vfx.js";

// Escudo Protector: cúpula 3D que bloquea todos los ataques de criaturas,
// jugadores, proyectiles, explosiones y magia. Sin efectos de poción.
// Modo "reflejar": devuelve los proyectiles a quien los lanzó.
// Modo "destruir": los proyectiles se desintegran al tocar la cúpula.

const DIMENSIONS = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];

function center(player) {
  return { x: player.location.x, y: player.location.y + 1, z: player.location.z };
}

function spawnDome(player, state) {
  try {
    const dome = player.dimension.spawnEntity(ENTITIES.domo, player.location);
    dome.setDynamicProperty(PROPS.duenoDomo, player.id);
    state.domo = dome;
  } catch {
    state.domo = undefined;
  }
}

function removeDome(state) {
  try {
    if (state.domo?.isValid) state.domo.remove();
  } catch {
    // Ya no existe.
  }
  state.domo = undefined;
}

export function activarEscudo(player) {
  const state = getState(player);
  if (!wearsPatch(player)) {
    message(player, [t("evilmorty.msg.necesita_parche")]);
    return;
  }
  state.escudo = true;
  state.jugador = player;
  spawnDome(player, state);
  animate(player, ANIMATIONS.escudoActivar);
  burst(player.dimension, PARTICLES.escudoActivar, player.location);
  sound(player, "escudoOn");
  message(player, [t("evilmorty.msg.escudo_on"), { text: " " }, t(`evilmorty.modo.${state.modoEscudo}`)]);
}

export function desactivarEscudo(player, silent = false) {
  const state = getState(player);
  if (!state.escudo) return;
  state.escudo = false;
  if (state.jugador?.isValid) burst(state.jugador.dimension, PARTICLES.escudoHumo, center(state.jugador));
  removeDome(state);
  if (!silent) {
    sound(player, "escudoOff");
    message(player, [t("evilmorty.msg.escudo_off")]);
  }
}

export function alternarEscudo(player) {
  if (getState(player).escudo) desactivarEscudo(player);
  else activarEscudo(player);
}

// Cada tick: la cúpula sigue al jugador (se recrea si cambió de dimensión).
export function seguirEscudos() {
  for (const state of allStates().values()) {
    if (!state.escudo) continue;
    const player = state.jugador;
    if (!player?.isValid) continue;
    try {
      if (!state.domo?.isValid || state.domo.dimension.id !== player.dimension.id) {
        removeDome(state);
        spawnDome(player, state);
      } else {
        // Se adelanta un tick según la velocidad para que no se quede atrás al correr.
        const v = player.getVelocity();
        const at = player.location;
        state.domo.teleport({ x: at.x + v.x, y: at.y, z: at.z + v.z });
      }
    } catch {
      // Chunk de destino no cargado; se reintenta el siguiente tick.
    }
  }
}

function deflect(player, state, projectile) {
  const component = projectile.getComponent("minecraft:projectile");
  if (!component || component.owner?.id === player.id) return;
  const velocity = projectile.getVelocity();
  const speed = length(velocity);
  // Las flechas clavadas en el suelo no se tocan.
  if (speed < 0.05) return;
  const location = projectile.location;
  if (state.modoEscudo === "destruir") {
    burst(projectile.dimension, PARTICLES.proyectilDestruido, location);
    soundAt(projectile.dimension, location, "proyectilDestruido");
    projectile.remove();
    return;
  }
  const shooter = component.owner;
  const direction = shooter?.isValid && shooter.dimension.id === projectile.dimension.id
    ? normalize(sub(shooter.getHeadLocation(), location))
    : normalize({ x: -velocity.x, y: -velocity.y, z: -velocity.z });
  const power = Math.max(speed, ESCUDO.velocidadReflejo);
  component.owner = player;
  component.shoot({ x: direction.x * power, y: direction.y * power, z: direction.z * power });
  burst(projectile.dimension, PARTICLES.proyectilReflejado, location);
  soundAt(projectile.dimension, location, "proyectilReflejado");
}

// Cada 2 ticks: proyectiles que tocan la cúpula.
export function vigilarProyectiles() {
  for (const state of allStates().values()) {
    const player = state.jugador;
    if (!state.escudo || !player?.isValid) continue;
    let nearby = [];
    try {
      nearby = player.dimension.getEntities({
        location: center(player),
        maxDistance: ESCUDO.radioProyectiles,
        excludeTypes: ["minecraft:player", ENTITIES.domo, ENTITIES.rayo],
      });
    } catch {
      continue;
    }
    for (const entity of nearby) {
      try {
        deflect(player, state, entity);
      } catch {
        // Proyectil sin componente accesible o ya destruido: se elimina.
        try {
          if (entity.isValid && entity.getComponent("minecraft:projectile")) entity.remove();
        } catch {
          // Nada más que hacer.
        }
      }
    }
  }
}

// Cúpulas huérfanas (por ejemplo, tras recargar el mundo) se eliminan.
export function limpiarDomos() {
  const active = new Set();
  for (const state of allStates().values()) if (state.domo?.isValid) active.add(state.domo.id);
  for (const id of DIMENSIONS) {
    try {
      for (const dome of world.getDimension(id).getEntities({ type: ENTITIES.domo })) {
        if (!active.has(dome.id)) dome.remove();
      }
    } catch {
      // Dimensión sin chunks cargados.
    }
  }
}

export function registrarEscudo() {
  world.beforeEvents.entityHurt.subscribe(
    (event) => {
      const state = peekState(event.hurtEntity.id);
      if (!state?.escudo) return;
      event.cancel = true;
      const player = event.hurtEntity;
      system.run(() => {
        if (!player.isValid) return;
        burst(player.dimension, PARTICLES.escudoImpacto, center(player));
        sound(player, "escudoImpacto");
      });
    },
    { allowedDamageCauses: ESCUDO.causasBloqueadas, entityFilter: { type: "minecraft:player" } },
  );

  world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
    if (deadEntity.typeId === "minecraft:player") desactivarEscudo(deadEntity, true);
  });
}
