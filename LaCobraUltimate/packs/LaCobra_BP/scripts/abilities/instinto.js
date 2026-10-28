// Habilidad A: INSTINTO DE LA COBRA — aura negra y dorada, velocidad y golpes especiales.
import { CONFIG, TPS } from "../config.js";
import { addTask } from "../core/scheduler.js";
import { now } from "../core/state.js";
import { particle, sound, anim, effect } from "../core/fx.js";
import { hurt, isHostileTarget } from "../core/targets.js";
import { up } from "../core/vec.js";

const cfg = CONFIG.habilidades.instinto;

export const instinto = {
  check(player, s) {
    if (s.instintoUntil > now()) return "§eEl Instinto ya está activo";
    return undefined;
  },

  run(player, s) {
    const dim = player.dimension;
    const ticks = cfg.duracion * TPS;
    s.instintoUntil = now() + ticks;
    effect(player, "speed", cfg.duracion, cfg.nivelVelocidad);
    effect(player, "jump_boost", cfg.duracion, 0);
    anim(player, "animation.lacobra.player.cast");
    sound(dim, "instinto_on", player.location);
    particle(dim, "energy_ring", up(player.location, 0.1), { radius: 1.6 });
    particle(dim, "gold_spark", up(player.location, 1));
    particle(dim, "dark_smoke", up(player.location, 0.8));

    addTask({
      name: "instinto",
      owner: player.id,
      every: 4,
      tick(age) {
        if (!player.isValid || now() >= s.instintoUntil) return false;
        const loc = player.location;
        const d = player.dimension;
        particle(d, "aura_spiral", up(loc, 0.1));
        if (age % 12 === 0) particle(d, "mini_snake", up(loc, 0.1));
        if (age % 20 === 0) particle(d, "violet_flash", up(loc, 1.1));
        return true;
      },
      onEnd() {
        s.instintoUntil = 0;
        if (!player.isValid) return;
        sound(player.dimension, "instinto_off", player.location, 0.8);
        particle(player.dimension, "fade_dust", up(player.location, 1));
      },
    });
  },
};

/** Golpe cuerpo a cuerpo con el Instinto activo: daño extra y efecto especial. */
export function instintoHit(player, s, target) {
  if (s.instintoUntil <= now() || !isHostileTarget(target, player)) return;
  if (now() - s.lastHitBonus < 8) return; // evita aplicar el bono varias veces por golpe
  s.lastHitBonus = now();
  const dim = target.dimension;
  const loc = up(target.location, 1);
  hurt(target, cfg.bonusDanio, player);
  particle(dim, "scale_shards", loc);
  particle(dim, "gold_spark", loc);
  particle(dim, "violet_flash", loc);
  sound(dim, "golpe_especial", loc, 0.9);
}
