// Habilidad B: REMATE LEGENDARIO — carga, esfera-balón de energía con colisión
// real y onda expansiva al impactar. No destruye bloques.
import { CONFIG, TPS } from "../config.js";
import { addTask } from "../core/scheduler.js";
import { addEnergy } from "../core/state.js";
import { particle, sound, anim, ringOf } from "../core/fx.js";
import { findTargets, hurt, pushAway } from "../core/targets.js";
import { add, mul, norm, up, dist } from "../core/vec.js";

const cfg = CONFIG.habilidades.remate;

/** proyectiles vivos: id -> { ownerId, owner, entity } */
export const remateShots = new Map();

export const remate = {
  run(player, s) {
    s.busy = "remate";
    const chargeTicks = Math.round(cfg.carga * TPS);
    anim(player, "animation.lacobra.player.charge", 0.15);
    sound(player.dimension, "carga", player.location);
    let launched = false;

    addTask({
      name: "remate-carga",
      owner: player.id,
      tick(age) {
        if (!player.isValid) return false;
        const head = player.getHeadLocation();
        const front = add(head, mul(player.getViewDirection(), 1.2));
        if (age % 4 === 0) particle(player.dimension, "charge_in", front);
        if (age % 8 === 0) particle(player.dimension, "dark_smoke", front);
        if (age >= chargeTicks) {
          launch(player);
          launched = true;
          return false;
        }
        return true;
      },
      onEnd(cancelled) {
        s.busy = null;
        // si la carga se interrumpe (muerte, salida) se devuelve la energía
        if (cancelled && !launched) addEnergy(player, s, cfg.coste);
      },
    });
  },
};

function launch(player) {
  const dim = player.dimension;
  const dir = norm(player.getViewDirection());
  const start = add(player.getHeadLocation(), mul(dir, 1.4));
  anim(player, "animation.lacobra.player.cast");
  sound(dim, "remate_lanzar", start);
  particle(dim, "gold_spark", start);
  let orb;
  try {
    orb = dim.spawnEntity("lacobra:esfera_remate", start);
  } catch {
    return;
  }
  const proj = orb.getComponent("minecraft:projectile");
  if (!proj) {
    orb.remove();
    return;
  }
  proj.owner = player;
  proj.shoot(mul(dir, cfg.velocidad));
  remateShots.set(orb.id, { ownerId: player.id, owner: player, entity: orb });
}

/** Impacto del Remate (llamado desde los eventos projectileHit*). */
export function remateImpact(projectile, location, dim) {
  const rec = remateShots.get(projectile.id);
  remateShots.delete(projectile.id);
  const owner = rec?.owner?.isValid ? rec.owner : undefined;
  const c = up(location, 0.3);
  particle(dim, "impact_burst", c);
  particle(dim, "shockwave", c, { radius: cfg.radio * 2.2 });
  particle(dim, "energy_ring", c, { radius: cfg.radio * 0.6 });
  particle(dim, "gold_spark", c);
  particle(dim, "dark_smoke", c);
  ringOf(dim, "violet_flash", c, cfg.radio * 0.7, 4, 0.3);
  sound(dim, "impacto", c, 1.2);
  for (const t of findTargets(dim, c, cfg.radio, owner)) {
    const f = 1 - Math.min(0.6, dist(t.location, c) / (cfg.radio * 1.6));
    hurt(t, Math.round(cfg.danio * f), owner);
    pushAway(t, c, 1.1, 0.45);
  }
}

export function isRemateShot(id) {
  return remateShots.has(id);
}

/** Limpia registros de esferas que desaparecieron sin impactar. */
export function pruneShots() {
  for (const [id, rec] of remateShots) if (!rec.entity.isValid) remateShots.delete(id);
}
