import { system } from "@minecraft/server";
import { GOLDEN_FINAL } from "../../../config.js";
import { now, soundAt } from "../../../util.js";
import { detalle, pose, punto } from "../comun.js";
import { lanzarOrbe } from "../orbes.js";

// Orbes doradas y azules 3D (3 corazones de daño cada una): alza los brazos con una orbe
// en cada mano y las lanza una tras otra. La amarilla va recta y rápida; la azul es más
// lenta pero te sigue más.

export default {
  id: "volea",
  cd: 150,
  si: (_c) => true,
  peso: (_c) => 3,
  usar(g, j) {
    const e = g.entidad;
    const dim = e.dimension;
    const n = g.final?.espadasHechas ? 8 : 6;
    g.quietoHasta = now() + 20 + n * 6;
    pose(g, 8);
    detalle(g, 2); // una orbe en cada mano
    soundAt(dim, e.location, "beacon.power", 1.5, 1);
    system.runTimeout(() => e.isValid && pose(g, 0), 14);
    for (let k = 0; k < n; k++) {
      system.runTimeout(() => {
        if (!e.isValid || !j.isValid || g.final?.etapa !== "pelea") return;
        const tipo = k % 2; // 0 amarilla (mano derecha), 1 azul (mano izquierda)
        const yaw = e.getRotation().y;
        const desde = punto(e.location, yaw, 0.7, 1.5, tipo === 0 ? 0.45 : -0.45);
        const obj = { x: j.location.x + (Math.random() - 0.5) * 1.2, y: j.location.y + 1, z: j.location.z + (Math.random() - 0.5) * 1.2 };
        const d = { x: obj.x - desde.x, y: obj.y - desde.y, z: obj.z - desde.z };
        const l = Math.hypot(d.x, d.y, d.z) || 1;
        const rap = tipo === 0 ? 0.62 : 0.42;
        lanzarOrbe(dim, { tipo, desde, vel: { x: (d.x / l) * rap, y: (d.y / l) * rap, z: (d.z / l) * rap }, objetivo: j, dueno: e,
          contra: "jugadores", dano: GOLDEN_FINAL.danoOrbe, guiado: tipo === 0 ? 0.03 : 0.08, guiadoHasta: tipo === 0 ? 20 : 45,
          vida: 100, radio: 0.55 });
        soundAt(dim, desde, tipo === 0 ? "mob.blaze.shoot" : "mob.shulker.shoot", 1.4, 0.8);
        if (k === n - 1) detalle(g, 0);
      }, 16 + k * 6);
    }
    return 22 + n * 6;
  },
};
