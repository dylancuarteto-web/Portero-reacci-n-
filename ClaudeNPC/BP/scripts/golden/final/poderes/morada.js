import { system } from "@minecraft/server";
import { PARTICLES, SONIDO } from "../../../config.js";
import { now, particleAt, soundAt } from "../../../util.js";
import { cortar, jugadoresCerca, morada, particula, pose, punto, sonar } from "../comun.js";
import { AVISO, lugares, marca, rayo } from "./espadas.js";

// Espada morada (v8.2): Golden vuelve morada una de sus espadas (la amarilla o la azul, al
// azar). Con ella hace tres oleadas de rayos MORADOS que dañan siempre: no importa si estás
// quieto, caminando, corriendo o saltando (hay que salir del círculo). Cada rayo morado suena
// con el corte de Dusttrust (fuerte). Al terminar, la espada vuelve a su color.

const RADIO = 2.4;
const PRIMERA = 26; // tick de la primera oleada
const CADA = 26; // ticks entre oleadas
const OLAS = 3;

// Sonido fuerte del rayo morado: a cada jugador cerca (sin perder volumen por la distancia) y
// en el lugar del rayo (para los demás).
export function sonarRayoMorado(dim, lugar, cerca = 40) {
  sonar(jugadoresCerca(dim, lugar, cerca), SONIDO.rayoMorado, 0.9 + Math.random() * 0.2, 1.0);
  soundAt(dim, lugar, SONIDO.rayoMorado, 1, 1);
  soundAt(dim, lugar, "ambient.weather.thunder", 1.4, 0.5);
}

// Vuelve morada una espada (1 la derecha, 2 la izquierda) con chispas que se juntan en la hoja.
export function cambiarAMorada(g, lado) {
  const e = g.entidad;
  try {
    const yaw = e.getRotation().y;
    const mano = punto(e.location, yaw, 0.7, 1.3, lado === 1 ? 0.45 : -0.45); // adelante, alto, a su derecha
    particula(e.dimension, PARTICLES.chispasMoradas, mano);
    soundAt(e.dimension, e.location, "beacon.activate", 0.6, 1);
    soundAt(e.dimension, e.location, "mob.evocation_illager.prepare_attack", 0.7, 1);
  } catch {
    // Descargado.
  }
  morada(g, lado);
}

export default {
  id: "morada",
  cd: 520,
  si: (c) => c.espadas,
  peso: (_c) => 3,
  usar(g, j) {
    const e = g.entidad;
    const dim = e.dimension;
    const f = g.final;
    const lado = Math.random() < 0.5 ? 1 : 2;
    const dura = PRIMERA + OLAS * CADA + 10;
    g.quietoHasta = now() + dura;
    pose(g, 12);
    let t = 0;
    const marcas = [];
    const olas = [];
    const id = system.runInterval(() => {
      t++;
      try {
        if (!e.isValid || f.etapa !== "pelea" || !j.isValid) return fin();
        if (t === 10) cambiarAMorada(g, lado);
        for (let i = 0; i < OLAS; i++) {
          const t0 = PRIMERA + i * CADA;
          if (t === t0) {
            olas[i] = lugares(dim, j, 5, f.arena);
            for (const l of olas[i]) {
              const m = marca(dim, l, "morado");
              if (m) marcas.push(m);
            }
            soundAt(dim, olas[i][0], "note.pling", 0.5, 1);
          }
          if (olas[i] && t > t0 && t < t0 + 18 && t % 4 === 0) {
            for (const l of olas[i]) particula(dim, AVISO.morado, { x: l.x, y: l.y + 0.06, z: l.z }, { "variable.radio": RADIO });
          }
          if (t === t0 + 14) cortar(e, i === OLAS - 1 ? 0 : lado, lado);
          if (t === t0 + 18) {
            for (const l of olas[i]) rayo(dim, l, "morado", e);
            sonarRayoMorado(dim, olas[i][0]);
            for (const m of marcas.splice(0)) {
              try {
                if (m.isValid) m.remove();
              } catch {
                // Ya no existe.
              }
            }
          }
        }
        if (t >= dura) fin();
      } catch {
        fin();
      }
    }, 1);
    function fin() {
      system.clearRun(id);
      for (const m of marcas) {
        try {
          if (m.isValid) m.remove();
        } catch {
          // Ya no existe.
        }
      }
      // La espada vuelve a su color (salvo que el parkour la esté usando).
      if (g.final?.etapa !== "parkour") {
        morada(g, 0);
        try {
          particleAt(dim, PARTICLES.chispasMoradas, { x: e.location.x, y: e.location.y + 1.3, z: e.location.z });
        } catch {
          // Descargado.
        }
      }
    }
    return dura;
  },
};
