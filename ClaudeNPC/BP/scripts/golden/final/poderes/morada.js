import { system } from "@minecraft/server";
import { PARTICLES, SONIDO } from "../../../config.js";
import { now, particleAt, soundAt } from "../../../util.js";
import { cortar, jugadoresCerca, morada, particula, pose, punto, sonar } from "../comun.js";
import { avisar, columna, espada, lugares } from "./espadas.js";
import { cargar, tajos } from "../laser.js";

// Espada morada (v8.2): Golden vuelve morada una de sus espadas (la amarilla o la azul, al
// azar). Con ella hace tres oleadas de LÁSERES MORADOS (v9.0; antes eran rayos) que dañan
// siempre: no importa si estás quieto, caminando, corriendo o saltando (hay que salir del
// círculo que marca el "!"). Cada oleada suena con el corte de Dusttrust (fuerte). Al terminar,
// la espada vuelve a su color.

const PRIMERA = 26; // tick de la primera oleada
const CADA = 26; // ticks entre oleadas
const OLAS = 3;

// Sonido fuerte del láser morado (el corte de Dusttrust): a cada jugador cerca (sin perder
// volumen por la distancia) y en el lugar del láser (para los demás).
export function sonarRayoMorado(dim, lugar, cerca = 40) {
  sonar(jugadoresCerca(dim, lugar, cerca), SONIDO.rayoMorado, 0.9 + Math.random() * 0.2, 1.0);
  soundAt(dim, lugar, SONIDO.rayoMorado, 1, 1);
  soundAt(dim, lugar, SONIDO.laserDisparo, 0.75, 0.8);
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
            avisar(dim, olas[i], "morado", t);
            soundAt(dim, olas[i][0], "note.pling", 0.5, 1);
          }
          if (olas[i] && t > t0 && t < t0 + 18 && t % 4 === 0) avisar(dim, olas[i], "morado", t);
          if (t === t0 + 8) cargar(dim, espada(g, lado), "morado");
          if (t === t0 + 14) {
            const variante = i === OLAS - 1 ? 0 : lado;
            cortar(e, variante, lado);
            // Abanico de láseres morados que sale de la hoja (en el corte en X, la otra espada
            // conserva su color).
            tajos(g, variante, variante === 0 ? (lado === 1 ? ["morado", "azul"] : ["amarillo", "morado"]) : "morado");
          }
          if (t === t0 + 18) {
            for (const l of olas[i]) columna(dim, l, "morado", e);
            sonarRayoMorado(dim, olas[i][0]);
          }
        }
        if (t >= dura) fin();
      } catch {
        fin();
      }
    }, 1);
    function fin() {
      system.clearRun(id);
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
