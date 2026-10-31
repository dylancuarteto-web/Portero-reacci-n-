import { GameMode, ItemStack, system, world } from "@minecraft/server";
import { ANIM, DIMENSIONES, PARTICLES, PROP, ROBOT, ROBOT_CFG } from "../config.js";
import { estados } from "../estado.js";
import { ponerHaciendo } from "../iq.js";
import { hostil, sentarse } from "../postura.js";
import { animate, cada, distancia, now, particleAt, rand, sound, soundAt } from "../util.js";
import { explosionFinal, laser, lanzarMisiles, limpiarMisiles, metralla, pisoton } from "./armas.js";

// Robot de los Claudes: lo construyen cinco Claudes con IQ 500, se suben (cabina, dos
// hombros y la espalda) y lo manejan. Te persigue y te ataca con misiles, láser,
// metralla y pisotones. A los 5 minutos suena la alarma y se autodestruye (o antes,
// si lo destruyes tú); los Claudes saltan a tiempo.

export const robots = new Map(); // id del robot → estado

function objetivo(e) {
  try {
    const lista = e.dimension.getPlayers({ location: e.location, maxDistance: ROBOT_CFG.vista,
      excludeGameModes: [GameMode.Creative, GameMode.Spectator] });
    return lista.sort((a, b) => distancia(a.location, e.location) - distancia(b.location, e.location))[0];
  } catch {
    return undefined;
  }
}

function avisar(e, texto, radio = 48) {
  try {
    for (const p of e.dimension.getPlayers({ location: e.location, maxDistance: radio })) p.onScreenDisplay.setActionBar(texto);
  } catch {
    // Sin jugadores.
  }
}

// Sube a los pilotos uno por uno a sus asientos (ya son pilotos desde el principio).
function subirPilotos(r) {
  for (const npc of r.pilotos) {
    const s = estados.get(npc.id);
    if (s) s.robot = r;
  }
  r.pilotos.forEach((npc, i) => {
    system.runTimeout(() => {
      try {
        if (!npc.isValid || !r.e.isValid) return;
        const s = estados.get(npc.id);
        if (s) sentarse(npc, s, true);
        r.e.getComponent("minecraft:rideable")?.addRider(npc);
        particleAt(npc.dimension, PARTICLES.teletransporte, npc.location);
      } catch {
        // No se pudo subir.
      }
    }, 20 + i * 6);
  });
}

export function crearRobot(dimension, pos, frente, pilotos) {
  let e;
  try {
    e = dimension.spawnEntity(ROBOT, pos);
  } catch {
    return undefined;
  }
  const r = { e, pilotos, desde: now(), hasta: now() + ROBOT_CFG.duracion, cd: { ataque: now() + 60 }, alarma: false };
  robots.set(e.id, r);
  try {
    if (frente) e.teleport(pos, { facingLocation: frente });
  } catch {
    // Sin giro.
  }
  animate(e, ANIM.robotEnsamblaje);
  sound(e, "beacon.activate", 0.6, 1);
  subirPilotos(r);
  for (const p of dimension.getPlayers({ location: pos, maxDistance: 64 })) {
    try {
      p.onScreenDisplay.setTitle("§b§lROBOT DE LOS CLAUDES", { subtitle: "§fCinco genios lo manejan... ¡durante 5 minutos!",
        fadeInDuration: 8, stayDuration: 50, fadeOutDuration: 12 });
    } catch {
      // Sin título.
    }
  }
  return r;
}

// Baja a los pilotos (caen suave) y les da 20 minutos de descanso antes de otro robot.
function bajarPilotos(r) {
  try {
    r.e.getComponent("minecraft:rideable")?.ejectRiders();
  } catch {
    // Ya no tenía jinetes.
  }
  for (const npc of r.pilotos) {
    const s = estados.get(npc.id);
    if (s) {
      s.robot = undefined;
      s.cd.robot = now() + ROBOT_CFG.descanso;
      s.sinCaidaHasta = now() + 200;
      if (npc.isValid) {
        sentarse(npc, s, false);
        ponerHaciendo(npc, s, "");
      }
    }
    try {
      if (npc.isValid) npc.addEffect("slow_falling", 120, { amplifier: 0, showParticles: false });
    } catch {
      // Sin efecto.
    }
  }
}

function terminar(r, motivo) {
  robots.delete(r.e.id);
  limpiarMisiles(r.e.id);
  bajarPilotos(r);
  if (!r.e.isValid) return;
  try {
    explosionFinal(r.e);
    const loc = r.e.location;
    const botin = [{ item: "minecraft:iron_ingot", n: 12 }, { item: "minecraft:redstone", n: 16 },
      { item: "minecraft:copper_ingot", n: 8 }, { item: "minecraft:diamond", n: 2 }];
    for (const { item, n } of botin) r.e.dimension.spawnItem(new ItemStack(item, n), loc);
    avisar(r.e, motivo === "tiempo" ? "§c¡El robot se autodestruyó! Los Claudes saltaron a tiempo" : "§a¡Destruiste el robot de los Claudes!");
    if (motivo === "tiempo") r.e.remove();
  } catch {
    // Ya no existe.
  }
}

function atacar(r, j) {
  const e = r.e;
  const d = distancia(e.location, j.location);
  const opciones = [];
  if (d < 7) opciones.push({ f: () => pisoton(e), p: 3 });
  if (d > 6) opciones.push({ f: () => lanzarMisiles(e, j, rand(4, 6)), p: 3 });
  if (d > 4 && d < 32) opciones.push({ f: () => laser(e, j), p: 2 });
  if (d > 4 && d < 26) opciones.push({ f: () => metralla(e, j), p: 2 });
  if (!opciones.length) return;
  let x = Math.random() * opciones.reduce((t, o) => t + o.p, 0);
  for (const o of opciones) {
    x -= o.p;
    if (x > 0) continue;
    const dur = o.f() || 40;
    r.cd.ataque = now() + dur + rand(...ROBOT_CFG.ataqueCada);
    return;
  }
}

system.runInterval(() => {
  for (const r of [...robots.values()]) {
    const e = r.e;
    if (!e.isValid) {
      robots.delete(e.id);
      limpiarMisiles(e.id);
      bajarPilotos(r);
      continue;
    }
    try {
      r.tic = (r.tic ?? 0) + 1; // una vuelta cada 2 ticks
      const resta = r.hasta - now();
      // Cuenta atrás: alarma los últimos 3 segundos y luego se autodestruye.
      if (resta <= 60 && !r.alarma) {
        r.alarma = true;
        e.setProperty(PROP.alarma, true);
        avisar(e, "§c§l¡AUTODESTRUCCIÓN! §r§c¡Aléjate!");
      }
      if (r.alarma) {
        if (r.tic % 4 === 0) soundAt(e.dimension, e.location, "note.pling", r.tic % 8 === 0 ? 2 : 1.4, 1);
        if (resta <= 0) terminar(r, "tiempo");
        continue;
      }
      const j = objetivo(e);
      if (r.tic % 100 === 0 && j) {
        const s = Math.ceil(resta / 20);
        try {
          j.onScreenDisplay.setActionBar(`§b§lRobot de los Claudes §r§7- §f${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
        } catch {
          // Sin pantalla.
        }
      }
      if (r.tic % 10 === 0) {
        particleAt(e.dimension, PARTICLES.construir, { x: e.location.x, y: e.location.y + 3.6, z: e.location.z });
        // Si algún piloto se bajó, vuelve a subir.
        for (const npc of r.pilotos) {
          if (!npc.isValid) continue;
          const montado = npc.getComponent("minecraft:riding")?.entityRidingOn?.id === e.id;
          if (!montado) e.getComponent("minecraft:rideable")?.addRider(npc);
        }
      }
      if (j && now() >= r.cd.ataque) atacar(r, j);
    } catch {
      // Descargado.
    }
  }
}, 2);

// Los pilotos solo pilotan: quietos, tranquilos y sin hacer otra cosa.
export function tickPiloto(npc, s) {
  const r = s.robot;
  if (!r?.e?.isValid) {
    s.robot = undefined;
    if (s.sentado) sentarse(npc, s, false);
    return;
  }
  hostil(npc, s, false);
  ponerHaciendo(npc, s, "§bpilotando el robot");
  if (cada(s, "pilotar", 40)) animate(npc, ANIM.pilotar);
}

world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
  if (deadEntity.typeId !== ROBOT) return;
  const r = robots.get(deadEntity.id);
  if (r) terminar(r, "derrotado");
});

// Puñetazo del robot (cuando la IA del juego golpea cuerpo a cuerpo).
world.afterEvents.entityHitEntity.subscribe(({ damagingEntity }) => {
  if (damagingEntity?.typeId !== ROBOT) return;
  system.run(() => {
    if (!damagingEntity.isValid) return;
    animate(damagingEntity, ANIM.robotGolpe);
    sound(damagingEntity, "random.anvil_land", 0.7, 0.6);
  });
});

world.afterEvents.entityHurt.subscribe(({ hurtEntity }) => {
  if (hurtEntity.typeId !== ROBOT) return;
  particleAt(hurtEntity.dimension, PARTICLES.bloqueo, { x: hurtEntity.location.x, y: hurtEntity.location.y + 2.5, z: hurtEntity.location.z });
  sound(hurtEntity, "random.anvil_land", 1.8, 0.3);
});

// Al recargar el mundo, un robot sin pilotos registrados se apaga solo.
system.runInterval(() => {
  for (const id of DIMENSIONES) {
    try {
      for (const e of world.getDimension(id).getEntities({ type: ROBOT })) {
        if (robots.has(e.id)) continue;
        const r = { e, pilotos: [], desde: now(), hasta: now() + 200, cd: { ataque: now() + 60 }, alarma: false };
        robots.set(e.id, r);
      }
    } catch {
      // Dimensión sin cargar.
    }
  }
}, 200);
