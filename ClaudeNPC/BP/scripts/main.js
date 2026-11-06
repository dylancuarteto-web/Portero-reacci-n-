import { EntityDamageCause, EquipmentSlot, GameMode, Player, system, world } from "@minecraft/server";
import { ARMADURA_IQ, COMBATE, DIMENSIONES, DUELO, MODIFICA_MUNDO, NPC } from "./config.js";
import { pausarRutina, tickRutina } from "./actividades/index.js";
import { rumboBote, tickAgua, tickBote } from "./bote.js";
import { tickAlumno } from "./clase.js";
import { animarGolpe, tickCombate } from "./combate.js";
import { registrarComandos } from "./comandos.js";
import { paradaCuerpo } from "./duelo.js";
import { vestir } from "./equipo.js";
import { bajarEscudo, efectoBloqueo } from "./escudo.js";
import { estados, obtenerEstado } from "./estado.js";
import { nivelHab } from "./habilidades.js";
import { contraataque } from "./habilidades/reflejos.js";
import { revisarFusion } from "./fusion.js";
import "./golden/index.js";
import "./corazon.js";
import { aprender, ponerHaciendo } from "./iq.js";
import { suspenderPorAtaque } from "./maestro.js";
import { revisarRobot } from "./robot/construccion.js";
import { tickPiloto } from "./robot/index.js";
import { tickArmador } from "./multi/index.js";
import { tickReparador } from "./multi/reparar.js";
import { tickPasajero } from "./multi/plataforma.js";
import { caminarA, caminando, deslizar, destinoActual, salidaDePozo, saltando, seAtasco, velocidad } from "./movimiento.js";
import { cargarHogar } from "./obras/casa.js";
import { tickObra } from "./obras/index.js";
import { iniciarTorre } from "./obras/torre.js";
import { hostil } from "./postura.js";
import { bloquePropio, golpear, perlaHasta, vigilarCaida } from "./tacticas.js";
import { cada, now, superficie } from "./util.js";
import { alSensor, devolverVida, etiqueta, EVENTO, ponerVida, TAG, vida } from "./dano.js";
import { ayudarse, pedirAyuda } from "./ayuda.js";

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

let pvp = { valor: true, hasta: -1 };
function pvpActivo() {
  if (now() < pvp.hasta) return pvp.valor;
  try {
    pvp = { valor: world.gameRules.pvp !== false, hasta: now() + 100 };
  } catch {
    pvp = { valor: true, hasta: now() + 100 };
  }
  return pvp.valor;
}

// ¿Pelea con este jugador? Cada Claude tiene su propio radio; si lo atacaron, pelea igual.
function quierePelear(npc, s, jugador) {
  if (!jugador) return false;
  const d = Math.hypot(jugador.location.x - npc.location.x, jugador.location.z - npc.location.z);
  if (now() < (s.provocadoHasta ?? 0)) return true;
  if (COMBATE.respetarPvP && !pvpActivo()) return false;
  if (!s.hostil && s.mina && jugador.location.y - npc.location.y > 6) return false; // está minando y no lo ve
  const radio = s.pers?.radio ?? 20;
  // Una vez que pelea, no te suelta aunque te alejes (te sigue hasta COMBATE.persigue).
  return d <= radio || (s.hostil && d <= Math.max(radio + 16, COMBATE.persigue));
}

// Dos Claudes en el mismo sitio se empujan y "tiemblan" (se veía en el video: dos encimados
// a lo lejos). Si otro Claude está casi encima, uno de los dos se aparta un paso.
function separarse(npc, s) {
  if (s.obra || s.sentado || s.casa || s.bote || s.plataforma || (s.robotObra && s.robotObra.fase !== "reunion") || saltando(npc) || !npc.isOnGround
    || now() < (s.cd.separar ?? 0)) return;
  let otros = [];
  try {
    otros = npc.dimension.getEntities({ type: NPC, location: npc.location, maxDistance: 0.8 });
  } catch {
    return;
  }
  const otro = otros.find((o) => o.id !== npc.id);
  if (!otro || npc.id < otro.id) return; // se aparta solo uno de los dos (siempre el mismo)
  s.cd.separar = now() + 14;
  const l = npc.location;
  const dx = l.x - otro.location.x;
  const dz = l.z - otro.location.z;
  const d = Math.hypot(dx, dz);
  const ang = Math.random() * Math.PI * 2;
  const ux = d > 0.05 ? dx / d : Math.cos(ang);
  const uz = d > 0.05 ? dz / d : Math.sin(ang);
  // Prueba hacia afuera y luego a los lados, a donde haya sitio para pararse.
  for (const [ax, az] of [[ux, uz], [-uz, ux], [uz, -ux]]) {
    const destino = { x: l.x + ax * 0.95, y: l.y, z: l.z + az * 0.95 };
    const pie = npc.dimension.getBlock({ x: Math.floor(destino.x), y: Math.floor(destino.y), z: Math.floor(destino.z) });
    const cabeza = npc.dimension.getBlock({ x: Math.floor(destino.x), y: Math.floor(destino.y) + 1, z: Math.floor(destino.z) });
    const suelo = npc.dimension.getBlock({ x: Math.floor(destino.x), y: Math.floor(destino.y) - 1, z: Math.floor(destino.z) });
    if (pie?.isAir && cabeza?.isAir && suelo && !suelo.isAir && !suelo.isLiquid) {
      deslizar(npc, destino, 4);
      return;
    }
  }
}

function cerebro(npc) {
  const s = obtenerEstado(npc);
  if (!s.hogarCargado) {
    s.hogar = cargarHogar(npc);
    s.hogarCargado = true;
  }
  if (s.fusion) return;
  if (cada(s, "reflejos5", 40)) s.reflejos5 = nivelHab(npc, s, "reflejos") >= 5;
  if (s.robot) return tickPiloto(npc, s);
  // Fuera de la pelea: se cura solo y se pone la armadura que le toca por su IQ (cuero,
  // cota, hierro, diamante, netherita). Al morir no la suelta.
  if (now() > (s.combateHasta ?? 0) + 200) {
    if (cada(s, "regen", 40)) {
      try {
        const h = npc.getComponent("minecraft:health");
        if (h && h.currentValue < h.effectiveMax) h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + 2));
      } catch {
        // Sin vida.
      }
    }
    if (cada(s, "armadura", 200)) {
      const nivelIQ = Math.max(0, ARMADURA_IQ.filter((iq) => (s.iq ?? 0) >= iq).length - 1);
      if (nivelIQ > (s.nivelArmadura ?? 0)) {
        s.nivelArmadura = nivelIQ;
        vestir(npc, nivelIQ);
      }
    }
  }
  vigilarCaida(npc, s);
  if (s.clase) return tickAlumno(npc, s);
  if (s.multiObra) {
    // Armando un Robot multi con otro Claude (multi/index.js): deja la pelea un momento.
    tickArmador(npc, s);
    pausarRutina(npc, s);
    return;
  }
  if (s.reparacion) {
    // Reparando un Robot multi apagado (multi/reparar.js): lo lleva, estudia y lo recarga.
    tickReparador(npc, s);
    pausarRutina(npc, s);
    return;
  }
  if (s.plataforma) {
    // Viajando sentado en la plataforma voladora del Robot multi (multi/plataforma.js).
    tickPasajero(npc, s);
    pausarRutina(npc, s);
    return;
  }
  try {
    separarse(npc, s);
  } catch {
    // Sin bloques cargados.
  }
  if (s.robotObra && s.robotObra.fase !== "reunion") {
    // Construyendo el robot: el turno lo maneja robot/construccion.js.
    hostil(npc, s, false);
    velocidad(npc, 0);
    pausarRutina(npc, s);
    return;
  }
  const [jugador] = npc.dimension.getPlayers({
    location: npc.location, maxDistance: s.hostil ? COMBATE.persigue : COMBATE.radio, closest: 1,
    excludeGameModes: [GameMode.Creative, GameMode.Spectator],
  });
  const pelea = quierePelear(npc, s, jugador);
  if (s.bote) {
    if (jugador && pelea) rumboBote(npc, jugador.location);
    return tickBote(npc, s);
  }
  // Agua 2 y 3: nada rápido como un delfín y respira bajo el agua.
  if (npc.isInWater && cada(s, "aguaHab", 60)) {
    const na = nivelHab(npc, s, "agua");
    try {
      if (na >= 2) npc.addEffect("dolphins_grace", 80, { amplifier: 0, showParticles: false });
      if (na >= 3) npc.addEffect("water_breathing", 200, { amplifier: 0, showParticles: false });
    } catch {
      // Sin efecto.
    }
  }
  if (tickAgua(npc, s, pelea ? jugador : undefined)) {
    hostil(npc, s, pelea);
    pausarRutina(npc, s);
    return;
  }
  if (s.reunion) {
    hostil(npc, s, false);
    pausarRutina(npc, s);
    ponerHaciendo(npc, s, s.robotObra ? "§b¡a construir el robot!" : "§d¡buscando al jugador!");
    const lejos = Math.hypot(npc.location.x - s.reunion.x, npc.location.z - s.reunion.z);
    // Si tarda demasiado (o se atascó, o quedó bajo tierra), llega con una perla.
    const espera = now() - (s.reunionDesde ?? now());
    if (lejos > 6 && s.reunionDesde && (espera > 600 || (seAtasco(npc) && espera > 80))) {
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
  // Quedó en un pozo o una cueva sin salida caminando: sale con una torre, como un
  // jugador. Si a la tercera no lo logra (techo que su pico no rompe), sale con una perla.
  const pozo = salidaDePozo(npc);
  if (pozo !== undefined && !s.obra && !s.casa) {
    s.intentosPozo = now() - (s.ultimoPozo ?? -10000) < 1200 ? (s.intentosPozo ?? 0) + 1 : 1;
    s.ultimoPozo = now();
    if (s.intentosPozo >= 3 || !MODIFICA_MUNDO) {
      const top = superficie(npc.dimension, npc.location.x, npc.location.z);
      if (top) perlaHasta(npc, { x: Math.floor(npc.location.x) + 0.5, y: top.location.y + 1, z: Math.floor(npc.location.z) + 0.5 });
      s.intentosPozo = 0;
    } else {
      iniciarTorre(npc, s, pozo, bloquePropio(s));
      ponerHaciendo(npc, s, "§7saliendo del pozo");
    }
  }
  if (tickObra(npc, s)) return;
  if (pelea) {
    pausarRutina(npc, s);
    s.combateHasta = now() + 40;
    s.objetivo = jugador;
    ponerHaciendo(npc, s, "§c¡a pelear!");
    tickCombate(npc, s, jugador);
    ayudarse(npc, s);
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
system.runInterval(revisarRobot, 40);

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
// pelea aunque estuviera tranquilo (y los Claudes de cerca vienen a ayudarlo).
function golpeDeJugador(npc, s, jugador, flecha) {
  if (flecha) s.memoria.arco++;
  else s.memoria.golpes++;
  // Si estaba en clase, la clase se suspende y todos (alumnos y Claudes cercanos) te atacan.
  if (s.clase) suspenderPorAtaque(s.clase.sesion);
  s.provocadoHasta = now() + 1200;
  aprender(npc, s, 0.4);
  pedirAyuda(npc, s, jugador);
}

function tieneHacha(jugador) {
  try {
    return /_axe$/.test(jugador.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand)?.typeId ?? "");
  } catch {
    return false;
  }
}

world.afterEvents.entityHurt.subscribe(({ hurtEntity, damageSource, damage }) => {
  const atacante = damageSource.damagingEntity;
  if (hurtEntity.typeId === NPC && atacante instanceof Player) {
    const s = estados.get(hurtEntity.id);
    if (!s) return;
    // Ningún golpe tuyo le quita más de DUELO.maxGolpe (una maza desde lo alto no lo mata de uno).
    if (damage > DUELO.maxGolpe) devolverVida(hurtEntity, damage - DUELO.maxGolpe);
    // Con un hacha le rompes el escudo (el sensor deja pasar los golpes con hacha).
    if (damageSource.cause === EntityDamageCause.entityAttack && s.escudoArriba && deFrente(hurtEntity, atacante) && tieneHacha(atacante)) {
      bajarEscudo(hurtEntity, s, 100);
      try {
        hurtEntity.dimension.playSound("random.break", hurtEntity.location, { pitch: 0.8, volume: 1 });
      } catch {
        // Sin sonido.
      }
    }
    golpeDeJugador(hurtEntity, s, atacante, damageSource.cause === EntityDamageCause.projectile);
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

// Escudo, reflejos, caídas y fusión (los sensores de daño de claude.entity.json leen
// estas etiquetas; ver dano.js). Se ponen cada tick:
//   - intocable durante la fusión;
//   - sin daño por caída tras un water drop, un clutch o una picada con maza;
//   - escudo: con el escudo arriba y quien lo amenaza enfrente para los golpes sin hacha
//     (unos 70° a cada lado) y las flechas (unos 100° a cada lado);
//   - esquiva (reflejos 5): el 35 % de los golpes le da a un reflejo y él contraataca.
function amenaza(npc, s) {
  if (s.objetivo?.isValid) return s.objetivo;
  try {
    return npc.dimension.getPlayers({ location: npc.location, maxDistance: 16, closest: 1,
      excludeGameModes: [GameMode.Creative, GameMode.Spectator] })[0];
  } catch {
    return undefined;
  }
}

function frente(npc, quien) {
  try {
    const v = npc.getViewDirection();
    const dx = quien.location.x - npc.location.x;
    const dz = quien.location.z - npc.location.z;
    const d = Math.hypot(dx, dz);
    const h = Math.hypot(v.x, v.z);
    if (d < 0.01 || h < 0.01) return 1;
    return (v.x * dx + v.z * dz) / (d * h);
  } catch {
    return -1;
  }
}

system.runInterval(() => {
  const t = now();
  for (const s of estados.values()) {
    const npc = s.npc;
    try {
      if (!npc?.isValid) continue;
      etiqueta(npc, TAG.intocable, !!s.fusion);
      etiqueta(npc, TAG.sinCaida, t < (s.sinCaidaHasta ?? 0));
      let cono = -1;
      if (s.escudoArriba) {
        const q = amenaza(npc, s);
        cono = q ? frente(npc, q) : 1;
      }
      etiqueta(npc, TAG.escudo, s.escudoArriba && cono > 0.3);
      etiqueta(npc, TAG.escudoFlechas, s.escudoArriba && cono > -0.15);
      etiqueta(npc, TAG.esquiva, !!s.reflejos5 && t >= (s.cd.contra ?? 0) && !s.robot && !s.clase && Math.random() < 0.35);
    } catch {
      // NPC descargado.
    }
  }
}, 1);

// El sensor paró el golpe con el escudo: una flecha (efecto de bloqueo, y con escudo 3 la
// devuelve) o un golpe sin hacha (parada con el cuerpo, como un jugador).
alSensor(EVENTO.bloqueo, [NPC], (npc, golpe) => {
  const s = estados.get(npc.id);
  if (!s) return;
  if (golpe?.proyectil || !(golpe?.quien instanceof Player)) {
    efectoBloqueo(npc, s, golpe?.quien);
    return;
  }
  s.memoria.bloqueos = (s.memoria.bloqueos ?? 0) + 1;
  paradaCuerpo(npc, s, golpe.quien);
  s.provocadoHasta = now() + 1200;
});

// Reflejos 5: el golpe le dio a un reflejo; él esquiva y contraataca.
alSensor(EVENTO.esquiva, [NPC], (npc, golpe) => {
  const s = estados.get(npc.id);
  if (!s) return;
  s.cd.contra = now() + 80;
  etiqueta(npc, TAG.esquiva, false);
  const atacante = golpe?.quien;
  if (atacante instanceof Player && atacante.isValid) {
    s.provocadoHasta = now() + 1200;
    contraataque(npc, s, atacante, golpear);
  }
});

// Un golpe tuyo que lo mataría, con más de 24 de vida: le quita solo 24.
alSensor(EVENTO.fatal, [NPC], (npc, golpe) => {
  const s = estados.get(npc.id);
  ponerVida(npc, vida(npc).actual - DUELO.maxGolpe);
  if (s && golpe?.quien instanceof Player) golpeDeJugador(npc, s, golpe.quien, !!golpe.proyectil);
});

world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => estados.delete(removedEntityId));

// ¿El golpe le llega por delante? (mira hacia el atacante)
function deFrente(npc, atacante) {
  try {
    const v = npc.getViewDirection();
    const dx = atacante.location.x - npc.location.x;
    const dz = atacante.location.z - npc.location.z;
    const d = Math.hypot(dx, dz) || 1;
    const h = Math.hypot(v.x, v.z) || 1;
    return (v.x * dx + v.z * dz) / (d * h) > 0.3;
  } catch {
    return false;
  }
}

// --- Al morir no sueltan nada --------------------------------------------------------------
// Si no, matar a un Claude daba espadas de netherita, la maza o armaduras buenísimas en un
// momento. Se quitan los objetos que aparecen donde murió (ese tick y los dos siguientes).
const muertes = [];

function limpiarBotin(dim, pos) {
  try {
    for (const it of dim.getEntities({ type: "minecraft:item", location: pos, maxDistance: 3 })) it.remove();
  } catch {
    // Chunk descargado.
  }
}

world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
  let dim;
  let pos;
  try {
    dim = deadEntity.dimension;
    pos = { ...deadEntity.location };
  } catch {
    return;
  }
  muertes.push({ dim, pos, t: now() });
  limpiarBotin(dim, pos);
  system.run(() => limpiarBotin(dim, pos));
  system.runTimeout(() => limpiarBotin(dim, pos), 3);
}, { entityTypes: [NPC] });

world.afterEvents.entitySpawn.subscribe(({ entity }) => {
  if (!muertes.length) return;
  while (muertes.length && now() - muertes[0].t > 6) muertes.shift();
  try {
    if (entity.typeId !== "minecraft:item") return;
    const l = entity.location;
    const cerca = muertes.some((m) => m.dim.id === entity.dimension.id && Math.hypot(m.pos.x - l.x, m.pos.y - l.y, m.pos.z - l.z) < 3);
    if (cerca) entity.remove();
  } catch {
    // Ya no está.
  }
});
