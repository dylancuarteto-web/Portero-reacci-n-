import { system } from "@minecraft/server";
import { ANIM, PARTICLES } from "../../config.js";
import { animate, flat, particleAt, soundAt } from "../../util.js";
import { anunciar, danar, empujar, estallido, objetivos, sueloEn } from "../comun.js";

// Agujero de oro: abre una pequeña singularidad dorada que lo atrae todo. Corre en
// dirección contraria; en el centro duele. Al cerrarse explota y empuja hacia fuera.
export const agujero = {
  id: "agujero",
  nombre: "Agujero de oro",
  cd: 640,
  peso: () => 1,
  si: (c) => c.dist < 20,
  usar(g, jugador) {
    const e = g.entidad;
    const dim = jugador.dimension;
    const d = flat(jugador.location, e.location);
    const lado = Math.random() < 0.5 ? -1 : 1;
    const suelo = sueloEn(dim, jugador.location.x + d.x * 5 - d.z * 2 * lado, jugador.location.z + d.z * 5 + d.x * 2 * lado, jugador.location.y);
    const c = suelo ? { x: suelo.x, y: suelo.y + 1.2, z: suelo.z } : { x: jugador.location.x + d.x * 5, y: jugador.location.y + 1.2, z: jugador.location.z + d.z * 5 };
    anunciar(g, "Agujero de oro", "§6");
    animate(e, ANIM.goldenPoder);
    soundAt(dim, c, "mob.endermen.portal", 0.5, 1);
    const ultimo = new Map();
    let t = 0;
    const id = system.runInterval(() => {
      t += 2;
      try {
        if (t > 120) {
          system.clearRun(id);
          estallido(dim, c);
          soundAt(dim, c, "random.explode", 0.8, 1);
          for (const j of objetivos(dim, c, 8)) empujar(j, c, 1.2, 0.5);
          return;
        }
        particleAt(dim, PARTICLES.agujero, c);
        if (t % 10 === 0) particleAt(dim, PARTICLES.fusionEspiral, c);
        if (t % 8 === 0) particleAt(dim, PARTICLES.onda, c);
        if (t % 4 !== 0) return;
        for (const j of objetivos(dim, c, 14)) {
          const dx = c.x - j.location.x;
          const dz = c.z - j.location.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 0.3) {
            const f = Math.min(0.4, 0.1 + 1.4 / (dist + 2));
            j.applyKnockback({ x: (dx / dist) * f, z: (dz / dist) * f }, 0.06);
          }
          if (dist < 1.6 && t - (ultimo.get(j.id) ?? -99) >= 20) {
            ultimo.set(j.id, t);
            danar(j, 2, e);
          }
        }
      } catch {
        system.clearRun(id);
      }
    }, 2);
    return 60;
  },
};
