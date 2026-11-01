import { GameMode, ItemStack, system, world } from "@minecraft/server";
import { ANIM, DIMENSIONES, MODIFICA_MUNDO, PARTICLES, PROP, ROBOT, ROBOT_CFG } from "../config.js";
import { estados } from "../estado.js";
import { protegido } from "../estructuras.js";
import { ponerHaciendo } from "../iq.js";
import { IRROMPIBLES } from "../obras/excavar.js";
import { hostil, sentarse } from "../postura.js";
import {
  animate, blockAt, cada, distancia, now, particleAt, rand, reemplazable, romperDestruyendo, sound, soundAt,
} from "../util.js";
import { explosionFinal, laser, lanzarMisiles, limpiarMisiles, metralla, pisoton } from "./armas.js";

// Robot de los Claudes: lo construyen cinco Claudes con IQ 500, se suben (cabina, dos
// hombros y la espalda) y lo manejan. Te persigue rompiendo todo lo que se le pone
// delante (árboles, muros, casas) y te ataca con misiles, láser, metralla y pisotones.
// A los 5 minutos suena la alarma y se autodestruye (o antes, si lo destruyes tú);
// los Claudes saltan a tiempo.

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

// Terreno natural a la altura de los pies: no lo rompe (así sube cuestas en vez de
// cavar zanjas). Árboles, vallas, muros y construcciones sí.
const TERRENO = /(dirt|grass_block|^minecraft:grass$|stone$|sand|sandstone|gravel|deepslate|tuff|clay|mud|snow|ice|terracotta|netherrack|basalt|blackstone|end_stone|podzol|mycelium|moss_block|calcite|granite|diorite|andesite|_ore|farmland|grass_path|dirt_path)$/;

// Rompe lo que tiene delante (cuerpo entero, un poco más ancho que él), como si lo
// apartara al caminar. Hasta 10 bloques cada vez para no trabar el juego.
function abrirCamino(r, j) {
  const e = r.e;
  let dir;
  if (j && distancia(e.location, j.location) > 3.5) {
    const dx = j.location.x - e.location.x;
    const dz = j.location.z - e.location.z;
    const d = Math.hypot(dx, dz) || 1;
    dir = { x: dx / d, z: dz / d };
  } else {
    const v = e.getVelocity();
    const h = Math.hypot(v.x, v.z);
    if (h < 0.03) return;
    dir = { x: v.x / h, z: v.z / h };
  }
  const lado = { x: -dir.z, z: dir.x };
  const dim = e.dimension;
  const y0 = Math.floor(e.location.y + 0.01);
  const vistos = new Set();
  let rotos = 0;
  for (const adelante of [1.7, 2.5]) {
    for (const l of [-1.3, -0.45, 0.45, 1.3]) {
      const x = Math.floor(e.location.x + dir.x * adelante + lado.x * l);
      const z = Math.floor(e.location.z + dir.z * adelante + lado.z * l);
      for (let h = 0; h <= 5; h++) {
        const p = { x, y: y0 + h, z };
        const k = `${x},${p.y},${z}`;
        if (vistos.has(k)) continue;
        vistos.add(k);
        const b = blockAt(dim, p);
        if (!b || b.isAir || b.isLiquid || reemplazable(b)) continue;
        if (IRROMPIBLES.test(b.typeId) || (h === 0 && TERRENO.test(b.typeId)) || protegido(p)) continue;
        if (!romperDestruyendo(dim, p)) continue;
        if (++rotos >= 10) break;
      }
      if (rotos >= 10) break;
    }
    if (rotos >= 10) break;
  }
  if (rotos) {
    animate(e, ANIM.robotGolpe);
    soundAt(dim, e.location, "random.anvil_land", 0.5, 0.5);
    particleAt(dim, PARTICLES.polvo, { x: e.location.x + dir.x * 2, y: e.location.y + 1, z: e.location.z + dir.z * 2 });
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
      if (MODIFICA_MUNDO && r.tic % 4 === 0) abrirCamino(r, j);
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
