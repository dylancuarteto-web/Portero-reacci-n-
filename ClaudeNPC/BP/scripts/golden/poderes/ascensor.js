import { system } from "@minecraft/server";
import { ANIM, PARTICLES } from "../../config.js";
import { animate, blockAt, particleAt, reemplazable, sound, soundAt } from "../../util.js";
import { anunciar, aviso } from "../comun.js";

// Ascensor dorado: un círculo dorado aparece bajo tus pies; si no te mueves, una
// columna de oro te sube 12 bloques... y luego se deshace de arriba a abajo.
export const ascensor = {
  id: "ascensor",
  nombre: "Ascensor dorado",
  cd: 600,
  peso: () => 1,
  si: (c) => c.mundo && c.dist < 20 && c.jugadorEnSuelo,
  usar(g, jugador) {
    const e = g.entidad;
    const dim = jugador.dimension;
    const base = { x: Math.floor(jugador.location.x), y: Math.floor(jugador.location.y), z: Math.floor(jugador.location.z) };
    for (let h = 0; h <= 13; h++) {
      if (!reemplazable(blockAt(dim, { x: base.x, y: base.y + h, z: base.z }))) return 0;
    }
    const c = { x: base.x + 0.5, y: base.y, z: base.z + 0.5 };
    anunciar(g, "Ascensor dorado", "§6");
    animate(e, ANIM.goldenChasquido);
    sound(e, "beacon.power", 1.4);
    for (let t = 0; t < 26; t += 5) system.runTimeout(() => aviso(dim, c), t);
    const puestos = [];
    const deshacer = () => {
      system.runTimeout(() => {
        let i = puestos.length - 1;
        const id = system.runInterval(() => {
          if (i < 0) {
            system.clearRun(id);
            return;
          }
          const p = puestos[i--];
          const b = blockAt(dim, p);
          try {
            if (b?.typeId === "minecraft:gold_block") b.setType("minecraft:air");
          } catch {
            // Chunk descargado.
          }
          particleAt(dim, PARTICLES.midas, { x: p.x + 0.5, y: p.y + 0.5, z: p.z + 0.5 });
        }, 1);
        if (e.isValid) animate(e, ANIM.goldenRisa);
      }, 24);
    };
    system.runTimeout(() => {
      const atrapado = jugador.isValid && Math.hypot(jugador.location.x - c.x, jugador.location.z - c.z) < 0.9
        && Math.abs(jugador.location.y - base.y) < 1.2;
      let k = 0;
      const id = system.runInterval(() => {
        const pos = { x: base.x, y: base.y + k, z: base.z };
        const b = blockAt(dim, pos);
        if (k >= 12 || !reemplazable(b)) {
          system.clearRun(id);
          deshacer();
          return;
        }
        try {
          if (atrapado && jugador.isValid) {
            jugador.teleport({ x: c.x, y: base.y + k + 1.02, z: c.z }, { rotation: jugador.getRotation(), keepVelocity: false });
          }
          b.setType("minecraft:gold_block");
          puestos.push(pos);
        } catch {
          // No se pudo colocar.
        }
        soundAt(dim, pos, "random.orb", 0.6 + k * 0.1, 0.8);
        particleAt(dim, PARTICLES.midas, { x: pos.x + 0.5, y: pos.y + 1.1, z: pos.z + 0.5 });
        k++;
      }, 2);
    }, 26);
    return 100;
  },
};
