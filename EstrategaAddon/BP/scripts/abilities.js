import { system, world } from "@minecraft/server";
import {
  ABILITY_PROPERTY,
  ANIMATIONS,
  COOLDOWNS,
  ESCAPE_DELAY,
  PORTAL_OPEN_DELAY,
  PORTAL_RANGE,
  SIGNAL_DURATION,
  SIGNAL_MAX_TARGETS,
  SIGNAL_RADIUS,
  STEALTH_DURATION,
} from "./config.js";
import { wearsPatch } from "./passive.js";
import * as vfx from "./vfx.js";

// Cooldowns en memoria por jugador: playerId -> { abilityId: tick listo }.
const cooldowns = new Map();

function actionBar(player, rawtext) {
  try {
    player.onScreenDisplay.setActionBar({ rawtext });
  } catch {
    // El jugador salió antes de mostrar el mensaje.
  }
}

function animate(player, animation) {
  try {
    player.playAnimation(animation, { blendOutTime: 0.2 });
  } catch {
    // Animación no disponible si el resource pack no está activo.
  }
}

function raised(location, dy) {
  return { x: location.x, y: location.y + dy, z: location.z };
}

function hasRoom(block) {
  const feet = block.above(1);
  const head = block.above(2);
  return !!feet && !!head && feet.isAir && head.isAir;
}

// Salto de portal: abre un portal y te lleva al bloque que miras.
function castPortal(player) {
  const hit = player.getBlockFromViewDirection({
    maxDistance: PORTAL_RANGE,
    includeLiquidBlocks: false,
    includePassableBlocks: false,
  });
  if (!hit || !hasRoom(hit.block)) {
    actionBar(player, [{ translate: "estr.msg.no_target" }]);
    return false;
  }
  const dimension = player.dimension;
  const direction = player.getViewDirection();
  const target = {
    x: hit.block.location.x + 0.5,
    y: hit.block.location.y + 1,
    z: hit.block.location.z + 0.5,
  };
  animate(player, ANIMATIONS.portal);
  vfx.portal(dimension, raised(player.location, 1), direction);
  vfx.portal(dimension, raised(target, 1), direction);
  vfx.playOptionalSound(player, "portal");
  system.runTimeout(() => {
    if (!player.isValid) return;
    try {
      player.teleport(target, { dimension, rotation: player.getRotation(), keepVelocity: false });
    } catch {
      actionBar(player, [{ translate: "estr.msg.blocked" }]);
    }
  }, PORTAL_OPEN_DELAY);
  return true;
}

// Señal del parche: el parche emite una señal que deja inmóviles a las
// criaturas cercanas durante unos segundos. No causa daño.
function castSignal(player) {
  const dimension = player.dimension;
  const targets = dimension.getEntities({
    location: player.location,
    maxDistance: SIGNAL_RADIUS,
    excludeTypes: ["minecraft:player", "minecraft:item", "minecraft:xp_orb"],
    excludeFamilies: ["inanimate"],
    closest: SIGNAL_MAX_TARGETS,
  });
  animate(player, ANIMATIONS.signal);
  vfx.mindWave(dimension, raised(player.location, 1.6));
  vfx.playOptionalSound(player, "signal");
  let count = 0;
  for (const entity of targets) {
    try {
      entity.addEffect("slowness", SIGNAL_DURATION, { amplifier: 10, showParticles: false });
      vfx.mindLink(entity);
      count++;
    } catch {
      // Entidad sin soporte de efectos o descargada.
    }
  }
  actionBar(player, [{ translate: "estr.msg.signal", with: [String(count)] }]);
  return true;
}

function escapeDestination(player) {
  const spawn = player.getSpawnPoint();
  if (spawn) {
    return { dimension: spawn.dimension, location: { x: spawn.x + 0.5, y: spawn.y, z: spawn.z + 0.5 } };
  }
  const overworld = world.getDimension("minecraft:overworld");
  const fallback = world.getDefaultSpawnLocation();
  let y = fallback.y;
  // Un spawn por defecto sin altura definida devuelve un valor fuera de rango.
  if (y > overworld.heightRange.max) {
    try {
      const top = overworld.getTopmostBlock({ x: fallback.x, z: fallback.z });
      y = top ? top.location.y + 1 : 100;
    } catch {
      y = 100;
    }
  }
  return { dimension: overworld, location: { x: fallback.x + 0.5, y, z: fallback.z + 0.5 } };
}

// Romper la Curva: te eleva, abre un portal y te devuelve a tu punto de
// reaparición (cama o ancla), aunque estés en otra dimensión.
function castEscape(player) {
  const origin = player.dimension;
  const direction = player.getViewDirection();
  animate(player, ANIMATIONS.escape);
  vfx.portal(origin, raised(player.location, 1), direction);
  vfx.playOptionalSound(player, "escape");
  try {
    player.addEffect("levitation", ESCAPE_DELAY, { amplifier: 0, showParticles: false });
  } catch {
    // Continuar sin elevación.
  }
  system.runTimeout(() => {
    if (!player.isValid) return;
    const destination = escapeDestination(player);
    try {
      player.teleport(destination.location, { dimension: destination.dimension, keepVelocity: false });
    } catch {
      actionBar(player, [{ translate: "estr.msg.blocked" }]);
      return;
    }
    system.runTimeout(() => {
      if (player.isValid) vfx.portal(player.dimension, raised(player.location, 1), direction);
    }, 5);
  }, ESCAPE_DELAY);
  return true;
}

// Sin rastro: desaparece del radar de todos durante un tiempo.
function castStealth(player) {
  animate(player, ANIMATIONS.stealth);
  vfx.stealthSmoke(player.dimension, raised(player.location, 1));
  vfx.playOptionalSound(player, "stealth");
  try {
    player.addEffect("invisibility", STEALTH_DURATION, { amplifier: 0, showParticles: false });
  } catch {
    return false;
  }
  return true;
}

const ABILITIES = [
  { id: "portal", name: "estr.ability.portal", cast: castPortal },
  { id: "signal", name: "estr.ability.signal", cast: castSignal },
  { id: "escape", name: "estr.ability.escape", cast: castEscape },
  { id: "stealth", name: "estr.ability.stealth", cast: castStealth },
];

function currentIndex(player) {
  const value = player.getDynamicProperty(ABILITY_PROPERTY);
  return typeof value === "number" && value >= 0 && value < ABILITIES.length ? value : 0;
}

export function cycleAbility(player) {
  const next = (currentIndex(player) + 1) % ABILITIES.length;
  player.setDynamicProperty(ABILITY_PROPERTY, next);
  actionBar(player, [{ translate: "estr.msg.selected" }, { text: " " }, { translate: ABILITIES[next].name }]);
}

export function castCurrent(player) {
  if (!wearsPatch(player)) {
    actionBar(player, [{ translate: "estr.msg.need_patch" }]);
    return;
  }
  const ability = ABILITIES[currentIndex(player)];
  const now = system.currentTick;
  const timers = cooldowns.get(player.id) ?? {};
  const ready = timers[ability.id] ?? 0;
  if (now < ready) {
    const seconds = Math.ceil((ready - now) / 20);
    actionBar(player, [{ translate: ability.name }, { text: " - " }, { translate: "estr.msg.cooldown", with: [String(seconds)] }]);
    return;
  }
  if (ability.cast(player)) {
    timers[ability.id] = now + COOLDOWNS[ability.id];
    cooldowns.set(player.id, timers);
  }
}

export function forgetPlayer(playerId) {
  cooldowns.delete(playerId);
}
