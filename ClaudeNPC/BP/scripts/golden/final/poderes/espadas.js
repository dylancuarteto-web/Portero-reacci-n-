import { GameMode, system } from "@minecraft/server";
import { ANIM, FINAL, GOLDEN_FINAL, PARTICLES, SONIDO } from "../../../config.js";
import { now, particleAt, soundAt } from "../../../util.js";
import { danar } from "../../comun.js";
import { limitar } from "../arena.js";
import {
  NEGRO, animar, bloquear, camara, cortar, forma, fundido, musica, pararMusica, particula, pose, punto, soltar, sonar, sueloBajo, vivos, yawHacia,
} from "../comun.js";

// Espadas: con 500 de vida, una cinemática (se apaga la música) en la que saca una espada
// amarilla y otra azul. Después las usa así: aparecen signos de pregunta donde va a caer un
// rayo; con un corte rapidísimo (estilo Dusttrust: anticipación, corte explosivo en diagonal
// y estela) caen los rayos. Rayo AMARILLO: daña si estás QUIETO. Rayo AZUL: daña si te estás
// MOVIENDO (caminando, corriendo o saltando). Rayo MORADO (v8.2, cuando vuelve morada una de
// las espadas): daña SIEMPRE, quieto o en movimiento.

const RADIO = 2.4;


// --- ¿Se está moviendo? (posiciones de los últimos ticks) ------------------------------
const huellas = new Map();
export function anotarMovimiento(jugadores) {
  for (const p of jugadores) {
    try {
      let h = huellas.get(p.id);
      if (!h) huellas.set(p.id, (h = []));
      h.unshift({ ...p.location });
      if (h.length > 4) h.length = 4;
    } catch {
      // Jugador no disponible.
    }
  }
}

export function seMueve(p) {
  try {
    const h = huellas.get(p.id) ?? [];
    const v = p.getVelocity();
    if (p.isJumping || Math.hypot(v.x, v.z) > 0.04) return true;
    if (h.length >= 3) {
      const a = h[0];
      const b = h[2];
      if (Math.hypot(a.x - b.x, a.z - b.z) > 0.08 || Math.abs(a.y - b.y) > 0.12) return true;
    }
  } catch {
    // Jugador no disponible.
  }
  return false;
}

// Color de un rayo o signo: "amarillo", "azul" o "morado".
const IMPACTO = { amarillo: PARTICLES.impactoAmarillo, azul: PARTICLES.impactoAzul, morado: PARTICLES.impactoMorado };
export const AVISO = { amarillo: PARTICLES.avisoAmarillo, azul: PARTICLES.avisoAzul, morado: PARTICLES.avisoMorado };

export function marca(dim, lugar, color) {
  try {
    return dim.spawnEntity(FINAL.signo, { x: lugar.x, y: lugar.y + 1.7, z: lugar.z }, { spawnEvent: `claudenpc:${color}` });
  } catch {
    return undefined;
  }
}

// ¿Le hace daño este rayo a este jugador? Amarillo si está quieto, azul si se mueve, morado
// siempre.
function alcanza(color, p) {
  if (color === "morado") return true;
  const mueve = seMueve(p);
  return color === "azul" ? mueve : !mueve;
}

export function rayo(dim, lugar, color, golden, conDano = true) {
  let r;
  try {
    r = dim.spawnEntity(FINAL.rayo, { x: lugar.x, y: lugar.y, z: lugar.z }, { spawnEvent: `claudenpc:${color}_${Math.floor(Math.random() * 3)}` });
  } catch {
    r = undefined;
  }
  system.runTimeout(() => {
    try {
      if (r?.isValid) r.remove();
    } catch {
      // Ya no existe.
    }
  }, 12);
  particleAt(dim, IMPACTO[color] ?? PARTICLES.impactoAmarillo, { x: lugar.x, y: lugar.y + 0.1, z: lugar.z });
  particleAt(dim, PARTICLES.fusionDestello, { x: lugar.x, y: lugar.y + 1, z: lugar.z });
  soundAt(dim, lugar, "ambient.weather.lightning.impact", color === "azul" ? 1.3 : color === "morado" ? 0.8 : 1.0, 1);
  if (!conDano) return;
  try {
    for (const p of dim.getPlayers({ location: lugar, maxDistance: RADIO + 2, excludeGameModes: [GameMode.Creative, GameMode.Spectator] })) {
      const d = Math.hypot(p.location.x - lugar.x, p.location.z - lugar.z);
      if (d > RADIO || Math.abs(p.location.y - lugar.y) > 3) continue;
      if (alcanza(color, p)) {
        danar(p, color === "morado" ? GOLDEN_FINAL.danoMorado : GOLDEN_FINAL.danoRayo, golden);
        soundAt(dim, p.location, "random.fizz", 1.6, 0.6);
        if (color === "morado") particleAt(dim, PARTICLES.descargaMorada, { x: p.location.x, y: p.location.y + 1, z: p.location.z });
      }
    }
  } catch {
    // Sin jugadores.
  }
}

export function lugares(dim, j, n, arena) {
  const lista = [sueloBajo(dim, { x: j.location.x, y: j.location.y + 1, z: j.location.z }, 8)];
  for (let i = 1; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 2.5 + Math.random() * 4.5;
    const p = limitar(arena, { x: j.location.x + Math.cos(a) * r, y: j.location.y + 2, z: j.location.z + Math.sin(a) * r }, 2);
    lista.push(sueloBajo(dim, { x: p.x, y: j.location.y + 2, z: p.z }, 8));
  }
  return lista;
}

export default {
  id: "espadas",
  cd: 240,
  si: (c) => c.espadas,
  peso: (_c) => 4,
  usar(g, j) {
    const e = g.entidad;
    const dim = e.dimension;
    const f = g.final;
    g.quietoHasta = now() + 72;
    pose(g, 12);
    const olas = [{ color: "amarillo" }, { color: "azul" }];
    if (Math.random() < 0.4) olas.reverse();
    if (f.espadasHechas && Math.random() < 0.45) olas.push({ color: Math.random() < 0.5 ? "azul" : "amarillo", x: true });
    let t = 0;
    const marcas = [];
    const id = system.runInterval(() => {
      t++;
      try {
        if (!e.isValid || f.etapa !== "pelea" || !j.isValid) return fin();
        olas.forEach((ola, i) => {
          const t0 = 4 + i * 24;
          if (t === t0) {
            ola.lugares = lugares(dim, j, ola.x ? 6 : 4, f.arena);
            for (const l of ola.lugares) {
              const m = marca(dim, l, ola.color);
              if (m) marcas.push(m);
            }
            soundAt(dim, ola.lugares[0], "note.pling", ola.color === "azul" ? 0.7 : 1.4, 1);
          }
          if (ola.lugares && t > t0 && t < t0 + 22 && t % 4 === 0) {
            for (const l of ola.lugares) particula(dim, AVISO[ola.color], { x: l.x, y: l.y + 0.06, z: l.z }, { "variable.radio": RADIO });
          }
          if (t === t0 + 16) cortar(e, ola.x ? 0 : ola.color === "azul" ? 2 : 1); // el corte; los rayos caen en lo más rápido
          if (t === t0 + 20) {
            for (const l of ola.lugares) rayo(dim, l, ola.color, e);
            for (const m of marcas.splice(0)) {
              try {
                if (m.isValid) m.remove();
              } catch {
                // Ya no existe.
              }
            }
          }
        });
        if (t > 4 + olas.length * 24 + 4) fin();
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
    }
    return 8 + olas.length * 24;
  },
};

// --- Cinemática de las espadas (con 500 de vida) ------------------------------------------

export function iniciarCineEspadas(g, vistas) {
  const f = g.final;
  const e = g.entidad;
  f.etapa = "espadas";
  f.control = true;
  f.te = 0;
  f.vistasEspadas = vivos(vistas).filter((p) => {
    try {
      return p.getGameMode() !== GameMode.Spectator;
    } catch {
      return false;
    }
  });
  const c = f.arena ? { x: f.arena.centro.x + 0.5, y: f.arena.centro.y + 1.6, z: f.arena.centro.z + 0.5 } : { ...e.location };
  const j = f.vistasEspadas[0];
  f.puntoEspadas = c;
  f.yawEspadas = j ? yawHacia(c, j.location) : e.getRotation().y;
  f.desdeEspadas = { ...e.location };
  bloquear(f.vistasEspadas);
  pararMusica(f.vistasEspadas); // la música se apaga
  pose(g, 0);
}

export function tickCineEspadas(g) {
  const f = g.final;
  const e = g.entidad;
  const dim = e.dimension;
  const t = ++f.te;
  const v = (f.vistasEspadas = vivos(f.vistasEspadas));
  const P = f.puntoEspadas;
  const yaw = f.yawEspadas;
  if (t <= 16) {
    const k = t / 16;
    e.teleport({ x: f.desdeEspadas.x + (P.x - f.desdeEspadas.x) * k, y: f.desdeEspadas.y + (P.y - f.desdeEspadas.y) * k,
      z: f.desdeEspadas.z + (P.z - f.desdeEspadas.z) * k }, { rotation: { x: 0, y: yaw }, keepVelocity: false });
  } else {
    e.teleport(P, { rotation: { x: 0, y: yaw }, keepVelocity: false });
  }
  if (t === 1) {
    fundido(v, NEGRO, 0.2, 0.2, 0.5);
    sonar(v, "ambient.weather.thunder", 0.5, 0.4);
  }
  if (t === 6) camara(v, punto(P, yaw, 5.2, 0.4, 0), punto(P, yaw, 0, 1.4, 0), 2.6, punto(P, yaw, 4.2, 0.9, 0.6));
  if (t === 22) {
    animar(e, ANIM.goldenSacarEspadas);
    sonar(v, "random.anvil_use", 1.8, 0.7);
  }
  if (t === 34) {
    forma(e, 2); // aparecen las espadas
    sonar(v, "beacon.activate", 1.8, 1);
    sonar(v, SONIDO.corte, 1.2, 1);
  }
  if (t === 38) camara(v, punto(P, yaw, 1.7, 1.5, 2.1), punto(P, yaw, 0.5, 1.2, 0), 1.4, punto(P, yaw, 1.9, 1.7, 1.6));
  if (t === 46) pose(g, 12);
  if (t === 62) camara(v, punto(P, yaw, 3.8, 1.3, 0), punto(P, yaw, 0, 1.3, 0));
  if (t === 68) cortar(e, 0); // corte en X
  if (t === 72) {
    for (let i = 0; i < 4; i++) {
      const a = yaw * (Math.PI / 180) + Math.PI + (i - 1.5) * 0.5;
      const l = sueloBajo(dim, { x: P.x + Math.sin(a) * 7, y: P.y + 2, z: P.z - Math.cos(a) * 7 }, 10);
      rayo(dim, l, i % 2 === 1 ? "azul" : "amarillo", e, false);
    }
    sonar(v, "ambient.weather.thunder", 1, 0.8);
  }
  if (t === 96) fundido(v, NEGRO, 0.2, 0.15, 0.5);
  if (t >= 100) {
    soltar(v);
    musica(v, SONIDO.combate, true, 1.5); // vuelve la música
    f.etapa = "pelea";
    f.control = false;
    f.espadasHechas = true;
    f.ocupadoHasta = now() + 30;
    f.cd.poder = now() + 40;
    f.cd.espadas = 0;
  }
}
