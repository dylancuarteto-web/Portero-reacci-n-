// Habilidad C: VENENO SERPENTINO — serpiente de energía teledirigida con
// movimiento suavizado, alcance y duración limitados.
import { CONFIG, TPS } from "../config.js";
import { addTask, taskCount } from "../core/scheduler.js";
import { particle, sound, anim, spawnFx, removeFx, vanish, effect } from "../core/fx.js";
import { pickTarget, hurt, isAlive } from "../core/targets.js";
import { add, sub, mul, norm, lerp, len, dist, up } from "../core/vec.js";

const cfg = CONFIG.habilidades.veneno;

export const veneno = {
  check(player) {
    if (taskCount("veneno", player.id) >= CONFIG.limites.maxSerpientesPorJugador) {
      return "§cDemasiadas serpientes activas";
    }
    if (!pickTarget(player, cfg.alcance)) return "§cNo hay ningún objetivo hostil a la vista";
    return undefined;
  },

  run(player) {
    const target = pickTarget(player, cfg.alcance);
    if (!target) return;
    const dim = player.dimension;
    const dir0 = norm(player.getViewDirection());
    let pos = add(up(player.location, 1.1), mul(dir0, 1.2));
    const startPos = pos;
    const snake = spawnFx(dim, "lacobra:serpiente_energia", pos, player.id);
    if (!snake) return;
    anim(player, "animation.lacobra.player.cast");
    sound(dim, "veneno_lanzar", pos);
    particle(dim, "violet_flash", pos);
    let dir = dir0;
    let vanishAt = -1;
    const maxTicks = cfg.duracion * TPS;

    addTask({
      name: "veneno",
      owner: player.id,
      tick(age) {
        if (!snake.isValid) return false;
        if (vanishAt >= 0) return age < vanishAt + 10; // deja terminar la animación de salida
        const lost = !isAlive(target) || target.dimension.id !== dim.id;
        if (lost || age > maxTicks || dist(pos, startPos) > cfg.alcance * 1.6) {
          vanish(snake);
          particle(dim, "fade_dust", pos);
          vanishAt = age;
          return true;
        }
        const aim = up(target.location, 0.7);
        const to = sub(aim, pos);
        if (len(to) < 1.1) {
          hurt(target, cfg.danio, player.isValid ? player : undefined);
          effect(target, "slowness", 3, 2);
          effect(target, "poison", 3, 0);
          particle(dim, "venom_splash", aim);
          particle(dim, "violet_flash", aim);
          particle(dim, "dark_smoke", aim);
          sound(dim, "veneno_golpe", aim);
          vanish(snake);
          vanishAt = age;
          return true;
        }
        // giro suave hacia el objetivo (no instantáneo) y leve ondulación
        dir = norm(lerp(dir, norm(to), 0.22));
        const wiggle = Math.sin(age * 0.6) * 0.08;
        const side = norm({ x: -dir.z, y: 0, z: dir.x });
        pos = add(add(pos, mul(dir, cfg.velocidad)), mul(side, wiggle));
        try {
          snake.teleport(pos, { facingLocation: add(pos, dir) });
        } catch {
          return false;
        }
        return true;
      },
      onEnd() {
        removeFx(snake);
      },
    });
  },
};
