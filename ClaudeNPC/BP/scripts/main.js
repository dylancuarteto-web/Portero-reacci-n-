import { EntityDamageCause, GameMode, Player, system, world } from "@minecraft/server";
import { COMBATE, NPC } from "./config.js";
import { tickCombate } from "./combate.js";
import { pico, sostener, vestir } from "./equipo.js";
import { aprender, cargarIQ, mostrarIQ, nivel } from "./iq.js";
import { wTap } from "./movimiento.js";
import { vigilarCaida } from "./tacticas.js";
import { tickTrabajo } from "./trabajo.js";
import { animate, now } from "./util.js";

// Cerebro del NPC Claude: pelea cuando hay un jugador cerca y, si no, mina y craftea.
// Su IQ (sobre el nombre) sube con lo que observa y con lo que le funciona.
const estados = new Map();
const DIMENSIONES = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];

function estado(npc) {
  let s = estados.get(npc.id);
  if (!s) {
    s = {
      arma: 0, nivelPico: 0, nivelArmadura: 0, minados: 0, ocupadoHasta: 0, sinCaidaHasta: 0, cd: {},
      iq: cargarIQ(npc), memoria: { torres: 0, arco: 0, golpes: 0, exitos: {} },
    };
    estados.set(npc.id, s);
    mostrarIQ(npc, s);
    vestir(npc, 0);
    sostener(npc, pico(s));
  }
  return s;
}

function npcsCerca(location, dimension, radio = 24) {
  try {
    return dimension.getEntities({ type: NPC, location, maxDistance: radio });
  } catch {
    return [];
  }
}

system.runInterval(() => {
  for (const id of DIMENSIONES) {
    let npcs = [];
    try {
      npcs = world.getDimension(id).getEntities({ type: NPC });
    } catch {
      continue;
    }
    for (const npc of npcs) {
      try {
        const s = estado(npc);
        vigilarCaida(npc, s);
        const [jugador] = npc.dimension.getPlayers({
          location: npc.location, maxDistance: COMBATE.radio, closest: 1,
          excludeGameModes: [GameMode.Creative, GameMode.Spectator],
        });
        if (jugador) {
          tickCombate(npc, s, jugador);
          if (now() % 20 === 0) aprender(npc, s, 0.02); // experiencia por tiempo de pelea
        } else {
          tickTrabajo(npc, s);
        }
      } catch {
        // NPC descargado durante el tick.
      }
    }
  }
}, 4);

// Observa al jugador: construir, romper, subir en torre para escapar.
world.afterEvents.playerPlaceBlock.subscribe(({ player, block }) => {
  for (const npc of npcsCerca(player.location, player.dimension)) {
    const s = estados.get(npc.id);
    if (!s) continue;
    const debajo = block.location.y < player.location.y && Math.abs(block.location.x + 0.5 - player.location.x) < 1
      && Math.abs(block.location.z + 0.5 - player.location.z) < 1;
    if (debajo) s.memoria.torres++;
    aprender(npc, s, debajo ? 0.4 : 0.15);
  }
});

world.afterEvents.playerBreakBlock.subscribe(({ player }) => {
  for (const npc of npcsCerca(player.location, player.dimension)) {
    const s = estados.get(npc.id);
    if (s) aprender(npc, s, 0.1);
  }
});

// Golpes: aprende de los que recibe y de los que acierta.
world.afterEvents.entityHurt.subscribe(({ hurtEntity, damageSource }) => {
  const atacante = damageSource.damagingEntity;
  if (hurtEntity.typeId === NPC && atacante instanceof Player) {
    const s = estados.get(hurtEntity.id);
    if (!s) return;
    if (damageSource.cause === EntityDamageCause.projectile) s.memoria.arco++;
    else s.memoria.golpes++;
    aprender(hurtEntity, s, 0.4);
  } else if (hurtEntity instanceof Player && atacante?.typeId === NPC) {
    const s = estados.get(atacante.id);
    if (!s) return;
    if (s.ultima) s.memoria.exitos[s.ultima] = (s.memoria.exitos[s.ultima] ?? 0) + 1;
    aprender(atacante, s, 0.5);
    if (damageSource.cause === EntityDamageCause.entityAttack) wTap(atacante, hurtEntity, s);
  }
});

world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
  const asesino = damageSource.damagingEntity;
  if (deadEntity instanceof Player && asesino?.typeId === NPC) {
    const s = estados.get(asesino.id);
    if (s) aprender(asesino, s, 5);
  }
});

// Escudo en la otra mano: con más IQ bloquea más golpes. Tras un water drop o una
// picada con maza no recibe daño por caída.
world.beforeEvents.entityHurt.subscribe((event) => {
  const s = estados.get(event.hurtEntity.id);
  if (!s) return;
  const cause = event.damageSource.cause;
  if (cause === EntityDamageCause.fall && now() < s.sinCaidaHasta) {
    event.cancel = true;
    return;
  }
  if (cause === EntityDamageCause.entityAttack && event.damageSource.damagingEntity instanceof Player
    && Math.random() < 0.15 + nivel(s) * 0.45) {
    event.cancel = true;
    const npc = event.hurtEntity;
    system.run(() => {
      if (!npc.isValid) return;
      animate(npc, "animation.claudenpc.escudo");
      npc.dimension.playSound("item.shield.block", npc.location);
    });
  }
}, { entityFilter: { type: NPC } });

world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => estados.delete(removedEntityId));
