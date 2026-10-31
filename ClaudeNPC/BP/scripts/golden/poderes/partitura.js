import { system } from "@minecraft/server";
import { ANIM, PARTICLES } from "../../config.js";
import { animate, blockAt, now, particleAt, reemplazable, soundAt } from "../../util.js";
import { anunciar, danar, estallido } from "../comun.js";

// Partitura: dirige una melodía y cada nota sale volando hacia ti siguiéndote, pero
// gira despacio: muévete de lado en el último momento para que pase de largo.
const MELODIA = [1.0, 1.19, 1.5, 1.78, 2.0, 1.78, 1.5, 1.33, 1.0, 1.26, 1.5, 2.0, 1.68, 1.5];

export const partitura = {
  id: "partitura",
  nombre: "Partitura",
  cd: 520,
  peso: () => 1.1,
  si: (c) => c.dist > 3 && c.dist < 24,
  usar(g, jugador) {
    const e = g.entidad;
    const dim = e.dimension;
    const total = g.fase === 2 ? 14 : 10;
    anunciar(g, "Partitura", "§d");
    animate(e, ANIM.goldenDirigir);
    g.quietoHasta = now() + total * 6 + 10;
    const notas = [];
    for (let i = 0; i < total; i++) {
      system.runTimeout(() => {
        if (!e.isValid || !jugador.isValid) return;
        const o = e.getHeadLocation();
        const j = jugador.getHeadLocation();
        const dx = j.x - o.x;
        const dz = j.z - o.z;
        const l = Math.hypot(dx, dz) || 1;
        const lado = (i % 2 ? 1 : -1) * 0.18;
        notas.push({ pos: { ...o }, vel: { x: (dx / l) * 0.15 - (dz / l) * lado, y: 0.12, z: (dz / l) * 0.15 + (dx / l) * lado }, vida: 120 });
        soundAt(dim, o, i % 2 ? "note.bell" : "note.harp", MELODIA[i % MELODIA.length], 1);
      }, i * 6);
    }
    let t = 0;
    const id = system.runInterval(() => {
      t++;
      try {
        if (t > total * 6 + 130 || !jugador.isValid) {
          system.clearRun(id);
          return;
        }
        const meta = { x: jugador.location.x, y: jugador.location.y + 1.1, z: jugador.location.z };
        for (const n of notas) {
          if (n.vida <= 0) continue;
          n.vida--;
          const dx = meta.x - n.pos.x;
          const dy = meta.y - n.pos.y;
          const dz = meta.z - n.pos.z;
          const d = Math.hypot(dx, dy, dz) || 1;
          n.vel.x += ((dx / d) * 0.32 - n.vel.x) * 0.07;
          n.vel.y += ((dy / d) * 0.32 - n.vel.y) * 0.07;
          n.vel.z += ((dz / d) * 0.32 - n.vel.z) * 0.07;
          n.pos.x += n.vel.x;
          n.pos.y += n.vel.y;
          n.pos.z += n.vel.z;
          particleAt(dim, PARTICLES.nota, n.pos);
          if (d < 0.9) {
            n.vida = 0;
            danar(jugador, 3, e);
            soundAt(dim, n.pos, "note.bass", 0.6, 1);
            estallido(dim, n.pos);
          } else if (!reemplazable(blockAt(dim, n.pos))) {
            n.vida = 0;
            particleAt(dim, PARTICLES.ondaChispa, n.pos);
          }
        }
      } catch {
        system.clearRun(id);
      }
    }, 1);
    return total * 6 + 20;
  },
};
