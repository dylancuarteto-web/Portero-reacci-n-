import { system } from "@minecraft/server";
import { ESPEJISMO, GOLDEN_FINAL, PARTICLES, PROP } from "../../../config.js";
import { now, particleAt, soundAt } from "../../../util.js";
import { danar, empujar, estallido } from "../../comun.js";
import { lerp, pose, prop } from "../comun.js";

// Ilusiones: se queda quieto, alza los brazos y mira arriba; después se separa en cinco
// (él y cuatro copias con alas y corona) que te rodean y te atacan desde distintos lados,
// una tras otra. Si golpeas una copia, se deshace.

export default {
  id: "ilusiones",
  cd: 520,
  si: (_c) => true,
  peso: (_c) => 2,
  usar(g, j) {
    const e = g.entidad;
    const dim = e.dimension;
    const f = g.final;
    g.vueloPropio = true;
    pose(g, 7);
    soundAt(dim, e.location, "mob.endermen.portal", 0.6, 1.2);
    soundAt(dim, e.location, "beacon.power", 1.6, 1);
    const inicio = { ...e.location };
    const actores = [];
    let t = 0;
    const id = system.runInterval(() => {
      t++;
      try {
        if (!e.isValid || f.etapa !== "pelea" || !j.isValid) return fin();
        if (t < 40) {
          e.teleport(inicio, { facingLocation: { x: inicio.x, y: inicio.y + 10, z: inicio.z } });
          if (t % 5 === 0) particleAt(dim, PARTICLES.auraDorada, e.location);
          if (t % 10 === 0) particleAt(dim, PARTICLES.converge, { x: inicio.x, y: inicio.y + 1.5, z: inicio.z });
          return;
        }
        if (t === 40) {
          // Se separa: cinco lugares alrededor del jugador.
          pose(g, 0);
          estallido(dim, { x: inicio.x, y: inicio.y + 1, z: inicio.z });
          soundAt(dim, inicio, "mob.shulker.teleport", 0.8, 1.2);
          soundAt(dim, inicio, "mob.endermen.portal", 1.2, 1);
          const a0 = Math.random() * Math.PI * 2;
          f.ilusiones = [];
          for (let k = 0; k < 5; k++) {
            const a = a0 + (k * Math.PI * 2) / 5;
            const lugar = { x: j.location.x + Math.cos(a) * 6, y: j.location.y + 1.4, z: j.location.z + Math.sin(a) * 6 };
            let ent = e;
            if (k > 0) {
              try {
                ent = dim.spawnEntity(ESPEJISMO, inicio);
                prop(ent, PROP.alas, true);
                prop(ent, PROP.corona, true);
                f.ilusiones.push(ent);
              } catch {
                continue;
              }
            }
            actores.push({ e: ent, desde: { ...inicio }, lugar, turno: 0, real: k === 0 });
          }
          // Orden de ataque al azar.
          actores.sort(() => Math.random() - 0.5).forEach((x, i) => (x.turno = 58 + i * 11));
          return;
        }
        const mira = j.getHeadLocation();
        for (const x of actores) {
          if (!x.e.isValid) continue;
          if (t <= 52) {
            x.e.teleport(lerp(x.desde, x.lugar, (t - 40) / 12), { facingLocation: mira });
          } else if (t < x.turno) {
            x.e.teleport({ x: x.lugar.x, y: x.lugar.y + Math.sin((t + x.turno) / 5) * 0.1, z: x.lugar.z }, { facingLocation: mira });
          } else if (t <= x.turno + 7) {
            // Se lanza contra el jugador.
            if (t === x.turno) {
              x.partida = { ...x.e.location };
              soundAt(dim, x.e.location, "mob.phantom.swoop", 1.3, 1);
            }
            const dx = j.location.x - x.partida.x;
            const dz = j.location.z - x.partida.z;
            const d = Math.hypot(dx, dz) || 1;
            const meta = { x: j.location.x - (dx / d) * 0.8, y: j.location.y + 0.3, z: j.location.z - (dz / d) * 0.8 };
            x.e.teleport(lerp(x.partida, meta, (t - x.turno) / 7), { facingLocation: mira });
            if (t === x.turno + 7) {
              const dist = Math.hypot(j.location.x - x.e.location.x, j.location.z - x.e.location.z);
              if (dist < 2.2) {
                danar(j, GOLDEN_FINAL.danoIlusion, e);
                empujar(j, x.e.location, 0.9, 0.35);
              }
              estallido(dim, { x: x.e.location.x, y: x.e.location.y + 1, z: x.e.location.z });
              if (!x.real) {
                try {
                  x.e.remove();
                } catch {
                  // Ya no existe.
                }
              } else {
                g.vueloPropio = false;
              }
            }
          }
        }
        if (t > 58 + 5 * 11 + 10) fin();
      } catch {
        fin();
      }
    }, 1);
    function fin() {
      system.clearRun(id);
      g.vueloPropio = false;
      pose(g, 0);
      for (const m of f.ilusiones ?? []) {
        try {
          if (m.isValid) {
            estallido(m.dimension, { x: m.location.x, y: m.location.y + 1, z: m.location.z });
            m.remove();
          }
        } catch {
          // Ya no existe.
        }
      }
      f.ilusiones = [];
    }
    g.quietoHasta = now();
    return 58 + 5 * 11 + 12;
  },
};
