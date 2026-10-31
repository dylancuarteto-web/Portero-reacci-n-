import { EntityDamageCause, GameMode, system } from "@minecraft/server";
import { ANIM, MISIL, PARTICLES } from "../config.js";
import { animate, blockAt, particleAt, reemplazable, sound, soundAt } from "../util.js";

// Armas del robot: misiles teledirigidos desde los hombros, láser del visor que barre
// el suelo, metralla de flechas desde el brazo y pisotón con onda expansiva. Todas se
// anuncian (animación y sonido) para que se puedan esquivar.

const misiles = new Map();

function jugadores(dimension, location, radio) {
  try {
    return dimension.getPlayers({ location, maxDistance: radio, excludeGameModes: [GameMode.Creative, GameMode.Spectator] });
  } catch {
    return [];
  }
}

function herir(jugador, cantidad, robot, causa = EntityDamageCause.entityExplosion) {
  try {
    jugador.applyDamage(cantidad, robot?.isValid ? { cause: causa, damagingEntity: robot } : { cause: causa });
  } catch {
    // Jugador no disponible.
  }
}

// Ejes del robot: delante (hacia donde mira) y a un lado.
function ejes(robot) {
  const v = robot.getViewDirection();
  const h = Math.hypot(v.x, v.z) || 1;
  const delante = { x: v.x / h, z: v.z / h };
  return { delante, lado: { x: -delante.z, z: delante.x } };
}

function punto(robot, adelante, lado, alto) {
  const { delante, lado: l } = ejes(robot);
  return {
    x: robot.location.x + delante.x * adelante + l.x * lado,
    y: robot.location.y + alto,
    z: robot.location.z + delante.z * adelante + l.z * lado,
  };
}

function explotar(dimension, pos, robot, dano = 6, radio = 2.8) {
  particleAt(dimension, PARTICLES.estallido, pos);
  particleAt(dimension, "minecraft:huge_explosion_emitter", pos);
  particleAt(dimension, PARTICLES.construir, pos);
  soundAt(dimension, pos, "random.explode", 1, 1);
  for (const j of jugadores(dimension, pos, radio)) {
    const dx = j.location.x - pos.x;
    const dz = j.location.z - pos.z;
    const d = Math.hypot(dx, dz) || 1;
    herir(j, Math.max(2, Math.round(dano * (1 - d / (radio + 1)))), robot);
    try {
      j.applyKnockback({ x: (dx / d) * 0.7, z: (dz / d) * 0.7 }, 0.45);
    } catch {
      // Sin empuje.
    }
  }
}

// Misiles: salen hacia arriba desde los lanzadores de los hombros y giran despacio
// hacia el jugador; corriendo de lado se pueden esquivar.
export function lanzarMisiles(robot, jugador, cantidad = 6) {
  animate(robot, ANIM.robotMisiles);
  sound(robot, "random.anvil_use", 0.6, 0.7);
  for (let i = 0; i < cantidad; i++) {
    system.runTimeout(() => {
      if (!robot.isValid || !jugador.isValid) return;
      const lado = i % 2 ? 1.3 : -1.3;
      const salida = punto(robot, 0.5, lado, 4.6);
      try {
        const m = robot.dimension.spawnEntity(MISIL, salida);
        const { delante } = ejes(robot);
        misiles.set(m.id, { m, pos: { ...salida }, vel: { x: delante.x * 0.15, y: 0.45, z: delante.z * 0.15 }, jugador, robot, vida: 140 });
        sound(m, "firework.launch", 0.8, 1);
      } catch {
        // Sin misil.
      }
    }, 10 + i * 6);
  }
  return 10 + cantidad * 6 + 10;
}

system.runInterval(() => {
  for (const [id, x] of misiles) {
    const { m } = x;
    if (!m.isValid) {
      misiles.delete(id);
      continue;
    }
    try {
      x.vida--;
      const j = x.jugador;
      if (j.isValid && x.vida < 132) {
        const meta = { x: j.location.x, y: j.location.y + 1, z: j.location.z };
        const dx = meta.x - x.pos.x;
        const dy = meta.y - x.pos.y;
        const dz = meta.z - x.pos.z;
        const d = Math.hypot(dx, dy, dz) || 1;
        x.vel.x += ((dx / d) * 0.55 - x.vel.x) * 0.1;
        x.vel.y += ((dy / d) * 0.55 - x.vel.y) * 0.1;
        x.vel.z += ((dz / d) * 0.55 - x.vel.z) * 0.1;
        if (d < 1.3) {
          misiles.delete(id);
          explotar(m.dimension, x.pos, x.robot);
          m.remove();
          continue;
        }
      }
      x.pos = { x: x.pos.x + x.vel.x, y: x.pos.y + x.vel.y, z: x.pos.z + x.vel.z };
      const b = blockAt(m.dimension, x.pos);
      if (x.vida <= 0 || (b && !reemplazable(b) && !b.isLiquid && x.vida < 134)) {
        misiles.delete(id);
        explotar(m.dimension, x.pos, x.robot);
        m.remove();
        continue;
      }
      m.teleport(x.pos, { facingLocation: { x: x.pos.x + x.vel.x, y: x.pos.y + x.vel.y, z: x.pos.z + x.vel.z } });
    } catch {
      misiles.delete(id);
      try {
        m.remove();
      } catch {
        // Ya no existe.
      }
    }
  }
}, 1);

// Distancia de un punto a un segmento (para saber si el láser te alcanza).
function distSegmento(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const l2 = abx * abx + aby * aby + abz * abz || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / l2));
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t), p.z - (a.z + abz * t));
}

// Láser del visor: se carga un segundo y barre hacia donde estás (con retraso).
export function laser(robot, jugador) {
  animate(robot, ANIM.robotLaser);
  sound(robot, "beacon.activate", 1.6, 1);
  const dim = robot.dimension;
  let mira = { ...jugador.location };
  let t = 0;
  const id = system.runInterval(() => {
    t++;
    try {
      if (!robot.isValid || !jugador.isValid || t > 60) {
        system.clearRun(id);
        return;
      }
      const ojo = punto(robot, 0.75, 0, 3.85);
      if (t < 20) {
        if (t % 2 === 0) particleAt(dim, PARTICLES.carga, ojo);
        return;
      }
      const j = { x: jugador.location.x, y: jugador.location.y + 1, z: jugador.location.z };
      mira = { x: mira.x + (j.x - mira.x) * 0.12, y: mira.y + (j.y - mira.y) * 0.12, z: mira.z + (j.z - mira.z) * 0.12 };
      const dx = mira.x - ojo.x;
      const dy = mira.y - ojo.y;
      const dz = mira.z - ojo.z;
      let largo = Math.hypot(dx, dy, dz) || 1;
      const dir = { x: dx / largo, y: dy / largo, z: dz / largo };
      const choque = dim.getBlockFromRay(ojo, dir, { maxDistance: 32 });
      largo = choque ? Math.min(32, Math.hypot(choque.block.location.x + 0.5 - ojo.x, choque.block.location.y + 0.5 - ojo.y, choque.block.location.z + 0.5 - ojo.z)) : 32;
      const fin = { x: ojo.x + dir.x * largo, y: ojo.y + dir.y * largo, z: ojo.z + dir.z * largo };
      for (let k = 0; k < largo; k += 0.7) particleAt(dim, PARTICLES.laser, { x: ojo.x + dir.x * k, y: ojo.y + dir.y * k, z: ojo.z + dir.z * k });
      if (t % 4 === 0) particleAt(dim, PARTICLES.estallido, fin);
      if (t % 5 === 0) {
        sound(robot, "random.fizz", 1.6, 0.5);
        for (const p of jugadores(dim, robot.location, 34)) {
          const centro = { x: p.location.x, y: p.location.y + 1, z: p.location.z };
          if (distSegmento(centro, ojo, fin) < 0.9) {
            herir(p, 3, robot, EntityDamageCause.fire);
            try {
              p.setOnFire(2, true);
            } catch {
              // Sin fuego.
            }
          }
        }
      }
    } catch {
      system.clearRun(id);
    }
  }, 1);
  return 64;
}

// Metralla: ráfaga de flechas desde el brazo, con algo de dispersión.
export function metralla(robot, jugador) {
  animate(robot, ANIM.robotMetralla);
  for (let i = 0; i < 14; i++) {
    system.runTimeout(() => {
      if (!robot.isValid || !jugador.isValid) return;
      try {
        const o = punto(robot, 1.2, -1.4, 2.7);
        const j = jugador.getHeadLocation();
        const dx = j.x - o.x + (Math.random() - 0.5) * 1.2;
        const dy = j.y - 0.4 - o.y + (Math.random() - 0.5) * 0.8;
        const dz = j.z - o.z + (Math.random() - 0.5) * 1.2;
        const l = Math.hypot(dx, dy, dz) || 1;
        const flecha = robot.dimension.spawnEntity("minecraft:arrow", { x: o.x + (dx / l) * 0.6, y: o.y, z: o.z + (dz / l) * 0.6 });
        const proj = flecha.getComponent("minecraft:projectile");
        if (proj) {
          proj.owner = robot;
          proj.shoot({ x: (dx / l) * 2.6, y: (dy / l) * 2.6 + 0.05, z: (dz / l) * 2.6 });
        }
        sound(robot, "random.bow", 1.8, 0.6);
        particleAt(robot.dimension, PARTICLES.bloqueo, o);
      } catch {
        // Sin flecha.
      }
    }, 12 + i * 3);
  }
  return 12 + 14 * 3 + 6;
}

// Pisotón: levanta la pierna y golpea el suelo; sale una onda que hay que saltar.
export function pisoton(robot) {
  animate(robot, ANIM.robotPisoton);
  const dim = robot.dimension;
  system.runTimeout(() => {
    if (!robot.isValid) return;
    const c = { ...robot.location };
    soundAt(dim, c, "random.explode", 0.6, 1);
    particleAt(dim, PARTICLES.onda, { x: c.x, y: c.y + 0.1, z: c.z });
    const golpeados = new Set();
    let r = 1.5;
    const id = system.runInterval(() => {
      r += 0.6;
      if (r > 10) {
        system.clearRun(id);
        return;
      }
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        particleAt(dim, PARTICLES.ondaChispa, { x: c.x + Math.cos(a) * r, y: c.y + 0.2, z: c.z + Math.sin(a) * r });
      }
      for (const j of jugadores(dim, c, r + 1)) {
        if (golpeados.has(j.id) || !j.isOnGround) continue;
        const d = Math.hypot(j.location.x - c.x, j.location.z - c.z);
        if (d < r - 0.9 || d > r + 0.4 || Math.abs(j.location.y - c.y) > 1.5) continue;
        golpeados.add(j.id);
        herir(j, 6, robot, EntityDamageCause.entityAttack);
        try {
          j.applyKnockback({ x: ((j.location.x - c.x) / (d || 1)) * 0.6, z: ((j.location.z - c.z) / (d || 1)) * 0.6 }, 0.6);
        } catch {
          // Sin empuje.
        }
      }
    }, 1);
  }, 16);
  return 40;
}

export function explosionFinal(robot) {
  const dim = robot.dimension;
  const c = { x: robot.location.x, y: robot.location.y + 2.5, z: robot.location.z };
  explotar(dim, c, robot, 8, 6);
  for (let k = 0; k < 6; k++) {
    system.runTimeout(() => {
      particleAt(dim, "minecraft:huge_explosion_emitter", { x: c.x + (Math.random() - 0.5) * 4, y: c.y + (Math.random() - 0.5) * 3, z: c.z + (Math.random() - 0.5) * 4 });
      soundAt(dim, c, "random.explode", 0.8 + Math.random() * 0.4, 0.8);
    }, k * 4);
  }
}

export function limpiarMisiles(robotId) {
  for (const [id, x] of misiles) {
    if (x.robot?.id !== robotId) continue;
    misiles.delete(id);
    try {
      if (x.m.isValid) x.m.remove();
    } catch {
      // Ya no existe.
    }
  }
}

