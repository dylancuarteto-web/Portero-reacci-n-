import { system } from "@minecraft/server";
import { ANIM, PARTICLES } from "../../config.js";
import { animate, burst, sound, soundAt } from "../../util.js";
import { anunciar, avisarJugador, objetivos } from "../comun.js";

// Gravedad al revés: todo sube flotando... y de golpe la gravedad vuelve multiplicada.
// Un buen water drop (o caer en agua) te salva.
export const gravedad = {
  id: "gravedad",
  nombre: "Gravedad al revés",
  cd: 560,
  peso: () => 1,
  si: (c) => c.dist < 14 && c.cielo,
  usar(g) {
    const e = g.entidad;
    const lista = objetivos(e.dimension, e.location, 16);
    if (!lista.length) return 0;
    anunciar(g, "Gravedad al revés", "§d");
    animate(e, ANIM.goldenPoder);
    sound(e, "mob.shulker.bullet.hit", 0.6);
    for (const j of lista) {
      try {
        j.addEffect("levitation", 36, { amplifier: 4, showParticles: true });
      } catch {
        // Sin efecto.
      }
      burst(j, PARTICLES.gravedad, { x: 0, y: 0.2, z: 0 });
    }
    system.runTimeout(() => {
      for (const j of lista) {
        if (!j.isValid) continue;
        try {
          j.removeEffect("levitation");
          j.applyKnockback({ x: 0, z: 0 }, -2.4);
        } catch {
          // Jugador no disponible.
        }
        avisarJugador(j, "§c¡Y ahora... abajo!");
        soundAt(j.dimension, j.location, "random.explode", 0.6, 0.4);
      }
      if (e.isValid) animate(e, ANIM.goldenRisa);
    }, 40);
    return 60;
  },
};
