// LA SERPIENTE LEGENDARIA: fases, ataques especiales, esbirros, muerte e invocación.
import { world, system, Difficulty, GameMode } from "@minecraft/server";
import { CONFIG, TPS } from "../config.js";
import { addTask } from "../core/scheduler.js";
import { getState, flash } from "../core/state.js";
import { particle, sound, anim, ringOf, spawnFx, removeFx, playerSound, effect } from "../core/fx.js";
import { hurt, pushAway, isAlive } from "../core/targets.js";
import { add, sub, mul, norm, flat, up, dist } from "../core/vec.js";

export const BOSS = "lacobra:serpiente_legendaria";
const MINION = "lacobra:serpiente_esbirro";
const cfg = CONFIG.jefe;

/** id -> { entity, nextAttack, attackIndex } */
const bosses = new Map();

export function trackBoss(e) {
  if (!e || e.typeId !== BOSS || bosses.has(e.id)) return;
  bosses.set(e.id, { entity: e, nextAttack: system.currentTick + 5 * TPS, attackIndex: 0 });
}

export function bossCount() {
  return bosses.size;
}

function phaseOf(e) {
  try {
    return /** @type {number} */ (e.getProperty("lacobra:fase")) ?? 1;
  } catch {
    return 1;
  }
}

function nearbyPlayers(e, radius) {
  try {
    return e.dimension
      .getPlayers({ location: e.location, maxDistance: radius })
      .filter((p) => {
        const gm = p.getGameMode();
        return gm !== GameMode.Creative && gm !== GameMode.Spectator && isAlive(p);
      });
  } catch {
    return [];
  }
}

function announce(e, title, subtitle) {
  for (const p of e.dimension.getPlayers({ location: e.location, maxDistance: 64 })) {
    try {
      p.onScreenDisplay.setTitle(title, { subtitle, fadeInDuration: 5, stayDuration: 40, fadeOutDuration: 10 });
    } catch {
      // ignorado
    }
  }
}

/** Cambio de fase según la vida restante. */
export function onBossHurt(e) {
  trackBoss(e);
  let ratio = 1;
  try {
    const h = e.getComponent("minecraft:health");
    ratio = h.currentValue / h.effectiveMax;
  } catch {
    return;
  }
  const phase = phaseOf(e);
  let next = phase;
  if (phase < 3 && ratio <= 0.33) next = 3;
  else if (phase < 2 && ratio <= 0.66) next = 2;
  if (next === phase) return;
  try {
    e.triggerEvent(next === 2 ? "lacobra:a_fase2" : "lacobra:a_fase3");
  } catch {
    return;
  }
  anim(e, "animation.lacobra.boss.roar");
  sound(e.dimension, "jefe_rugido", e.location, 2);
  particle(e.dimension, "shockwave", up(e.location, 0.3), { radius: 10 });
  particle(e.dimension, "dark_smoke", up(e.location, 2));
  particle(e.dimension, "violet_flash", up(e.location, 3));
  announce(e, next === 2 ? "§5§lFASE 2" : "§6§lFASE 3", next === 2 ? "§dLa serpiente llama a sus crías" : "§eLa furia legendaria despierta");
  const rec = bosses.get(e.id);
  if (rec) rec.nextAttack = system.currentTick + 2 * TPS;
}

/** Impacto del escupitajo venenoso del jefe (daño decidido en el servidor). */
export function spitImpact(location, dim, hitEntity, owner) {
  particle(dim, "venom_splash", up(location, 0.2));
  sound(dim, "veneno_golpe", location, 0.8);
  if (hitEntity && hitEntity.typeId === "minecraft:player" && isAlive(hitEntity)) {
    // los Guantes del GOAT también atajan el escupitajo
    const s = getState(/** @type {import("@minecraft/server").Player} */ (hitEntity));
    if (s.atajadaUntil > system.currentTick) return;
    const dmg = s.hasGloves ? cfg.danioEscupitajo * (1 - CONFIG.objetos.guantes.reduccionProyectiles) : cfg.danioEscupitajo;
    hurt(hitEntity, dmg, owner?.isValid ? owner : undefined);
    effect(hitEntity, "slowness", 4, 1);
  }
}

export function onBossBite(e) {
  anim(e, "animation.lacobra.boss.bite", 0.1);
  sound(e.dimension, "jefe_mordida", e.location);
}

// ---------------------------------------------------------------- ataques especiales
function spit(e, target, spread) {
  const head = up(e.location, 3.2);
  const dir = norm(sub(up(target.location, 1), head));
  for (let i = -spread; i <= spread; i++) {
    const side = { x: -dir.z, y: 0, z: dir.x };
    const d = norm(add(dir, mul(side, i * 0.18)));
    try {
      const p = e.dimension.spawnEntity("lacobra:escupitajo", add(head, mul(d, 1.6)));
      const pc = p.getComponent("minecraft:projectile");
      if (pc) {
        pc.owner = e;
        pc.shoot(mul(d, 1.3));
      } else {
        p.remove();
      }
    } catch {
      // ignorado
    }
  }
  sound(e.dimension, "jefe_siseo", head, 1.5);
  particle(e.dimension, "venom_splash", head);
}

function summonMinions(e) {
  let alive = 0;
  try {
    alive = e.dimension.getEntities({ type: MINION, location: e.location, maxDistance: 32 }).length;
  } catch {
    alive = cfg.maxEsbirros;
  }
  const n = Math.min(2, cfg.maxEsbirros - alive);
  if (n <= 0) return false;
  for (let i = 0; i < n; i++) {
    const loc = add(e.location, { x: (i ? 2.5 : -2.5), y: 0.2, z: 1.5 });
    particle(e.dimension, "dark_smoke", loc);
    particle(e.dimension, "violet_flash", up(loc, 0.5));
    try {
      e.dimension.spawnEntity(MINION, loc);
    } catch {
      // ignorado
    }
  }
  sound(e.dimension, "esbirro_siseo", e.location, 1.5);
  return true;
}

function wave(e) {
  const c = up(e.location, 0.3);
  sound(e.dimension, "onda", c, 1.6);
  particle(e.dimension, "shockwave", c, { radius: cfg.radioOnda * 2 });
  particle(e.dimension, "energy_ring", c, { radius: cfg.radioOnda * 0.6 });
  ringOf(e.dimension, "energy_beam", c, cfg.radioOnda * 0.6, 6);
  for (const p of nearbyPlayers(e, cfg.radioOnda)) {
    hurt(p, cfg.danioOnda, e);
    pushAway(p, c, 1.6, 0.55);
  }
}

/** Telegrafía un rayo sobre la posición del jugador y lo descarga 1 s después. */
function venomStrike(e, targets) {
  for (const p of targets.slice(0, 3)) {
    const spot = { ...p.location };
    particle(e.dimension, "rune_rise", up(spot, 0.1), { radius: 1.2 });
    particle(e.dimension, "energy_ring", up(spot, 0.1), { radius: 1.2 });
    addTask({
      name: "jefe-rayo",
      tick(age) {
        if (age < 20) return true;
        particle(e.dimension, "energy_beam", spot);
        particle(e.dimension, "venom_splash", up(spot, 0.3));
        sound(e.dimension, "guardian_zap", spot, 1.2, 0.6);
        if (p.isValid && dist(p.location, spot) < 2) hurt(p, cfg.danioRayo, e.isValid ? e : undefined);
        return false;
      },
    });
  }
}

function special(e, rec) {
  const phase = phaseOf(e);
  const players = nearbyPlayers(e, cfg.radioJugadores);
  if (players.length === 0) return;
  const target = players.sort((a, b) => dist(a.location, e.location) - dist(b.location, e.location))[0];
  anim(e, "animation.lacobra.boss.special");
  const i = rec.attackIndex++;
  if (phase === 1) {
    if (i % 2 === 0) spit(e, target, 0);
    else {
      // embestida: salto hacia el jugador
      const d = flat(sub(target.location, e.location));
      try {
        e.applyImpulse({ x: d.x * 1.2, y: 0.55, z: d.z * 1.2 });
      } catch {
        // ignorado
      }
      sound(e.dimension, "jefe_siseo", e.location, 1.5);
      addTask({ name: "jefe-aterrizaje", tick: (age) => (age < 16 ? true : (e.isValid && wave(e), false)) });
    }
  } else if (phase === 2) {
    if (i % 3 === 0) summonMinions(e) || spit(e, target, 1);
    else if (i % 3 === 1) spit(e, target, 1);
    else wave(e);
  } else {
    const k = i % 4;
    if (k === 0) wave(e);
    else if (k === 1) venomStrike(e, players);
    else if (k === 2) spit(e, target, 2);
    else summonMinions(e) || venomStrike(e, players);
  }
}

/** Bucle del jefe (cada 10 ticks). */
export function bossTick(tick) {
  for (const [id, rec] of bosses) {
    const e = rec.entity;
    if (!e.isValid) {
      bosses.delete(id);
      continue;
    }
    if (!isAlive(e)) continue;
    const phase = phaseOf(e);
    if (phase === 3 && tick % 40 === 0) particle(e.dimension, "dark_smoke", up(e.location, 2));
    if (tick >= rec.nextAttack) {
      rec.nextAttack = tick + cfg.intervaloAtaque[phase] * TPS;
      special(e, rec);
    }
  }
}

export function onBossDeath(e) {
  bosses.delete(e.id);
  const d = e.dimension;
  const c = up(e.location, 1);
  sound(d, "impacto", c, 2);
  particle(d, "shockwave", c, { radius: 20 });
  particle(d, "impact_burst", up(c, 1));
  particle(d, "supreme_pillar", e.location);
  ringOf(d, "dark_smoke", c, 2, 6, 0.5);
  ringOf(d, "gold_spark", c, 3, 6, 1);
  announce(e, "§6§l¡VICTORIA!", "§eLa Serpiente Legendaria ha caído");
  try {
    for (const m of d.getEntities({ type: MINION, location: e.location, maxDistance: 40 })) {
      particle(d, "fade_dust", m.location);
      m.remove();
    }
  } catch {
    // ignorado
  }
}

// ---------------------------------------------------------------- invocación
export const idoloComponent = {
  onUse(ev) {
    summonBoss(ev.source, true);
  },
};

/**
 * Ritual de invocación (3 s). Consume el Ídolo salvo en creativo o por comando.
 * @param {import("@minecraft/server").Player} player
 */
export function summonBoss(player, consume) {
  const s = getState(player);
  if (world.getDifficulty() === Difficulty.Peaceful) {
    flash(s, "§cLa Serpiente Legendaria no aparece en dificultad Pacífica", 3);
    playerSound(player, "sin_energia");
    return false;
  }
  try {
    const near = player.dimension.getEntities({ type: BOSS, location: player.location, maxDistance: cfg.distanciaInvocacion });
    if (near.length > 0) {
      flash(s, "§cYa hay una Serpiente Legendaria cerca", 3);
      playerSound(player, "sin_energia");
      return false;
    }
  } catch {
    return false;
  }
  if (consume) {
    try {
      if (player.getGameMode() !== GameMode.Creative) {
        const inv = player.getComponent("minecraft:inventory").container;
        const slot = player.selectedSlotIndex;
        const it = inv.getItem(slot);
        if (it?.typeId !== "lacobra:idolo_serpiente") return false;
        if (it.amount > 1) {
          it.amount -= 1;
          inv.setItem(slot, it);
        } else inv.setItem(slot, undefined);
      }
    } catch {
      return false;
    }
  }
  const dim = player.dimension;
  const dir = flat(player.getViewDirection());
  const spot = add(player.location, mul(dir, 6));
  const circle = spawnFx(dim, "lacobra:circulo_magico", up(spot, 0.05), "ritual");
  try {
    circle?.triggerEvent("lacobra:grande");
  } catch {
    // ignorado
  }
  sound(dim, "invocacion", spot, 2);
  flash(s, "§5El ritual ha comenzado...", 3);
  addTask({
    name: "invocacion",
    every: 2,
    tick(age) {
      if (age % 10 === 0) particle(dim, "rune_rise", up(spot, 0.1), { radius: 3 });
      if (age % 6 === 0) particle(dim, "charge_in", up(spot, 1.5));
      if (age % 20 === 0) ringOf(dim, "energy_beam", spot, 3, 5, 0, age * 5);
      if (age < 60) return true;
      let boss;
      try {
        boss = dim.spawnEntity(BOSS, spot);
      } catch {
        return false;
      }
      trackBoss(boss);
      particle(dim, "impact_burst", up(spot, 1.5));
      particle(dim, "shockwave", up(spot, 0.3), { radius: 14 });
      particle(dim, "dark_smoke", up(spot, 1));
      anim(boss, "animation.lacobra.boss.roar");
      announce(boss, "§5§lLA SERPIENTE LEGENDARIA", "§dha despertado");
      return false;
    },
    onEnd() {
      removeFx(circle);
    },
  });
  return true;
}

/** Al cargar el mundo, registra jefes ya existentes. */
export function scanBosses() {
  for (const id of ["overworld", "nether", "the_end"]) {
    try {
      for (const e of world.getDimension(id).getEntities({ type: BOSS })) trackBoss(e);
    } catch {
      // dimensión no disponible
    }
  }
}
