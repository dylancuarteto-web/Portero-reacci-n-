import { EntityDamageCause, system } from "@minecraft/server";
import { ANIM, ECO, PARTICLES } from "../../config.js";
import { animate, distancia, flat, particleAt, sound, soundAt } from "../../util.js";
import { anunciar, danar, empujar, estallido } from "../comun.js";

// Tu reflejo: aparece un espejo de luz entre Claude Golden y tú. Del otro lado sale tu
// reflejo, que copia cada paso tuyo al revés: si te acercas al espejo, él también.
// Si llega a tocarte te golpea; si le pegas primero, se rompe.
export const reflejo = {
  id: "reflejo",
  nombre: "Tu reflejo",
  cd: 700,
  peso: () => 1,
  si: (c) => c.dist > 4 && c.dist < 18,
  usar(g, jugador) {
    const e = g.entidad;
    const dim = jugador.dimension;
    const m = { x: (e.location.x + jugador.location.x) / 2, z: (e.location.z + jugador.location.z) / 2 };
    const n = flat(jugador.location, e.location);
    const espejar = (p) => {
      const d = (p.x - m.x) * n.x + (p.z - m.z) * n.z;
      return { x: p.x - 2 * d * n.x, y: p.y, z: p.z - 2 * d * n.z };
    };
    let clon;
    try {
      clon = dim.spawnEntity(ECO, espejar(jugador.location));
      clon.nameTag = "§bTu reflejo";
    } catch {
      return 0;
    }
    anunciar(g, "Tu reflejo", "§b");
    sound(e, "beacon.activate", 1.6);
    let t = 0;
    let listo = 0;
    const id = system.runInterval(() => {
      t++;
      try {
        if (!clon.isValid || !jugador.isValid || t > 220) {
          system.clearRun(id);
          if (clon.isValid) {
            estallido(dim, { x: clon.location.x, y: clon.location.y + 1, z: clon.location.z });
            clon.remove();
          }
          soundAt(dim, { x: m.x, y: jugador.location.y, z: m.z }, "random.glass", 1, 1);
          return;
        }
        clon.teleport(espejar(jugador.location), { facingLocation: jugador.getHeadLocation() });
        if (t % 4 === 0) {
          for (let i = -6; i <= 6; i += 2) {
            for (const h of [0.4, 1.6, 2.8]) {
              particleAt(dim, PARTICLES.espejo, { x: m.x - n.z * i, y: jugador.location.y + h, z: m.z + n.x * i });
            }
          }
        }
        if (t > listo && distancia(clon.location, jugador.location) < 1.7) {
          listo = t + 20;
          animate(clon, ANIM.golpe);
          danar(jugador, 4, e, EntityDamageCause.entityAttack);
          empujar(jugador, clon.location, 0.8, 0.3);
        }
      } catch {
        system.clearRun(id);
      }
    }, 1);
    return 60;
  },
};
