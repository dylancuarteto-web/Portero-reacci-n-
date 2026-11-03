import { system } from "@minecraft/server";
import { ANIM, FINAL, GOLDEN_FINAL, PARTICLES, SONIDO } from "../../config.js";
import { now, particleAt } from "../../util.js";
import { crearArena, guardarTerreno, llevarDentro, ponerArena, prepararArena } from "./arena.js";
import {
  AMARILLO, DORADO, NEGRO, animar, arcoiris, barra, bloquear, borrarTextos, camara, escribir, forma, fundido, jugadoresCerca,
  lerp, letras, musica, particula, pose, punto, solidoEn, soltar, sonar, sueloBajo, suave, temblar, titulo, vivos, yawHacia,
} from "./comun.js";
import { empezarPelea } from "./pelea.js";

// Fase final de Claude Golden, parte 1: herido (sombra en los ojos, baja al suelo y se
// arrodilla) y la cinemática del corazón dorado, hecha al compás de la canción del corazón
// (140 pulsos por minuto; un compás = 34,3 ticks). Tiempos en ticks desde que suena:
//   22   frase 1 (dos tomas)            147-171 transición suave (fundido a negro)
//   159  frase 2 y tomas distintas      262  frase 3; se levanta
//   296  de frente alza el brazo        330  aparece el corazón y lo ilumina todo
//   364  negro que parpadea; solo el corazón girando y el texto con CREATIVO temblando
//   571  vuelve la imagen; absorbe el corazón; destello amarillo: alas y corona (600)
//   660  de lado, chasquea los dedos: destello y aparece la arena dorada (672)
//   700  "Esta vez estás M-U-E-R-T-O" letra por letra; 800 empieza la batalla

const FIN = 800;
const TXT1 = "§fNo puedo creer que con todo el poder\n§fmás fuerte que el dragón del End me sigas\n§fvenciendo... §e¿realmente esto es normal?";
const TXT2 = "§fNo sé qué hacer para vencerte...";
const TXT3 = "§fBueno... §equizás tengo algo más que mostrar";
const TXT_A = "§fAhora este poder alcanza poderes inimaginables,";
const TXT_B = "§feste nivel alcanza a un nivel ";
const MUERTO = "M-U-E-R-T-O";

function quitar(e) {
  try {
    if (e?.isValid) e.remove();
  } catch {
    // Ya no existe.
  }
}

function aparecer(dim, id, pos, evento) {
  // "evento" se aplica al nacer (por ejemplo el tamaño del corazón).
  try {
    return dim.spawnEntity(id, pos, evento ? { spawnEvent: evento } : undefined);
  } catch {
    return undefined;
  }
}

// --- Herido -------------------------------------------------------------------------------

export function iniciarHerido(g, jugador) {
  const e = g.entidad;
  const dim = e.dimension;
  const suelo = sueloBajo(dim, e.location, 64);
  const yaw = jugador?.isValid ? yawHacia(e.location, jugador.location) : e.getRotation().y;
  g.final = { etapa: "herido", t: 0, control: true, jugadores: new Set(), desde: { ...e.location }, suelo, yaw, inicio: now() };
  pose(g, 2); // baja agachado (encorvado, con la cabeza gacha)
  particleAt(dim, PARTICLES.estallido, { x: e.location.x, y: e.location.y + 1, z: e.location.z });
  soundAtTodos(dim, e.location, "beacon.deactivate", 0.6, 1.5);
}

function soundAtTodos(dim, pos, id, pitch, vol) {
  try {
    dim.playSound(id, pos, { pitch, volume: vol });
  } catch {
    // Sin sonido.
  }
}

function mover(g, pos) {
  try {
    g.entidad.teleport(pos, { rotation: { x: 0, y: g.final.yaw }, keepVelocity: false });
  } catch {
    // Descargado.
  }
}

export function tickHerido(g) {
  const f = g.final;
  const e = g.entidad;
  const t = ++f.t;
  const dim = e.dimension;
  if (t <= 50) {
    // Baja herido, cada vez más rápido y tambaleándose.
    const k = (t / 50) ** 2;
    const p = lerp(f.desde, f.suelo, k);
    mover(g, { x: p.x + Math.sin(t * 0.7) * 0.04 * (1 - k), y: p.y, z: p.z + Math.cos(t * 0.5) * 0.04 * (1 - k) });
    if (t % 3 === 0) particleAt(dim, PARTICLES.chispaCae, { x: e.location.x, y: e.location.y + 1.4, z: e.location.z });
    if (t % 6 === 0) particleAt(dim, PARTICLES.polvo, { x: e.location.x, y: e.location.y + 0.8, z: e.location.z });
  } else {
    mover(g, { x: f.suelo.x + (Math.random() - 0.5) * 0.02, y: f.suelo.y, z: f.suelo.z + (Math.random() - 0.5) * 0.02 });
  }
  if (t === 50) {
    pose(g, 1); // aterriza agachado (una pierna adelante, la mano hacia el suelo), con la sombra en los ojos
    soundAtTodos(dim, f.suelo, "random.anvil_land", 0.5, 1);
    for (let i = 0; i < 4; i++) particleAt(dim, PARTICLES.polvo, { x: f.suelo.x + Math.random() - 0.5, y: f.suelo.y + 0.2, z: f.suelo.z + Math.random() - 0.5 });
  }
  if (t === 85) empezarCine(g);
}

// --- Cinemática del corazón ------------------------------------------------------------------

// Lugar alto y despejado para la caja negra (solo se ve el corazón).
function buscarVacio(dim, c) {
  let tope = 300;
  try {
    tope = dim.heightRange.max - 8;
  } catch {
    // Por defecto.
  }
  const candidatos = [{ x: c.x, y: c.y + 40, z: c.z }, { x: c.x, y: c.y + 26, z: c.z }, { x: c.x + 30, y: c.y + 24, z: c.z },
    { x: c.x, y: c.y + 60, z: c.z }, { x: c.x - 30, y: c.y + 24, z: c.z }];
  for (const v of candidatos) {
    v.y = Math.min(v.y, tope);
    let libre = true;
    for (let dx = -3; dx <= 3 && libre; dx += 3) {
      for (let dy = -3; dy <= 3 && libre; dy += 3) {
        for (let dz = -3; dz <= 3 && libre; dz += 3) {
          if (solidoEn(dim, { x: v.x + dx, y: v.y + dy, z: v.z + dz })) libre = false;
        }
      }
    }
    if (libre) return { x: v.x + 0.5, y: v.y + 0.5, z: v.z + 0.5 };
  }
  return { x: c.x + 0.5, y: Math.min(c.y + 40, tope) + 0.5, z: c.z + 0.5 };
}

export function empezarCine(g) {
  const f = g.final;
  const e = g.entidad;
  const dim = e.dimension;
  f.etapa = "cine";
  f.t = 0;
  f.centro = { x: Math.floor(f.suelo.x), y: Math.floor(f.suelo.y), z: Math.floor(f.suelo.z) };
  f.arena = crearArena(e.id, dim, f.centro);
  guardarTerreno(f.arena);
  prepararArena(f.arena);
  f.vistas = jugadoresCerca(dim, e.location, GOLDEN_FINAL.radioCine);
  for (const p of f.vistas) f.jugadores.add(p.id);
  f.vacio = buscarVacio(dim, f.centro);
  try {
    e.setDynamicProperty("claudenpc:final", JSON.stringify({ etapa: "cine", centro: f.centro, yaw: f.yaw }));
  } catch {
    // Sin propiedades dinámicas.
  }
  if (!f.vistas.length) {
    // Nadie para ver la cinemática: la arena aparece y empieza la batalla.
    ponerArena(f.arena);
    forma(e, 1);
    pose(g, 0);
    empezarPelea(g);
    return;
  }
  bloquear(f.vistas);
  musica(f.vistas, SONIDO.corazon, false, 0);
  fundido(f.vistas, NEGRO, 0, 0.3, 0.8);
  tomaInicial(g);
}

function tomaInicial(g) {
  const { suelo: G, yaw } = g.final;
  camara(g.final.vistas, punto(G, yaw, 6.5, 0.7, -2.6), punto(G, yaw, 0, 0.9, 0), 4.4, punto(G, yaw, 5.0, 0.9, -1.9));
}

// Texto que se va escribiendo en la barra de acción (con un clic suave por letra).
function escribirBarra(f, texto, desde, porTick, t) {
  const n = Math.floor((t - desde) * porTick);
  if (n < 0) return false;
  const total = letras(texto);
  if (n <= total) {
    barra(f.vistas, escribir(texto, n));
    if (n % 2 === 0 && n < total) sonar(f.vistas, "random.click", 1.8, 0.12);
    return true;
  }
  return false;
}

export function tickCine(g) {
  const f = g.final;
  const e = g.entidad;
  const dim = e.dimension;
  const t = ++f.t;
  const v = (f.vistas = vivos(f.vistas));
  const G = f.suelo;
  const yaw = f.yaw;
  const cam = (desde, mira, seg, hasta) => camara(v, desde, mira, seg, hasta);
  const corte = () => fundido(v, NEGRO, 0.15, 0.1, 0.25);

  // Golden: de rodillas hasta que se levanta (262); después flota en su lugar.
  mover(g, t < 262 ? { x: G.x + (Math.random() - 0.5) * 0.015, y: G.y, z: G.z + (Math.random() - 0.5) * 0.015 } : G);

  // --- Frase 1 (dos tomas) ---
  if (t >= 22 && t < 150) {
    if (!escribirBarra(f, TXT1, 22, 2, t) && t % 20 === 0) barra(v, TXT1);
  }
  if (t === 86) corte();
  if (t === 90) cam(punto(G, yaw, 2.1, 1.0, 2.7), punto(G, yaw, 0, 0.95, 0), 3, punto(G, yaw, 1.8, 0.95, 2.0));
  // --- Transición suave y frase 2 con tomas distintas ---
  if (t === 147) fundido(v, NEGRO, 0.6, 0.3, 0.6);
  if (t === 160) cam(punto(G, yaw, 1.6, 1.2, 0.35), punto(G, yaw, 0, 1.0, 0), 1.7, punto(G, yaw, 1.35, 1.15, 0.2));
  if (t >= 165 && t < 262) {
    if (!escribirBarra(f, TXT2, 165, 0.8, t) && t % 20 === 0) barra(v, TXT2);
  }
  if (t === 189 || t === 224 || t === 258) corte();
  if (t === 193) cam(punto(G, yaw, -2.4, 4.2, 1.6), punto(G, yaw, 0, 0.7, 0), 1.7, punto(G, yaw, -2.0, 3.8, -0.8));
  if (t === 228) cam(punto(G, yaw, 1.1, 0.2, -3.0), punto(G, yaw, 0, 0.9, 0), 1.7, punto(G, yaw, 1.6, 0.25, -2.6));
  // --- Frase 3: se levanta ---
  if (t === 262) cam(punto(G, yaw, 4.4, 1.3, 0), punto(G, yaw, 0, 1.3, 0), 1.7, punto(G, yaw, 4.0, 1.4, 0));
  if (t === 264) pose(g, 2); // se levanta: primero agachado y luego de pie
  if (t >= 266 && t < 296) {
    if (!escribirBarra(f, TXT3, 266, 1.5, t) && t % 20 === 0) barra(v, TXT3);
  }
  if (t === 286) pose(g, 0);
  // --- De frente: alza el brazo derecho y aparece el corazón dorado ---
  const H = punto(G, yaw, 0.1, 2.75, 0.35);
  if (t === 296) {
    borrarTextos(v);
    cam(punto(G, yaw, 4.6, 1.2, 0), punto(G, yaw, 0, 2.0, 0), 1.6, punto(G, yaw, 4.2, 1.4, 0));
    pose(g, 3);
    sonar(v, "beacon.power", 0.6, 1);
    particleAt(dim, PARTICLES.fusionEspiral, H);
  }
  if (t > 296 && t < 330 && (t - 296) % 8 === 0) particleAt(dim, PARTICLES.converge, H);
  if (t === 312) sonar(v, SONIDO.carga, 0.8, 0.45);
  if (t === 330) {
    f.corazon = aparecer(dim, FINAL.corazon, H, "claudenpc:tam_16");
    particleAt(dim, PARTICLES.destelloCorazon, H);
    particleAt(dim, PARTICLES.fusionDestello, H);
    fundido(v, DORADO, 0.05, 0.25, 1.4); // ilumina todo; después se ve claramente
    sonar(v, "random.levelup", 0.6, 1);
    sonar(v, "beacon.activate", 1.4, 1);
    sonar(v, SONIDO.latido, 1, 1);
    cam(punto(G, yaw, 4.2, 1.6, 0), H, 1.6, punto(G, yaw, 2.9, 2.3, 0.25));
  }
  if (t > 330 && t < 571 && f.corazon?.isValid) f.corazon.teleport(H);
  // --- Negro que parpadea: solo el corazón girando (caja negra lejos de todo) ---
  const V = f.vacio;
  const ojoVacio = (d) => ({ x: V.x + Math.cos(0.6) * d, y: V.y, z: V.z + Math.sin(0.6) * d });
  const miraVacio = { x: V.x, y: V.y - 0.45, z: V.z };
  if (t === 362) {
    f.fondo = aparecer(dim, FINAL.fondo, V);
    f.corazon2 = aparecer(dim, FINAL.corazon, V, "claudenpc:tam_22");
  }
  if ([364, 372, 381].includes(t)) {
    cam(ojoVacio(2.9), miraVacio);
    sonar(v, SONIDO.latido, 1, 1);
  }
  if ([368, 377].includes(t)) cam(punto(G, yaw, 2.9, 2.3, 0.25), H);
  if (t === 382) {
    const fin = { x: V.x + Math.cos(0.95) * 2.3, y: V.y, z: V.z + Math.sin(0.95) * 2.3 };
    cam(ojoVacio(2.9), miraVacio, 9, fin);
  }
  if (t >= 381 && t < 571) {
    if (t % 20 === 1) particula(dim, PARTICLES.lluviaDorada, { x: V.x, y: V.y + 3.2, z: V.z });
    if (t % 17 === 0) particleAt(dim, PARTICLES.converge, V);
    if (f.corazon2?.isValid) f.corazon2.teleport(V);
  }
  if (t >= 433 && t < 571 && (t - 433) % 17 === 0) particleAt(dim, PARTICLES.destelloCorazon, V); // late con la música
  if (t >= 399 && t < 566) {
    const a = escribir(TXT_A, Math.floor((t - 399) * 1.5));
    const b = t >= 433 ? escribir(TXT_B, Math.floor((t - 433) * 1.5)) : "";
    const creativo = t >= 467 ? temblar("CREATIVO") : "";
    const escribiendo = (t < 433 && Math.floor((t - 399) * 1.5) <= letras(TXT_A)) || (t >= 433 && t < 467);
    if (escribiendo || t >= 467 ? true : t % 10 === 0) barra(v, `${a}\n${b}${creativo}`);
    if (escribiendo && t % 2 === 0) sonar(v, "random.click", 1.8, 0.1);
  }
  if (t === 467) {
    sonar(v, SONIDO.latido, 0.8, 1);
    sonar(v, "ambient.weather.thunder", 0.6, 0.45);
  }
  // --- Vuelve la imagen: absorbe el corazón ---
  const PECHO = punto(G, yaw, 0.3, 1.25, 0);
  if (t === 571) {
    quitar(f.fondo);
    quitar(f.corazon2);
    borrarTextos(v);
    cam(punto(G, yaw, 3.0, 1.9, 0.1), punto(G, yaw, 0, 2.0, 0.2));
  }
  if (t === 575) {
    pose(g, 4);
    sonar(v, "mob.endermen.portal", 0.5, 0.8);
  }
  if (t > 575 && t < 600 && f.corazon?.isValid) {
    const k = suave((t - 575) / 25);
    f.corazon.teleport(lerp(H, PECHO, k));
    if (t === 582) f.corazon.triggerEvent("claudenpc:tam_12"); // se encoge mientras entra en su pecho
    if (t === 589) f.corazon.triggerEvent("claudenpc:tam_08");
    if (t === 595) f.corazon.triggerEvent("claudenpc:tam_04");
    if (t % 4 === 0) particleAt(dim, PARTICLES.auraDorada, f.corazon.location);
  }
  if (t === 590) sonar(v, "random.orb", 0.5, 0.8);
  // --- Destello amarillo: alas y corona ---
  if (t === 600) {
    quitar(f.corazon);
    fundido(v, AMARILLO, 0.1, 0.6, 1.0);
    sonar(v, "random.totem", 1, 1);
    sonar(v, "random.levelup", 1.2, 0.8);
    sonar(v, "beacon.activate", 0.8, 1);
  }
  if (t === 603) {
    forma(e, 1); // alas y corona
    pose(g, 5);
    animar(e, ANIM.goldenAlasBatir);
    particleAt(dim, PARTICLES.plumas, { x: G.x, y: G.y + 1.5, z: G.z });
    particleAt(dim, PARTICLES.fusionDestello, { x: G.x, y: G.y + 1.5, z: G.z });
  }
  if (t === 604) cam(punto(G, yaw, 4.0, 0.5, 0.7), punto(G, yaw, 0, 1.9, 0), 2.4, punto(G, yaw, 3.3, 0.9, 0.4));
  // --- De lado (cabeza, cuerpo y brazo izquierdo): chasquido y la arena dorada ---
  if (t === 656) pose(g, 6);
  if (t === 660) cam(punto(G, yaw, 0.9, 3.0, -2.3), punto(G, yaw, 0.2, 1.6, -0.35), 0.6, punto(G, yaw, 0.8, 2.9, -2.1));
  if (t === 664) animar(e, ANIM.goldenChasquidoIzq);
  if (t === 670) sonar(v, SONIDO.chasquido, 1, 1);
  if (t === 671) fundido(v, AMARILLO, 0.05, 0.5, 0.9);
  if (t === 674) {
    ponerArena(f.arena);
    llevarDentro(f.arena, v); // todos dentro de la arena cerrada
    pose(g, 0);
  }
  const A = f.arena ? { x: f.arena.centro.x + 0.5, y: f.arena.centro.y, z: f.arena.centro.z + 0.5 } : G;
  if (t === 690) {
    cam(punto(A, yaw + 40, 17, 8.5, 0), { x: A.x, y: A.y + 1.5, z: A.z }, 3.4, punto(A, yaw - 25, 15, 6.5, 0));
    particleAt(dim, PARTICLES.fusionAnillo, { x: A.x, y: A.y + 0.2, z: A.z });
    sonar(v, "beacon.activate", 0.7, 1);
    sonar(v, "block.bell.hit", 0.8, 0.8);
  }
  if (t > 676 && t < FIN && t % 10 === 0) mover(g, { x: G.x, y: G.y + 0.4, z: G.z });
  // --- "Esta vez estás M-U-E-R-T-O" ---
  const esta = arcoiris("Esta vez estás");
  if (t >= 700 && t < 790) {
    const n = t - 700;
    if (n <= 14) barra(v, escribir(esta, n));
    else if (t % 20 === 0) barra(v, esta);
  }
  if (t === 716) cam(punto(G, yaw, 2.3, 1.7, 0), punto(G, yaw, 0, 1.95, 0), 3, punto(G, yaw, 1.9, 1.8, 0));
  if (t >= 718 && t < 790) {
    const k = Math.min(6, 1 + Math.floor((t - 718) / 7));
    if ((t - 718) % 7 === 0 && k <= 6 && t - 718 < 42) {
      sonar(v, SONIDO.latido, 0.8, 1);
      if (k === 6) sonar(v, "mob.enderdragon.growl", 0.8, 0.8);
    }
    if (t % 2 === 0) titulo(v, temblar(MUERTO.slice(0, k * 2 - 1)), " ", 0, 6, 0);
  }
  if (t === 788) fundido(v, NEGRO, 0.3, 0.2, 0.6);
  if (t >= FIN) terminarCine(g);
}

export function terminarCine(g) {
  const f = g.final;
  quitar(f.fondo);
  quitar(f.corazon);
  quitar(f.corazon2);
  borrarTextos(f.vistas ?? []);
  soltar(f.vistas ?? []);
  if (f.arena && !f.arena.puesta) ponerArena(f.arena);
  forma(g.entidad, 1);
  pose(g, 0);
  system.run(() => empezarPelea(g));
}
