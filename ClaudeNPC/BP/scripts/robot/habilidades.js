import { EntityDamageCause, GameMode, system } from "@minecraft/server";
import { ANIM, PARTICLES, PROP, PUNO } from "../config.js";
import { estados } from "../estado.js";
import { animate, blockAt, now, particleAt, reemplazable, sound, soundAt } from "../util.js";
import { pisoton } from "./armas.js";

// Habilidades nuevas del robot (se desbloquean con las fases de IQ, ver index.js):
//   Fase Turbo (IQ 700): salto aplastante, puño cohete y lluvia de tornillos.
//   Fase Genio (IQ 900): escudo de energía, láser giratorio e imán.
// Todas se anuncian (animación, sonido y marcas en el suelo) para poder esquivarlas.

function jugadores(dim, location, radio) {
  try {
    return dim.getPlayers({ location, maxDistance: radio, excludeGameModes: [GameMode.Creative, GameMode.Spectator] });
  } catch {
    return [];
  }
}

function herir(j, cantidad, robot, causa = EntityDamageCause.entityAttack) {
  try {
    j.applyDamage(cantidad, robot?.isValid ? { cause: causa, damagingEntity: robot } : { cause: causa });
  } catch {
    // Jugador no disponible.
  }
}

function empujar(j, desde, fuerza, alto) {
  const dx = j.location.x - desde.x;
  const dz = j.location.z - desde.z;
  const d = Math.hypot(dx, dz) || 1;
  try {
    j.applyKnockback({ x: (dx / d) * fuerza, z: (dz / d) * fuerza }, alto);
  } catch {
    // Sin empuje.
  }
}

// Sacude la cámara de los jugadores cercanos (un pisotón de robot se siente).
export function temblor(dim, pos, radio, fuerza = 0.3, segundos = 0.4) {
  try {
    dim.runCommand(`camerashake add @a[x=${pos.x.toFixed(1)},y=${pos.y.toFixed(1)},z=${pos.z.toFixed(1)},r=${radio}] ${fuerza} ${segundos} positional`);
  } catch {
    // Sin temblor.
  }
}

function anillo(dim, c, radio, id, puntos = 12) {
  for (let i = 0; i < puntos; i++) {
    const a = (i / puntos) * Math.PI * 2;
    particleAt(dim, id, { x: c.x + Math.cos(a) * radio, y: c.y + 0.15, z: c.z + Math.sin(a) * radio });
  }
}

// --- Salto aplastante -------------------------------------------------------------------
// Marca con anillos rojos dónde vas a estar, se agacha, salta muy alto y cae encima.
export function saltoAplastante(r, jugador) {
  const e = r.e;
  const dim = e.dimension;
  r.quietoHasta = now() + 46; // no camina mientras se agacha y salta
  const v = jugador.getVelocity();
  const destino = { x: jugador.location.x + v.x * 18, y: jugador.location.y, z: jugador.location.z + v.z * 18 };
  animate(e, ANIM.robotAgacharse);
  sound(e, "random.anvil_use", 0.5, 1);
  for (let t = 0; t <= 40; t += 5) system.runTimeout(() => {
    for (const rad of [1.2, 2.4, 3.6]) anillo(dim, destino, rad, PARTICLES.aviso, 10);
  }, t);
  const pilotos = r.pilotos.map((n) => estados.get(n.id)).filter((s) => !!s);
  for (const s of pilotos) s.sinCaidaHasta = now() + 120;
  let desde;
  let t = 0;
  const id = system.runInterval(() => {
    t++;
    try {
      if (!e.isValid) return system.clearRun(id);
      if (t === 16) {
        desde = { ...e.location };
        animate(e, ANIM.robotSalto);
        sound(e, "mob.irongolem.throw", 0.5, 1);
        particleAt(dim, PARTICLES.onda, { x: desde.x, y: desde.y + 0.1, z: desde.z });
      }
      if (t > 16 && t <= 42) {
        const f = (t - 16) / 26;
        const pos = {
          x: desde.x + (destino.x - desde.x) * f,
          y: desde.y + (destino.y - desde.y) * f + Math.sin(f * Math.PI) * 9,
          z: desde.z + (destino.z - desde.z) * f,
        };
        e.teleport(pos, { keepVelocity: false, facingLocation: { x: destino.x, y: pos.y, z: destino.z } });
        if (t % 2 === 0) particleAt(dim, PARTICLES.cohete, { x: pos.x, y: pos.y + 0.2, z: pos.z });
      }
      if (t === 42) {
        system.clearRun(id);
        const c = e.location;
        soundAt(dim, c, "random.explode", 0.6, 1);
        particleAt(dim, PARTICLES.estallido, { x: c.x, y: c.y + 0.5, z: c.z });
        anillo(dim, c, 1.5, PARTICLES.polvo, 10);
        anillo(dim, c, 3, PARTICLES.ondaChispa, 18);
        particleAt(dim, PARTICLES.onda, { x: c.x, y: c.y + 0.1, z: c.z });
        temblor(dim, c, 20, 0.6, 0.6);
        for (const j of jugadores(dim, c, 5)) {
          const d = Math.hypot(j.location.x - c.x, j.location.z - c.z);
          herir(j, Math.max(3, Math.round(10 * (1 - d / 6))), e);
          empujar(j, c, 1.1, 0.6);
        }
      }
    } catch {
      system.clearRun(id);
    }
  }, 1);
  return 64;
}

// --- Puño cohete -------------------------------------------------------------------------
// El antebrazo izquierdo sale volando hacia ti (girando y echando fuego), te golpea y
// vuelve a su sitio.
const punos = new Map();

function salidaPuno(robot) {
  const v = robot.getViewDirection();
  const h = Math.hypot(v.x, v.z) || 1;
  const f = { x: v.x / h, z: v.z / h };
  const izq = { x: f.z, z: -f.x }; // la izquierda del robot
  return { x: robot.location.x + f.x * 2.2 + izq.x * 1.3, y: robot.location.y + 3.6, z: robot.location.z + f.z * 2.2 + izq.z * 1.3 };
}

export function punoCohete(r, jugador) {
  const e = r.e;
  if ([...punos.values()].some((x) => x.robot === e)) return 20;
  animate(e, ANIM.robotPuno);
  sound(e, "random.anvil_use", 0.9, 1);
  system.runTimeout(() => {
    if (!e.isValid || !jugador.isValid) return;
    const pos = salidaPuno(e);
    try {
      const p = e.dimension.spawnEntity(PUNO, pos);
      e.setProperty(PROP.sinPuno, true);
      punos.set(p.id, { p, robot: e, jugador, pos, vel: 0.95, fase: "ida", vida: 60 });
      soundAt(e.dimension, pos, "firework.launch", 0.6, 1);
      particleAt(e.dimension, PARTICLES.fogonazo, pos);
    } catch {
      // Sin puño.
    }
  }, 6);
  return 70;
}

function terminarPuno(x) {
  punos.delete(x.p.id);
  try {
    if (x.p.isValid) x.p.remove();
  } catch {
    // Ya no está.
  }
  try {
    if (x.robot.isValid) {
      x.robot.setProperty(PROP.sinPuno, false);
      sound(x.robot, "random.anvil_use", 1.4, 0.8);
    }
  } catch {
    // Robot no disponible.
  }
}

system.runInterval(() => {
  for (const x of [...punos.values()]) {
    if (!x.p.isValid) {
      terminarPuno(x);
      continue;
    }
    try {
      x.vida--;
      const meta = x.fase === "ida" && x.jugador.isValid
        ? { x: x.jugador.location.x, y: x.jugador.location.y + 1, z: x.jugador.location.z }
        : x.robot.isValid ? salidaPuno(x.robot) : x.pos;
      const dx = meta.x - x.pos.x;
      const dy = meta.y - x.pos.y;
      const dz = meta.z - x.pos.z;
      const d = Math.hypot(dx, dy, dz) || 1;
      if (x.fase === "ida") {
        if (d < 1.6 && x.jugador.isValid) {
          herir(x.jugador, 8, x.robot);
          empujar(x.jugador, x.pos, 1.6, 0.5);
          particleAt(x.p.dimension, PARTICLES.estallido, x.pos);
          soundAt(x.p.dimension, x.pos, "random.explode", 1.2, 0.8);
          temblor(x.p.dimension, x.pos, 6, 0.5, 0.4);
          x.fase = "vuelta";
          continue;
        }
        const b = blockAt(x.p.dimension, x.pos);
        if (x.vida <= 0 || (b && !reemplazable(b) && !b.isLiquid)) {
          particleAt(x.p.dimension, PARTICLES.estallido, x.pos);
          x.fase = "vuelta";
          continue;
        }
      } else if (d < 1.2 || x.vida < -80 || !x.robot.isValid) {
        terminarPuno(x);
        continue;
      }
      const paso = Math.min(d, x.fase === "ida" ? 0.95 : 1.15);
      x.pos = { x: x.pos.x + (dx / d) * paso, y: x.pos.y + (dy / d) * paso, z: x.pos.z + (dz / d) * paso };
      x.p.teleport(x.pos, { facingLocation: meta });
    } catch {
      terminarPuno(x);
    }
  }
}, 1);

export function limpiarPunos(robotId) {
  for (const x of [...punos.values()]) if (x.robot?.id === robotId) terminarPuno(x);
}

// --- Lluvia de tornillos ------------------------------------------------------------------
// Dispara tornillos al cielo; caen sobre marcas rojas alrededor tuyo.
export function lluviaTornillos(r, jugador) {
  const e = r.e;
  const dim = e.dimension;
  animate(e, ANIM.robotMisiles);
  sound(e, "random.anvil_use", 1.2, 1);
  for (let k = 0; k < 6; k++) system.runTimeout(() => e.isValid && particleAt(dim, PARTICLES.tornillo, { x: e.location.x, y: e.location.y + 5, z: e.location.z }), k * 2);
  const c = { ...jugador.location };
  const marcas = [{ x: c.x, y: c.y, z: c.z }];
  for (let i = 0; i < 11; i++) {
    const a = Math.random() * Math.PI * 2;
    const rad = 1.5 + Math.random() * 4.5;
    marcas.push({ x: c.x + Math.cos(a) * rad, y: c.y, z: c.z + Math.sin(a) * rad });
  }
  for (let t = 0; t <= 24; t += 6) system.runTimeout(() => {
    for (const m of marcas) anillo(dim, m, 0.7, PARTICLES.aviso, 6);
  }, t);
  marcas.forEach((m, i) => {
    system.runTimeout(() => particleAt(dim, PARTICLES.tornillo, { x: m.x, y: m.y + 7, z: m.z }), 24 + i * 2);
    system.runTimeout(() => {
      particleAt(dim, PARTICLES.estallido, { x: m.x, y: m.y + 0.3, z: m.z });
      particleAt(dim, PARTICLES.polvo, { x: m.x, y: m.y + 0.3, z: m.z });
      soundAt(dim, m, "random.anvil_land", 1.8 + Math.random() * 0.3, 0.35);
      for (const j of jugadores(dim, m, 1.6)) {
        herir(j, 4, e);
        empujar(j, m, 0.4, 0.3);
      }
    }, 24 + i * 2 + 9);
  });
  return 60;
}

// --- Escudo de energía -------------------------------------------------------------------
// Cúpula de hexágonos cian durante 6 s: devuelve las flechas y aguanta la mitad del daño.
export function escudoEnergia(r) {
  const e = r.e;
  r.escudoHasta = now() + 120;
  animate(e, ANIM.robotEscudo);
  sound(e, "beacon.activate", 1.4, 1);
  let t = 0;
  const id = system.runInterval(() => {
    t += 3;
    if (!e.isValid || now() > r.escudoHasta) return system.clearRun(id);
    const c = { x: e.location.x, y: e.location.y + 2.4, z: e.location.z };
    for (let i = 0; i < 14; i++) {
      const k = (i + t * 0.37) % 14;
      const y = 1 - (2 * (k + 0.5)) / 14;
      const rad = Math.sqrt(1 - y * y);
      const a = k * 2.399963 + t * 0.05;
      particleAt(e.dimension, PARTICLES.escudoHex, { x: c.x + Math.cos(a) * rad * 3.2, y: c.y + y * 3.2, z: c.z + Math.sin(a) * rad * 3.2 });
    }
    if (t % 30 === 0) sound(e, "beacon.ambient", 1.6, 0.6);
  }, 3);
  return 24;
}

// --- Láser giratorio -----------------------------------------------------------------------
// Abre los brazos y un anillo láser sale de la cadera, a la altura de las rodillas, y da
// una vuelta entera: hay que saltarlo.
export function laserGiratorio(r, jugador) {
  const e = r.e;
  const dim = e.dimension;
  const inicio = Math.atan2(jugador.location.z - e.location.z, jugador.location.x - e.location.x) + Math.PI;
  sound(e, "beacon.activate", 1.8, 1);
  const golpeado = new Map();
  let t = 0;
  const id = system.runInterval(() => {
    t++;
    try {
      if (!e.isValid || t > 76) return system.clearRun(id);
      const c = { x: e.location.x, y: e.location.y + 0.9, z: e.location.z };
      if (t < 16) {
        if (t % 2 === 0) particleAt(dim, PARTICLES.carga, { x: c.x, y: c.y + 0.3, z: c.z });
        return;
      }
      if (t === 16) animate(e, ANIM.robotGiro);
      const ang = inicio + ((t - 16) / 60) * Math.PI * 2;
      const dir = { x: Math.cos(ang), y: 0, z: Math.sin(ang) };
      const choque = dim.getBlockFromRay(c, dir, { maxDistance: 14 });
      const largo = choque ? Math.min(14, Math.hypot(choque.block.location.x + 0.5 - c.x, choque.block.location.z + 0.5 - c.z)) : 14;
      if (t % 2 === 0) {
        for (let k = 1.4; k < largo; k += 0.9) particleAt(dim, PARTICLES.laser, { x: c.x + dir.x * k, y: c.y, z: c.z + dir.z * k });
        if (choque) particleAt(dim, PARTICLES.estallido, { x: c.x + dir.x * largo, y: c.y, z: c.z + dir.z * largo });
      }
      if (t % 6 === 0) sound(e, "random.fizz", 1.7, 0.5);
      for (const j of jugadores(dim, c, 15)) {
        const dx = j.location.x - c.x;
        const dz = j.location.z - c.z;
        const d = Math.hypot(dx, dz);
        if (d > largo || d < 1) continue;
        let diff = Math.atan2(dz, dx) - ang;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        if (Math.abs(diff) > 0.14 || j.location.y > c.y + 0.35) continue; // saltando lo esquiva
        if (now() < (golpeado.get(j.id) ?? 0)) continue;
        golpeado.set(j.id, now() + 10);
        herir(j, 4, e, EntityDamageCause.fire);
        try {
          j.setOnFire(2, true);
        } catch {
          // Sin fuego.
        }
      }
    } catch {
      system.clearRun(id);
    }
  }, 1);
  return 86;
}

// --- Imán ---------------------------------------------------------------------------------
// Levanta los brazos y te atrae hacia él con un campo magnético... y luego pisotea.
export function iman(r, jugador) {
  const e = r.e;
  const dim = e.dimension;
  animate(e, ANIM.robotIman);
  sound(e, "beacon.activate", 0.6, 1);
  let t = 0;
  const id = system.runInterval(() => {
    t += 2;
    try {
      if (!e.isValid || t > 38) {
        system.clearRun(id);
        if (e.isValid) pisoton(e);
        return;
      }
      const c = { x: e.location.x, y: e.location.y + 2.5, z: e.location.z };
      for (const j of jugadores(dim, c, 18)) {
        const dx = c.x - j.location.x;
        const dz = c.z - j.location.z;
        const d = Math.hypot(dx, dz) || 1;
        if (d < 3) continue;
        try {
          j.applyKnockback({ x: (dx / d) * 0.32, z: (dz / d) * 0.32 }, 0.04);
        } catch {
          // Sin empuje.
        }
        if (t % 4 === 0) {
          for (let k = 1; k <= 5; k++) {
            const f = k / 6;
            particleAt(dim, PARTICLES.chispaElectrica, { x: j.location.x + dx * f, y: j.location.y + 1 + (c.y - j.location.y - 1) * f, z: j.location.z + dz * f });
          }
        }
      }
      if (t % 8 === 0) sound(e, "beacon.ambient", 0.5, 0.8);
    } catch {
      system.clearRun(id);
    }
  }, 2);
  return 84;
}
