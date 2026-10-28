// Habilidad definitiva: LA COBRA SUPREMA.
// Secuencia: carga -> círculo -> serpiente gigante -> aura creciente ->
// transformación (aparece el espíritu de La Cobra) -> gran onda -> disipación -> mensaje.
import { CONFIG } from "../config.js";
import { addTask } from "../core/scheduler.js";
import { addEnergy } from "../core/state.js";
import { particle, sound, anim, spawnFx, removeFx, vanish, effect, ringOf } from "../core/fx.js";
import { findTargets, hurt, pushAway } from "../core/targets.js";
import { add, mul, flat, up, dist } from "../core/vec.js";

const cfg = CONFIG.habilidades.suprema;

// línea de tiempo en ticks
const T_SERPIENTE = 10;
const T_TRANSFORMACION = 40;
const T_LIBERACION = 110;
const T_DISIPAR = 116;
const T_FIN = 150;

export const suprema = {
  run(player, s) {
    s.busy = "suprema";
    const dim = player.dimension;
    const origin = player.location;
    /** @type {Record<string, import("@minecraft/server").Entity | undefined>} */
    const fx = {};
    fx.circle = spawnFx(dim, "lacobra:circulo_magico", up(origin, 0.05), player.id);
    try {
      fx.circle?.triggerEvent("lacobra:grande");
    } catch {
      // sin evento: el círculo queda en tamaño normal
    }
    anim(player, "animation.lacobra.player.transform", 0.3);
    sound(dim, "suprema_carga", origin, 1.2);
    // protección durante la secuencia para que no se interrumpa trivialmente
    effect(player, "resistance", 8, 3);
    effect(player, "slow_falling", 8, 0);
    let released = false;

    addTask({
      name: "suprema",
      owner: player.id,
      every: 2,
      tick(age) {
        if (!player.isValid) return false;
        const loc = player.location;
        const d = player.dimension;
        const charge = Math.min(1, age / T_LIBERACION);

        if (age === T_SERPIENTE) {
          fx.coil = spawnFx(d, "lacobra:cobra_suprema", loc, player.id);
          sound(d, "veneno_lanzar", loc, 1, 0.7);
        }
        if (age === T_TRANSFORMACION) {
          const back = flat(player.getViewDirection());
          fx.avatar = spawnFx(d, "lacobra:avatar_cobra", add(loc, mul(back, -2.6)), player.id);
          try {
            fx.avatar?.teleport(fx.avatar.location, { facingLocation: add(loc, mul(back, 4)) });
          } catch {
            // orientación por defecto
          }
          sound(d, "suprema_transformacion", loc, 1.2);
          particle(d, "supreme_pillar", loc);
          particle(d, "violet_flash", up(loc, 1.2));
          effect(player, "strength", 20, 2);
          effect(player, "speed", 20, 1);
        }

        // las entidades siguen al jugador durante la carga
        if (age < T_LIBERACION && age % 4 === 0) {
          for (const k of ["circle", "coil"]) {
            const e = fx[k];
            if (e && e.isValid) {
              try {
                e.teleport(up(loc, k === "circle" ? 0.05 : 0));
              } catch {
                // ignorado
              }
            }
          }
        }

        if (age < T_LIBERACION) {
          if (age % 6 === 0) particle(d, "charge_in", up(loc, 1));
          if (age % 4 === 0) particle(d, "aura_spiral", up(loc, 0.1));
          if (age % 10 === 0) particle(d, "rune_rise", up(loc, 0.1), { radius: 3 + charge * 2 });
          if (charge > 0.35 && age % 8 === 0) particle(d, "mini_snake", up(loc, 0.1));
          if (charge > 0.5 && age % 20 === 0) ringOf(d, "energy_beam", loc, 4, 6, 0, age * 3);
          if (charge > 0.7 && age % 6 === 0) particle(d, "gold_spark", up(loc, 1.2));
        }

        if (age === T_LIBERACION) {
          released = true;
          release(player);
        }
        if (age === T_LIBERACION + 4) particle(d, "shockwave", up(loc, 0.3), { radius: cfg.radio * 1.5 });
        if (age === T_LIBERACION + 8) particle(d, "shockwave", up(loc, 0.3), { radius: cfg.radio * 2.2 });

        if (age === T_DISIPAR) {
          if (fx.coil) vanish(fx.coil, "animation.lacobra.suprema.vanish");
          if (fx.avatar) vanish(fx.avatar, "animation.lacobra.avatar.vanish");
        }
        if (age === T_DISIPAR + 10 && fx.circle) vanish(fx.circle, "animation.lacobra.circulo.vanish");
        if (age > T_LIBERACION && age % 6 === 0) particle(d, "fade_dust", up(loc, 1));
        if (age === T_DISIPAR + 24) {
          removeFx(fx.coil);
          removeFx(fx.avatar);
          removeFx(fx.circle);
        }
        return age < T_FIN;
      },
      onEnd(cancelled) {
        s.busy = null;
        removeFx(fx.coil);
        removeFx(fx.avatar);
        removeFx(fx.circle);
        if (cancelled && !released) {
          addEnergy(player, s, cfg.coste); // interrumpida antes de liberar: se devuelve la energía
          return;
        }
        if (!player.isValid) return;
        sound(player.dimension, "suprema_final", player.location, 1);
        try {
          player.onScreenDisplay.setTitle("§6§lLA COBRA SUPREMA", {
            subtitle: "§5El rey de la serpiente ha hablado",
            fadeInDuration: 5,
            stayDuration: 50,
            fadeOutDuration: 15,
          });
        } catch {
          // pantalla no disponible
        }
      },
    });
  },
};

function release(player) {
  const d = player.dimension;
  const c = up(player.location, 0.3);
  sound(d, "onda", c, 1.5);
  sound(d, "impacto", c, 1.3, 0.8);
  particle(d, "shockwave", c, { radius: cfg.radio * 0.8 });
  particle(d, "energy_ring", c, { radius: cfg.radio * 0.6 });
  particle(d, "impact_burst", up(c, 1));
  particle(d, "supreme_pillar", c);
  ringOf(d, "impact_burst", c, cfg.radio * 0.5, 6, 0.5);
  ringOf(d, "dark_smoke", c, cfg.radio * 0.35, 5, 0.4);
  try {
    player.runCommand("camerashake add @s 0.25 0.6 positional");
  } catch {
    // comando no disponible: sin vibración
  }
  for (const t of findTargets(d, c, cfg.radio, player, 24)) {
    const f = 1 - 0.5 * Math.min(1, dist(t.location, c) / cfg.radio);
    hurt(t, Math.round(cfg.danio * f), player);
    pushAway(t, c, 2.0, 0.6);
    particle(d, "violet_flash", up(t.location, 1));
  }
}
