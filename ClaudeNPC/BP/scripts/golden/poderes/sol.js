import { system } from "@minecraft/server";
import { ANIM, PARTICLES } from "../../config.js";
import { animate, particleAt, soundAt } from "../../util.js";
import { anunciar, avisarJugador, danar, estallido } from "../comun.js";

// Sol de bolsillo: Claude Golden enciende un sol pequeñito que te sigue. Si estás al
// aire libre, te quema; escóndete bajo un techo, un árbol o un bloque.
export const sol = {
  id: "sol",
  nombre: "Sol de bolsillo",
  cd: 700,
  peso: (c) => (c.expuesto ? 1.2 : 0.3),
  si: (c) => c.dist < 30,
  usar(g, jugador) {
    const e = g.entidad;
    const dim = jugador.dimension;
    anunciar(g, "Sol de bolsillo", "§6");
    animate(e, ANIM.goldenPoder);
    system.runTimeout(() => jugador.isValid && avisarJugador(jugador, "§e¡Un sol te persigue! Busca sombra"), 40);
    const pos = { x: e.location.x, y: e.location.y + 4, z: e.location.z };
    let t = 0;
    const id = system.runInterval(() => {
      t += 2;
      try {
        if (!jugador.isValid || t > 200 || jugador.dimension.id !== dim.id) {
          system.clearRun(id);
          estallido(dim, pos);
          return;
        }
        const meta = { x: jugador.location.x, y: jugador.location.y + 8, z: jugador.location.z };
        const dx = meta.x - pos.x;
        const dy = meta.y - pos.y;
        const dz = meta.z - pos.z;
        const d = Math.hypot(dx, dy, dz) || 1;
        const paso = Math.min(0.45, d * 0.15);
        pos.x += (dx / d) * paso;
        pos.y += (dy / d) * paso;
        pos.z += (dz / d) * paso;
        particleAt(dim, PARTICLES.sol, pos);
        if (t % 6 === 0) particleAt(dim, PARTICLES.solRayo, pos);
        if (t % 20 === 0) {
          const cabeza = jugador.getHeadLocation();
          const vx = pos.x - cabeza.x;
          const vy = pos.y - cabeza.y;
          const vz = pos.z - cabeza.z;
          const l = Math.hypot(vx, vy, vz) || 1;
          const sombra = dim.getBlockFromRay(cabeza, { x: vx / l, y: vy / l, z: vz / l }, { maxDistance: l });
          if (!sombra) {
            jugador.setOnFire(2, true);
            danar(jugador, 2, e);
            soundAt(dim, cabeza, "random.fizz", 1, 0.6);
          }
        }
      } catch {
        system.clearRun(id);
      }
    }, 2);
    return 40;
  },
};
