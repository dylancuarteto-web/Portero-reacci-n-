// Habilidad D: DOMINIO ABSOLUTO — círculo mágico con runas, rayos, mejoras
// temporales y debilitamiento limitado de enemigos; onda expansiva final.
import { CONFIG, TPS } from "../config.js";
import { addTask } from "../core/scheduler.js";
import { now } from "../core/state.js";
import { particle, sound, anim, spawnFx, removeFx, vanish, effect, ringOf } from "../core/fx.js";
import { findTargets, hurt, pushAway } from "../core/targets.js";
import { up } from "../core/vec.js";

const cfg = CONFIG.habilidades.dominio;

export const dominio = {
  check(player, s) {
    if (s.dominioUntil > now()) return "§eEl Dominio ya está activo";
    return undefined;
  },

  run(player, s) {
    const total = cfg.duracion * TPS;
    s.dominioUntil = now() + total;
    const dim = player.dimension;
    const circle = spawnFx(dim, "lacobra:circulo_magico", up(player.location, 0.05), player.id);
    anim(player, "animation.lacobra.player.cast");
    sound(dim, "dominio_on", player.location);
    particle(dim, "energy_ring", up(player.location, 0.1), { radius: 3 });
    particle(dim, "supreme_pillar", player.location);
    // mejoras temporales con duración fija (se renuevan, no se acumulan)
    effect(player, "strength", cfg.duracion, 1);
    effect(player, "resistance", cfg.duracion, 1);
    effect(player, "regeneration", cfg.duracion, 0);
    let ending = -1;

    addTask({
      name: "dominio",
      owner: player.id,
      every: 5,
      tick(age) {
        if (!player.isValid) return false;
        const loc = player.location;
        const d = player.dimension;
        if (ending >= 0) return age < ending + 10;
        if (age >= total) {
          finalWave(player);
          if (circle) vanish(circle, "animation.lacobra.circulo.vanish");
          ending = age;
          return true;
        }
        if (circle && circle.isValid) {
          try {
            circle.teleport(up(loc, 0.05));
          } catch {
            // dimensión distinta: el círculo se elimina al terminar
          }
        }
        if (age % 10 === 0) {
          particle(d, "rune_rise", up(loc, 0.1), { radius: 2.4 });
          particle(d, "aura_spiral", up(loc, 0.1));
        }
        if (age % 20 === 0) {
          sound(d, "dominio_pulso", loc, 0.7);
          particle(d, "energy_ring", up(loc, 0.1), { radius: 2 });
          const targets = findTargets(d, loc, cfg.radio, player);
          for (const t of targets) {
            effect(t, "weakness", 2.5, 0);
            effect(t, "slowness", 2.5, 0);
          }
          // rayos de energía sobre un máximo de 3 enemigos
          for (const t of targets.slice(0, 3)) {
            particle(d, "energy_beam", t.location);
            particle(d, "violet_flash", up(t.location, 1));
            hurt(t, cfg.danioRayo, player);
          }
          if (targets.length === 0) ringOf(d, "energy_beam", loc, 3, 3, 0, age * 7);
        }
        return true;
      },
      onEnd() {
        s.dominioUntil = 0;
        removeFx(circle);
      },
    });
  },
};

function finalWave(player) {
  const d = player.dimension;
  const c = up(player.location, 0.2);
  sound(d, "onda", c, 1.2);
  particle(d, "shockwave", c, { radius: cfg.radio * 2 });
  particle(d, "energy_ring", c, { radius: cfg.radio * 0.7 });
  particle(d, "impact_burst", up(c, 0.8));
  particle(d, "dark_smoke", up(c, 0.5));
  for (const t of findTargets(d, c, cfg.radio, player)) {
    hurt(t, cfg.danioFinal, player);
    pushAway(t, c, 1.4, 0.5);
  }
}
