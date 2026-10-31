import { system } from "@minecraft/server";
import { ANIM, PARTICLES } from "../../config.js";
import { animate, particleAt, sound, soundAt } from "../../util.js";
import { anunciar, aviso, danar, empujar, estallido, objetivos, sueloEn } from "../comun.js";

// Lluvia de ideas: piensa fuerte y caen bombillas de luz donde estás (y donde vas a
// estar). Antes de cada impacto aparece un círculo en el suelo: muévete.
export const lluvia = {
  id: "lluvia",
  nombre: "Lluvia de ideas",
  cd: 360,
  peso: () => 1.3,
  si: (c) => c.dist < 26,
  usar(g, jugador) {
    const e = g.entidad;
    const fase2 = g.fase === 2;
    const olas = fase2 ? 4 : 3;
    const porOla = fase2 ? 7 : 5;
    animate(e, ANIM.goldenPensar);
    anunciar(g, "Lluvia de ideas", "§e");
    sound(e, "random.orb", 0.6);
    for (let o = 0; o < olas; o++) {
      system.runTimeout(() => {
        if (!e.isValid || !jugador.isValid) return;
        const dim = jugador.dimension;
        const v = jugador.getVelocity();
        const puntos = [];
        for (let k = 0; k < porOla; k++) {
          // La primera cae donde vas a estar; las demás alrededor.
          const x = jugador.location.x + (k === 0 ? v.x * 12 : (Math.random() - 0.5) * 10);
          const z = jugador.location.z + (k === 0 ? v.z * 12 : (Math.random() - 0.5) * 10);
          const p = sueloEn(dim, x, z, jugador.location.y);
          if (p) puntos.push(p);
        }
        for (let t = 0; t < 24; t += 6) system.runTimeout(() => puntos.forEach((p) => aviso(dim, p)), t);
        soundAt(dim, jugador.location, "note.pling", 1.8, 0.6);
        for (let h = 0; h < 6; h++) {
          system.runTimeout(() => puntos.forEach((p) => particleAt(dim, PARTICLES.chispaCae, { x: p.x, y: p.y + 12 - h * 2, z: p.z })), 24 + h);
        }
        system.runTimeout(() => {
          for (const p of puntos) {
            estallido(dim, { x: p.x, y: p.y + 0.4, z: p.z });
            soundAt(dim, p, "random.explode", 1.7, 0.35);
            for (const j of objetivos(dim, p, 2.2)) {
              if (Math.abs(j.location.y - p.y) > 2.5) continue;
              danar(j, fase2 ? 6 : 5, e);
              empujar(j, p, 0.5, 0.35);
            }
          }
        }, 30);
      }, o * 36);
    }
    return olas * 36 + 30;
  },
};
