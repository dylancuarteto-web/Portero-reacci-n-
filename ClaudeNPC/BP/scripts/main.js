import { EntityDamageCause, GameMode, Player, system, world } from "@minecraft/server";
import { COMBATE, DIMENSIONES, NPC } from "./config.js";
import { pausarRutina, tickRutina } from "./actividades/index.js";
import { rumboBote, tickAgua, tickBote } from "./bote.js";
import { tickAlumno } from "./clase.js";
import { animarGolpe, tickCombate } from "./combate.js";
import { registrarComandos } from "./comandos.js";
import { bloqueaProyectil, efectoBloqueo } from "./escudo.js";
import { estados, obtenerEstado } from "./estado.js";
import { revisarFusion } from "./fusion.js";
import "./golden/index.js";
import { aprender, ponerHaciendo } from "./iq.js";
import "./maestro.js";
import { caminarA, caminando, destinoActual, velocidad } from "./movimiento.js";
import { cargarHogar } from "./obras/casa.js";
import { tickObra } from "./obras/index.js";
import { hostil } from "./postura.js";
import { perlaHasta, vigilarCaida } from "./tacticas.js";
import { cada, now } from "./util.js";

// Cerebro de cada Claude. Prioridades en cada turno:
// fusión > clase > bote > agua (nadar a la orilla) > reunión de genios > obra corta
// (torre, puente, abrir paso) > pelea (si el jugador está dentro de su radio o lo
// provocó) > rutina libre según su personalidad.
registrarComandos();

function npcsCerca(location, dimension, radio = 24) {
  try {
    return dimension.getEntities({ type: NPC, location, maxDistance: radio });
  } catch {
    return [];
  }
}

// ¿Pelea con este jugador? Cada Claude tiene su propio radio; si lo atacaron, pelea igual.
function quierePelear(npc, s, jugador) {
  if (!jugador) return false;
  const d = Math.hypot(jugador.location.x - npc.location.x, jugador.location.z - npc.location.z);
  if (now() < (s.provocadoHasta ?? 0)) return true;
  if (!s.hostil && s.mina && jugador.location.y - npc.location.y > 6) return false; // está minando y no lo ve
  const radio = s.pers?.radio ?? 20;
  return d <= radio || (s.hostil && d <= radio + 8);
}

function cerebro(npc) {
  const s = obtenerEstado(npc);
  if (!s.hogarCargado) {
    s.hogar = cargarHogar(npc);
    s.hogarCargado = true;
  }
  if (s.fusion) return;
  vigilarCaida(npc, s);
  if (s.clase) return tickAlumno(npc, s);
  const [jugador] = npc.dimension.getPlayers({
    location: npc.location, maxDistance: COMBATE.radio, closest: 1,
    excludeGameModes: [GameMode.Creative, GameMode.Spectator],
  });
  const pelea = quierePelear(npc, s, jugador);
  if (s.bote) {
    if (jugador && pelea) rumboBote(npc, jugador.location);
    return tickBote(npc, s);
  }
  if (tickAgua(npc, s, pelea ? jugador : undefined)) {
    hostil(npc, s, pelea);
    pausarRutina(npc, s);
    return;
  }
  if (s.reunion) {
    hostil(npc, s, false);
    pausarRutina(npc, s);
    ponerHaciendo(npc, s, "§d¡buscando al jugador!");
    const lejos = Math.hypot(npc.location.x - s.reunion.x, npc.location.z - s.reunion.z);
    if (lejos > 6 && s.reunionDesde && now() - s.reunionDesde > 600) {
      s.reunionDesde = now(); // tarda demasiado: llega con una perla
      perlaHasta(npc, s.reunion);
      return;
    }
    const actual = destinoActual(npc);
    if (lejos > 1.5 && (!caminando(npc) || !actual || Math.hypot(actual.x - s.reunion.x, actual.z - s.reunion.z) > 2)) {
      velocidad(npc, 0);
      caminarA(npc, s.reunion, 0.28);
    }
    return;
  }
  hostil(npc, s, pelea);
  if (tickObra(npc, s)) return;
  if (pelea) {
    pausarRutina(npc, s);
    s.combateHasta = now() + 40;
    ponerHaciendo(npc, s, "§c¡a pelear!");
    tickCombate(npc, s, jugador);
    if (cada(s, "xpPelea", 20)) aprender(npc, s, 0.02); // experiencia por tiempo de pelea
    return;
  }
  if (now() < (s.combateHasta ?? 0) + 20) velocidad(npc, 0); // recién salido de una pelea: se calma
  tickRutina(npc, s);
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
        cerebro(npc);
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

// Golpes: aprende de los que recibe y de los que acierta. Si un jugador lo ataca,
// pelea aunque estuviera tranquilo.
world.afterEvents.entityHurt.subscribe(({ hurtEntity, damageSource }) => {
  const atacante = damageSource.damagingEntity;
  if (hurtEntity.typeId === NPC && atacante instanceof Player) {
    const s = estados.get(hurtEntity.id);
    if (!s) return;
    if (damageSource.cause === EntityDamageCause.projectile) s.memoria.arco++;
    else s.memoria.golpes++;
    if (!s.clase) s.provocadoHasta = now() + 1200;
    aprender(hurtEntity, s, 0.4);
  } else if (hurtEntity instanceof Player && atacante?.typeId === NPC) {
    const s = estados.get(atacante.id);
    if (!s) return;
    if (s.ultima) s.memoria.exitos[s.ultima] = (s.memoria.exitos[s.ultima] ?? 0) + 1;
    aprender(atacante, s, 0.5);
    if (damageSource.cause === EntityDamageCause.entityAttack) animarGolpe(atacante); // por si el juego no avisó del golpe
  }
});

world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
  const asesino = damageSource.damagingEntity;
  if (deadEntity instanceof Player && asesino?.typeId === NPC) {
    const s = estados.get(asesino.id);
    if (s) aprender(asesino, s, 5);
  }
});

// Escudo: solo para flechas y proyectiles que llegan por delante con el escudo
// levantado. Tras un water drop, un clutch o una picada con maza no recibe daño
// por caída. Durante la fusión es intocable.
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
  const npc = event.hurtEntity;
  if (bloqueaProyectil(npc, s, event.damageSource)) {
    event.cancel = true;
    system.run(() => efectoBloqueo(npc, s));
  }
}, { entityFilter: { type: NPC } });

world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => estados.delete(removedEntityId));
