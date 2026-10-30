import { EquipmentSlot, Player } from "@minecraft/server";
import { ENTITIES, PARTICLES, PREDICCION } from "../config.js";
import { message, t } from "../core/feedback.js";
import { getState, now } from "../core/state.js";
import { add, forPlayer } from "../vfx.js";

// Visión predictiva: mientras llevas el parche, ves hacia dónde se moverán
// las criaturas y jugadores cercanos (solo tú ves las marcas) y una ficha
// con la vida, el arma y la intención del objetivo al que miras.

const EXCLUDED = ["minecraft:item", "minecraft:xp_orb", ENTITIES.domo, ENTITIES.rayo];

export function nearbyTargets(player, radius = PREDICCION.radio, max = PREDICCION.maxObjetivos) {
  try {
    return player.dimension
      .getEntities({
        location: player.location,
        maxDistance: radius,
        closest: max + 1,
        excludeFamilies: ["inanimate"],
        excludeTypes: EXCLUDED,
      })
      .filter((entity) => entity.id !== player.id);
  } catch {
    return [];
  }
}

function lookedAt(player) {
  try {
    const hits = player.getEntitiesFromViewDirection({
      maxDistance: PREDICCION.alcanceFicha,
      excludeFamilies: ["inanimate"],
      excludeTypes: EXCLUDED,
    });
    return hits.find((hit) => hit.entity.id !== player.id)?.entity;
  } catch {
    return undefined;
  }
}

export function nameOf(entity) {
  if (entity instanceof Player) return { text: entity.name };
  if (entity.nameTag) return { text: entity.nameTag };
  const id = entity.typeId.startsWith("minecraft:") ? entity.typeId.slice(10) : entity.typeId;
  return { translate: `entity.${id}.name` };
}

export function healthOf(entity) {
  try {
    const health = entity.getComponent("minecraft:health");
    if (!health) return "?";
    return `${Math.ceil(health.currentValue)}/${Math.ceil(health.effectiveMax)}`;
  } catch {
    return "?";
  }
}

function itemName(item) {
  return item ? { translate: item.localizationKey } : t("evilmorty.ficha.sin_arma");
}

// Arma en la mano principal y objeto en la otra mano. Algunas criaturas no
// exponen su equipo a la API: en ese caso se indica "sin datos".
export function weaponsOf(entity) {
  try {
    const equippable = entity.getComponent("minecraft:equippable");
    if (!equippable) return { principal: t("evilmorty.ficha.sin_datos"), secundaria: undefined };
    const offhand = equippable.getEquipment(EquipmentSlot.Offhand);
    return {
      principal: itemName(equippable.getEquipment(EquipmentSlot.Mainhand)),
      secundaria: offhand ? itemName(offhand) : undefined,
    };
  } catch {
    return { principal: t("evilmorty.ficha.sin_datos"), secundaria: undefined };
  }
}

// Intención de movimiento respecto al jugador que observa.
export function intentOf(entity, observer) {
  const v = entity.getVelocity();
  const speed = Math.hypot(v.x, v.z);
  if (entity instanceof Player && entity.isSneaking) return t("evilmorty.intencion.agachado");
  if (speed < PREDICCION.velocidadMinima) {
    return v.y > 0.3 ? t("evilmorty.intencion.saltando") : t("evilmorty.intencion.quieto");
  }
  const dx = observer.location.x - entity.location.x;
  const dz = observer.location.z - entity.location.z;
  const distance = Math.hypot(dx, dz) || 1;
  const cos = (v.x * dx + v.z * dz) / (speed * distance);
  if (cos > 0.6) {
    const seconds = (distance / (speed * 20)).toFixed(1);
    return t("evilmorty.intencion.acerca", seconds);
  }
  if (cos < -0.6) return t("evilmorty.intencion.aleja");
  return t("evilmorty.intencion.rodea");
}

function drawPrediction(player, entity) {
  const v = entity.getVelocity();
  if (Math.hypot(v.x, v.y, v.z) < PREDICCION.velocidadMinima) return;
  const base = add(entity.location, { x: 0, y: 0.1, z: 0 });
  for (let i = 1; i <= PREDICCION.puntos; i++) {
    const ticks = (i / PREDICCION.puntos) * PREDICCION.segundos * 20;
    const id = i === PREDICCION.puntos ? PARTICLES.prediccionFin : PARTICLES.prediccionPunto;
    forPlayer(player, id, add(base, v, ticks));
  }
}

function card(entity, player) {
  const weapons = weaponsOf(entity);
  const parts = [
    { text: "§6[" }, nameOf(entity), { text: "]§r §cPV " + healthOf(entity) + "§r §e" },
    t("evilmorty.ficha.arma"), { text: " " }, weapons.principal,
  ];
  if (weapons.secundaria) parts.push({ text: " + " }, weapons.secundaria);
  parts.push({ text: "§r §b" }, intentOf(entity, player));
  return parts;
}

export function tickPrediccion(player) {
  const state = getState(player);
  if (!state.vision) return;
  const targets = nearbyTargets(player);
  for (const entity of targets) {
    try {
      drawPrediction(player, entity);
    } catch {
      // Entidad descargada durante el tick.
    }
  }
  if (now() < state.mensajeHasta) return;
  const target = lookedAt(player);
  try {
    if (target) message(player, card(target, player), false);
    else if (targets.length) message(player, [t("evilmorty.ficha.amenazas", targets.length)], false);
  } catch {
    // El objetivo desapareció.
  }
}
