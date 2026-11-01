import { EntityDamageCause, GameMode, ItemStack, Player, system, world } from "@minecraft/server";
import { ANIM, DIMENSIONES, MODIFICA_MUNDO, PARTICLES, PROP, ROBOT, ROBOT_CFG } from "../config.js";
import { estados } from "../estado.js";
import { protegido } from "../estructuras.js";
import { ponerHaciendo } from "../iq.js";
import { IRROMPIBLES } from "../obras/excavar.js";
import { velocidad } from "../movimiento.js";
import { hostil, sentarse } from "../postura.js";
import {
  animate, blockAt, cada, distancia, now, particleAt, rand, reemplazable, romperDestruyendo, sound, soundAt,
} from "../util.js";
import { explosionFinal, laser, lanzarMisiles, limpiarMisiles, metralla, pisoton } from "./armas.js";
import {
  escudoEnergia, iman, laserGiratorio, limpiarPunos, lluviaTornillos, punoCohete, saltoAplastante, temblor,
} from "./habilidades.js";

// Robot de los Claudes: lo construyen cinco Claudes con IQ 500, se suben (cabina, dos
// hombros y la espalda) y lo manejan. Te persigue (corre si estás lejos) rompiendo todo
// lo que se le pone delante y te ataca con misiles, láser, metralla y pisotones.
// Fases por IQ: empieza con el IQ de sus pilotos y, al perder un tercio de su vida,
// sobrecarga su IQ (+200) y pasa de Prototipo a Turbo (salto aplastante, puño cohete,
// lluvia de tornillos) y a Genio (escudo de energía, láser giratorio, imán), cambiando
// de colores. A los 5 minutos suena la alarma y se autodestruye.

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
function subirPilotos(r, primero = 20, entre = 6) {
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
    }, primero + i * entre);
  });
}

// --- Fases de IQ ----------------------------------------------------------------------

function faseDe(iq) {
  let f = 0;
  ROBOT_CFG.fases.forEach((x, i) => {
    if (iq >= x.iq) f = i;
  });
  return f;
}

function nombrar(r) {
  const f = ROBOT_CFG.fases[r.fase];
  try {
    r.e.nameTag = `${f.color}§lRobot de los Claudes§r §7· §fIQ ${r.iq} §7· ${f.color}${f.nombre}`;
  } catch {
    // Sin nombre.
  }
}

function aplicarFase(r) {
  try {
    r.e.setProperty(PROP.fase, r.fase);
  } catch {
    // Sin propiedad.
  }
  nombrar(r);
}

// Sobrecarga de IQ: se detiene, levanta los brazos, todo tiembla, cambia de color y
// empuja a quien esté cerca. Los pilotos celebran.
function sobrecarga(r) {
  const e = r.e;
  const antes = r.fase;
  r.iq = Math.min(1000, r.iq + 200);
  r.fase = faseDe(r.iq);
  r.cd.ataque = now() + 54;
  aplicarFase(r);
  animate(e, ANIM.robotSobrecarga);
  const c = { x: e.location.x, y: e.location.y + 2.5, z: e.location.z };
  soundAt(e.dimension, c, "beacon.power", 1.2, 1);
  soundAt(e.dimension, c, "random.levelup", 0.6, 1);
  for (let k = 0; k < 5; k++) system.runTimeout(() => e.isValid && particleAt(e.dimension, PARTICLES.ondaChispa, { x: c.x, y: c.y - 2.3 + k * 0.9, z: c.z }), k * 4);
  particleAt(e.dimension, PARTICLES.fusionDestello, c);
  particleAt(e.dimension, PARTICLES.onda, { x: c.x, y: e.location.y + 0.1, z: c.z });
  temblor(e.dimension, c, 24, 0.5, 1.2);
  for (const n of r.pilotos) {
    if (!n.isValid) continue;
    animate(n, ANIM.celebrar);
    particleAt(n.dimension, PARTICLES.idea, { x: n.location.x, y: n.location.y + 2.2, z: n.location.z });
  }
  const f = ROBOT_CFG.fases[r.fase];
  for (const p of e.dimension.getPlayers({ location: e.location, maxDistance: 48 })) {
    try {
      p.onScreenDisplay.setTitle("§6§l¡SOBRECARGA DE IQ!",
        { subtitle: r.fase !== antes ? `${f.color}Fase ${r.fase + 1}: ${f.nombre} §7· §fIQ ${r.iq}` : `§fIQ ${r.iq}`,
          fadeInDuration: 6, stayDuration: 40, fadeOutDuration: 10 });
      const d = Math.hypot(p.location.x - c.x, p.location.z - c.z) || 1;
      if (d < 7) p.applyKnockback({ x: ((p.location.x - c.x) / d) * 1.2, z: ((p.location.z - c.z) / d) * 1.2 }, 0.5);
    } catch {
      // Jugador no disponible.
    }
  }
}

function vida(e) {
  try {
    const h = e.getComponent("minecraft:health");
    return h ? h.currentValue / h.effectiveMax : 1;
  } catch {
    return 1;
  }
}

export function crearRobot(dimension, pos, frente, pilotos, { cinematica = false } = {}) {
  let e;
  try {
    e = dimension.spawnEntity(ROBOT, pos);
  } catch {
    return undefined;
  }
  const iqs = pilotos.map((n) => estados.get(n.id)?.iq ?? 500);
  const iq = Math.max(500, Math.round(iqs.reduce((a, b) => a + b, 0) / Math.max(1, iqs.length) / 10) * 10);
  const r = { e, pilotos, desde: now(), hasta: now() + ROBOT_CFG.duracion, cd: { ataque: now() + 60 }, alarma: false,
    iq, fase: faseDe(iq), sobrecargas: 0 };
  robots.set(e.id, r);
  aplicarFase(r);
  try {
    if (frente) e.teleport(pos, { facingLocation: frente });
  } catch {
    // Sin giro.
  }
  animate(e, ANIM.robotEnsamblaje);
  sound(e, "beacon.activate", 0.6, 1);
  subirPilotos(r, cinematica ? 1 : 20, cinematica ? 1 : 6); // en la cinemática ya aparecen arriba
  if (cinematica) return r; // la cinemática pone su propio título
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
  limpiarPunos(r.e.id);
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
  romperDelante(r, dir);
}

function romperDelante(r, dir, golpe = true) {
  const e = r.e;
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
  if (rotos && golpe) {
    animate(e, ANIM.robotGolpe);
    soundAt(dim, e.location, "random.anvil_land", 0.5, 0.5);
    particleAt(dim, PARTICLES.polvo, { x: e.location.x + dir.x * 2, y: e.location.y + 1, z: e.location.z + dir.z * 2 });
  }
}

// Embestida: si te alejas, se agacha, prende los cohetes de la espalda y se lanza hacia
// ti (hasta 16 bloques) rompiendo lo que haya en medio. Si te alcanza, te manda a volar.
function embestida(r, j) {
  const e = r.e;
  const dim = e.dimension;
  const desde = { ...e.location };
  const dx = j.location.x - desde.x;
  const dz = j.location.z - desde.z;
  const d = Math.hypot(dx, dz) || 1;
  const dir = { x: dx / d, z: dz / d };
  const largo = Math.min(16, d - 2.5);
  if (largo < 4) return 0;
  animate(e, ANIM.robotAgacharse);
  sound(e, "mob.irongolem.throw", 0.6, 1);
  for (const n of r.pilotos) {
    const s = estados.get(n.id);
    if (s) s.sinCaidaHasta = now() + 100;
  }
  let t = 0;
  let pegado = false;
  let avance = 0;
  const id = system.runInterval(() => {
    t++;
    try {
      if (!e.isValid) return system.clearRun(id);
      const atras = { x: e.location.x - dir.x * 1.4, y: e.location.y + 2.6, z: e.location.z - dir.z * 1.4 };
      if (t < 10) {
        if (t % 2 === 0) particleAt(dim, PARTICLES.cohete, atras);
        return;
      }
      if (t === 10) {
        animate(e, ANIM.robotGolpe);
        soundAt(dim, e.location, "firework.launch", 0.5, 1);
        soundAt(dim, e.location, "random.explode", 1.6, 0.4);
      }
      romperDelante(r, dir, false);
      // Si algo que no puede romper le cierra el paso, frena ahí.
      const frente = blockAt(dim, { x: e.location.x + dir.x * 1.6, y: e.location.y + 1.2, z: e.location.z + dir.z * 1.6 });
      const f = Math.min(1, (t - 10) / 12);
      if (frente && !frente.isAir && !frente.isLiquid && !reemplazable(frente)) avance = Math.min(avance, f);
      else avance = f;
      const pos = { x: desde.x + dir.x * largo * avance, y: desde.y + Math.sin(avance * Math.PI) * 0.8, z: desde.z + dir.z * largo * avance };
      e.teleport(pos, { keepVelocity: false, facingLocation: { x: pos.x + dir.x, y: pos.y, z: pos.z + dir.z } });
      particleAt(dim, PARTICLES.cohete, atras);
      if (t % 2 === 0) particleAt(dim, PARTICLES.polvo, { x: pos.x, y: pos.y + 0.2, z: pos.z });
      if (!pegado && j.isValid && Math.hypot(j.location.x - pos.x, j.location.z - pos.z) < 2.8 && Math.abs(j.location.y - pos.y) < 3) {
        pegado = true;
        try {
          j.applyDamage(9, { cause: EntityDamageCause.entityAttack, damagingEntity: e });
          j.applyKnockback({ x: dir.x * 1.8, z: dir.z * 1.8 }, 0.6);
        } catch {
          // Jugador no disponible.
        }
        particleAt(dim, PARTICLES.estallido, { x: j.location.x, y: j.location.y + 1, z: j.location.z });
        temblor(dim, pos, 8, 0.6, 0.5);
      }
      if (t >= 22) {
        system.clearRun(id);
        temblor(dim, pos, 14, 0.35, 0.4);
      }
    } catch {
      system.clearRun(id);
    }
  }, 1);
  return 36;
}

// Elige un ataque según la distancia y la fase: cada fase suma habilidades nuevas (y
// las recién desbloqueadas salen más a menudo).
function atacar(r, j) {
  const e = r.e;
  const d = distancia(e.location, j.location);
  const fase = r.fase ?? 0;
  const opciones = [];
  if (d < 7) opciones.push({ f: () => pisoton(e), p: 3 });
  if (d > ROBOT_CFG.embestirDesde) opciones.push({ f: () => embestida(r, j), p: d > 20 ? 6 : 3.5 }); // ¡no te escapas!
  if (d > 6) opciones.push({ f: () => lanzarMisiles(e, j, rand(4, 6) + fase), p: 3 });
  if (d > 4 && d < 32) opciones.push({ f: () => laser(e, j), p: 2 });
  if (d > 4 && d < 26) opciones.push({ f: () => metralla(e, j), p: 2.5 });
  if (fase >= 1) {
    if (d > 5 && d < 22) opciones.push({ f: () => saltoAplastante(r, j), p: fase === 1 ? 3.5 : 2 });
    if (d > 5 && d < 30) opciones.push({ f: () => punoCohete(r, j), p: fase === 1 ? 3.5 : 2 });
    if (d < 24) opciones.push({ f: () => lluviaTornillos(r, j), p: fase === 1 ? 3 : 1.6 });
  }
  if (fase >= 2) {
    if (now() > (r.escudoHasta ?? 0) + 200) opciones.push({ f: () => escudoEnergia(r), p: 2.5 });
    if (d < 14) opciones.push({ f: () => laserGiratorio(r, j), p: 3.5 });
    if (d > 7 && d < 20) opciones.push({ f: () => iman(r, j), p: 3 });
  }
  if (!opciones.length) return;
  let x = Math.random() * opciones.reduce((t, o) => t + o.p, 0);
  for (const o of opciones) {
    x -= o.p;
    if (x > 0) continue;
    const dur = o.f() || 40;
    const ritmo = ROBOT_CFG.fases[fase]?.ritmo ?? 1;
    r.cd.ataque = now() + Math.round((dur + rand(...ROBOT_CFG.ataqueCada)) * ritmo);
    return;
  }
}

// Corre si estás lejos (más rápido en cada fase) y cada paso hace temblar el suelo.
function moverse(r, j) {
  const e = r.e;
  const f = ROBOT_CFG.fases[r.fase ?? 0];
  const corre = !!j && distancia(e.location, j.location) > ROBOT_CFG.correrDesde;
  if (corre !== r.corriendo) {
    r.corriendo = corre;
    try {
      e.setProperty(PROP.corriendo, corre);
    } catch {
      // Sin propiedad.
    }
  }
  velocidad(e, corre ? f.correr : f.caminar);
  if (corre && r.tic % 4 === 0) {
    const v = e.getVelocity();
    if (Math.hypot(v.x, v.z) > 0.05) {
      particleAt(e.dimension, PARTICLES.polvo, { x: e.location.x, y: e.location.y + 0.2, z: e.location.z });
      soundAt(e.dimension, e.location, "mob.irongolem.walk", 0.6, 1);
      temblor(e.dimension, e.location, 12, 0.12, 0.25);
    }
  }
}

system.runInterval(() => {
  for (const r of [...robots.values()]) {
    const e = r.e;
    if (!e.isValid) {
      robots.delete(e.id);
      limpiarMisiles(e.id);
      limpiarPunos(e.id);
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
      moverse(r, j);
      // Sobrecarga de IQ al perder un tercio de la vida (y otro tercio).
      const v = vida(e);
      if ((r.sobrecargas ?? 0) === 0 && v < 0.67) {
        r.sobrecargas = 1;
        sobrecarga(r);
      } else if (r.sobrecargas === 1 && v < 0.34) {
        r.sobrecargas = 2;
        sobrecarga(r);
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

// Puñetazo del robot (cuando la IA del juego golpea cuerpo a cuerpo): alterna el puño
// izquierdo y un revés con la minigun; el golpe se siente (onda, chispas, temblor y un
// buen empujón).
world.afterEvents.entityHitEntity.subscribe(({ damagingEntity, hitEntity }) => {
  if (damagingEntity?.typeId !== ROBOT) return;
  system.run(() => {
    if (!damagingEntity.isValid) return;
    const r = robots.get(damagingEntity.id);
    const izquierdo = !r || (r.golpes = (r.golpes ?? 0) + 1) % 2 === 1;
    animate(damagingEntity, izquierdo ? ANIM.robotGolpe : ANIM.robotGolpe2);
    sound(damagingEntity, "random.anvil_land", 0.6, 0.9);
    sound(damagingEntity, "mob.irongolem.throw", 0.7, 1);
    if (!hitEntity?.isValid) return;
    const c = { x: hitEntity.location.x, y: hitEntity.location.y + 1, z: hitEntity.location.z };
    particleAt(hitEntity.dimension, PARTICLES.estallido, c);
    particleAt(hitEntity.dimension, PARTICLES.bloqueo, c);
    particleAt(hitEntity.dimension, PARTICLES.onda, { x: c.x, y: hitEntity.location.y + 0.1, z: c.z });
    temblor(hitEntity.dimension, c, 4, 0.45, 0.35);
    if (hitEntity instanceof Player) {
      const dx = hitEntity.location.x - damagingEntity.location.x;
      const dz = hitEntity.location.z - damagingEntity.location.z;
      const d = Math.hypot(dx, dz) || 1;
      try {
        hitEntity.applyKnockback({ x: (dx / d) * 1.1, z: (dz / d) * 1.1 }, 0.45);
      } catch {
        // Sin empuje.
      }
    }
  });
});

// Escudo de energía: las flechas rebotan (vuelven a quien las tiró) y el resto del daño
// se reduce a la mitad mientras está activo.
world.beforeEvents.entityHurt.subscribe((event) => {
  const r = robots.get(event.hurtEntity.id);
  if (!r || now() > (r.escudoHasta ?? 0)) return;
  if (event.damageSource.cause === EntityDamageCause.projectile) {
    event.cancel = true;
    const tirador = event.damageSource.damagingEntity;
    const e = r.e;
    system.run(() => devolverFlecha(e, tirador));
    return;
  }
  event.damage = event.damage * 0.5;
}, { entityFilter: { type: ROBOT } });

function devolverFlecha(e, tirador) {
  if (!e.isValid) return;
  const o = { x: e.location.x, y: e.location.y + 3, z: e.location.z };
  particleAt(e.dimension, PARTICLES.escudoHex, o);
  sound(e, "random.anvil_land", 2, 0.4);
  if (!tirador?.isValid) return;
  try {
    const t = tirador.location;
    const dx = t.x - o.x;
    const dy = t.y + 1.2 - o.y;
    const dz = t.z - o.z;
    const d = Math.hypot(dx, dy, dz) || 1;
    const f = e.dimension.spawnEntity("minecraft:arrow", { x: o.x + (dx / d) * 2, y: o.y, z: o.z + (dz / d) * 2 });
    const proj = f.getComponent("minecraft:projectile");
    if (proj) {
      proj.owner = e;
      proj.shoot({ x: (dx / d) * 2.4, y: (dy / d) * 2.4 + d * 0.005, z: (dz / d) * 2.4 });
    }
  } catch {
    // Sin flecha.
  }
}

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
        const r = { e, pilotos: [], desde: now(), hasta: now() + 200, cd: { ataque: now() + 60 }, alarma: false, iq: 500, fase: 0 };
        robots.set(e.id, r);
      }
    } catch {
      // Dimensión sin cargar.
    }
  }
}, 200);
