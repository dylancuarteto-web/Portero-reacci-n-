import { EntityDamageCause, GameMode, Player, system, world } from "@minecraft/server";
import { COMBATE, DIMENSIONES, MODIFICA_MUNDO, NPC } from "./config.js";
import { aguaProfunda, buscarOrilla, rumboBote, subirABote, tickBote } from "./bote.js";
import { tickCombate } from "./combate.js";
import { registrarComandos } from "./comandos.js";
import { estados, obtenerEstado } from "./estado.js";
import { revisarFusion } from "./fusion.js";
import "./golden.js";
import { aprender, nivel } from "./iq.js";
import { caminarA, caminando, wTap } from "./movimiento.js";
import { cargarHogar } from "./obras/casa.js";
import { tickObra } from "./obras/index.js";
import { vigilarCaida } from "./tacticas.js";
import { tickTrabajo } from "./trabajo.js";
import { animate, now } from "./util.js";

// Cerebro del NPC Claude. Prioridades en cada turno:
// fusión > bote > reunión con otros genios > nadar sacando un bote > obra en curso
// (torre o puente) > combate si hay un jugador cerca > trabajo (casa, mina, crafteo).
registrarComandos();

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
        const s = obtenerEstado(npc);
        if (!s.hogarCargado) {
          s.hogar = cargarHogar(npc);
          s.hogarCargado = true;
        }
        if (s.fusion) continue;
        vigilarCaida(npc, s);
        const [jugador] = npc.dimension.getPlayers({
          location: npc.location, maxDistance: COMBATE.radio, closest: 1,
          excludeGameModes: [GameMode.Creative, GameMode.Spectator],
        });
        if (s.bote) {
          if (jugador) rumboBote(npc, jugador.location);
          tickBote(npc, s);
          continue;
        }
        if (s.reunion) {
          if (!caminando(npc)) caminarA(npc, s.reunion, 0.28);
          continue;
        }
        if (MODIFICA_MUNDO && !s.obra && aguaProfunda(npc)) {
          const destino = jugador?.location ?? buscarOrilla(npc.dimension, npc.location) ?? npc.location;
          subirABote(npc, s, destino);
          continue;
        }
        if (tickObra(npc, s)) continue;
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

system.runInterval(revisarFusion, 40);

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

// Escudo en la otra mano: con más IQ bloquea más golpes. Tras un water drop, un clutch
// o una picada con maza no recibe daño por caída. Durante la fusión es intocable.
world.beforeEvents.entityHurt.subscribe((event) => {
  const s = estados.get(event.hurtEntity.id);
  if (!s) return;
  if (s.fusion) {
    event.cancel = true;
    return;
  }
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
