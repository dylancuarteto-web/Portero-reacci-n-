import { system, world } from "@minecraft/server";
import { ANIM, MODIFICA_MUNDO, PARTICLES } from "../../config.js";
import { protegido } from "../../estructuras.js";
import { animate, blockAt, burst, now, particleAt, sound, soundAt } from "../../util.js";
import { anunciar, avisarJugador, posicionHace } from "../comun.js";

// Ctrl + Z: Claude Golden "deshace" lo último que hiciste. Los bloques que pusiste en
// los últimos 30 s se vuelven polvo de oro (tu torre, tu muro...) y tú vuelves a donde
// estabas hace 3 segundos.

const puestos = new Map(); // jugador → [{ pos, tipo, t, dim }]

world.afterEvents.playerPlaceBlock.subscribe(({ player, block }) => {
  let lista = puestos.get(player.id);
  if (!lista) puestos.set(player.id, (lista = []));
  lista.push({ pos: { ...block.location }, tipo: block.typeId, t: now(), dim: block.dimension.id });
  if (lista.length > 40) lista.shift();
});

function recientes(jugador) {
  return (puestos.get(jugador.id) ?? []).filter((p) => now() - p.t < 600 && p.dim === jugador.dimension.id);
}

export const deshacer = {
  id: "deshacer",
  nombre: "Ctrl + Z",
  cd: 520,
  peso: (c) => 1 + (c.jugador && recientes(c.jugador).length ? 2 : 0),
  si: (c) => c.dist < 30 && !!c.jugador && (recientes(c.jugador).length > 0 || !!posicionHace(c.jugador, 60)),
  usar(g, jugador) {
    const e = g.entidad;
    const dim = jugador.dimension;
    anunciar(g, "Ctrl + Z", "§b");
    animate(e, ANIM.goldenChasquido);
    sound(e, "beacon.deactivate", 0.6);
    const lista = MODIFICA_MUNDO ? recientes(jugador).slice(-16).reverse() : [];
    lista.forEach((c, i) => {
      system.runTimeout(() => {
        const b = blockAt(dim, c.pos);
        if (b?.typeId !== c.tipo || protegido(c.pos)) return;
        try {
          b.setType("minecraft:air");
        } catch {
          return;
        }
        particleAt(dim, PARTICLES.midas, { x: c.pos.x + 0.5, y: c.pos.y + 0.5, z: c.pos.z + 0.5 });
        soundAt(dim, c.pos, "random.pop", 0.7 + i * 0.05, 0.8);
      }, 6 + i * 2);
    });
    if (lista.length) puestos.set(jugador.id, (puestos.get(jugador.id) ?? []).filter((p) => !lista.includes(p)));
    const antes = posicionHace(jugador, 60);
    system.runTimeout(() => {
      if (!jugador.isValid) return;
      if (antes) {
        try {
          jugador.camera.fade({ fadeColor: { red: 0.55, green: 0.85, blue: 1 }, fadeTime: { fadeInTime: 0.2, holdTime: 0.1, fadeOutTime: 0.5 } });
          jugador.teleport(antes.loc, { rotation: jugador.getRotation() });
        } catch {
          // No se pudo rebobinar.
        }
        burst(jugador, PARTICLES.reloj);
      }
      avisarJugador(jugador, lista.length ? `§bCtrl + Z: se deshicieron ${lista.length} bloques tuyos` : "§bCtrl + Z: vuelves 3 segundos atrás");
    }, 10 + lista.length * 2);
    return 30 + lista.length * 2;
  },
};
