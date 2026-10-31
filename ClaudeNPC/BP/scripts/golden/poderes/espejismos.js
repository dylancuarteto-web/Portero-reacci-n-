import { ANIM, ESPEJISMO } from "../../config.js";
import { animate, now, sound } from "../../util.js";
import { anunciar, estallido } from "../comun.js";

// ¿Cuál soy yo?: Claude Golden se divide en tres iguales que vuelan a tu alrededor y
// cambian de lugar en un destello. Solo uno es real: si golpeas a un espejismo, se
// deshace y te deja ciego un momento; si encuentras al verdadero, se acaba el truco.
// (El vuelo y los cambios de lugar los maneja golden/index.js.)
export const espejismos = {
  id: "espejismos",
  nombre: "¿Cuál soy yo?",
  cd: 900,
  peso: () => 1,
  si: (c) => c.dist < 18 && !c.espejismos,
  usar(g) {
    const e = g.entidad;
    const dim = e.dimension;
    anunciar(g, "¿Cuál soy yo?", "§d");
    animate(e, ANIM.goldenChasquido);
    sound(e, "beacon.activate", 2);
    g.espejismos = [];
    for (let k = 0; k < 2; k++) {
      try {
        const m = dim.spawnEntity(ESPEJISMO, e.location);
        m.nameTag = e.nameTag;
        g.espejismos.push(m);
      } catch {
        // No se pudo crear.
      }
    }
    estallido(dim, { x: e.location.x, y: e.location.y + 1, z: e.location.z });
    g.espejismosHasta = now() + 240;
    return 30;
  },
};
