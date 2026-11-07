import { caminarA, caminando, detener, saltando } from "../movimiento.js";
import { blockAt, esAgua, flat, impulse, mirarA, now, reemplazable } from "../util.js";
import { gesto } from "./animacion.js";
import { niveles } from "./determinacion.js";
import { puede } from "./fases.js";

// MovementController: se mueve como un jugador con impulsos que el motor de físicas del
// juego aplica (con fricción, choques y gravedad): nada de teletransportes. Si hay una
// pared de dos bloques en el camino, usa la caminata con búsqueda de camino de los Claudes.
//
// s.mov = { modo, obj, hasta, lado, radio, punto, correr, saltos, predecir, fin, luego }
//   quieto · hacia (obj, hasta) · lejos (obj, hasta) · lado (obj, lado, radio) · punto (punto)
//
// Técnicas (Bedrock no tiene las mismas teclas que Java, así que se adaptan):
//   W-tap / sprint reset: frena 2 ticks y vuelve a correr; el siguiente golpe es un golpe
//     corriendo (más empuje). S-tap: un paso atrás justo después de golpear. Jump reset: al
//     recibir un golpe salta en ese tick y pierde parte del empuje. Strafe: pasos laterales
//     alrededor del rival cambiando de lado.

export const RAPIDEZ = { caminar: 0.19, correr: 0.28, lado: 0.17, lento: 0.07 };

export function mover(s, modo, op = {}) {
  s.mov = { modo, ...op, desde: now() };
}

function libre(b) {
  return !b || reemplazable(b) || (!b.isLiquid && /(carpet|torch|_sign|rail|_button|pressure_plate|snow_layer)$/.test(b.typeId));
}

function delante(e, d, alto, lejos = 0.7) {
  return blockAt(e.dimension, { x: e.location.x + d.x * lejos, y: e.location.y + alto, z: e.location.z + d.z * lejos });
}

// Pared de dos bloques delante (no se sube saltando).
export function pared(e, d) {
  const pie = delante(e, d, 0.3);
  const cabeza = delante(e, d, 1.3);
  return !libre(pie) && !pie.isLiquid && !libre(cabeza);
}

// Escalón de un bloque delante con espacio encima.
function escalon(e, d) {
  const pie = delante(e, d, 0.3);
  return !libre(pie) && !pie.isLiquid && libre(delante(e, d, 1.3)) && libre(delante(e, d, 2.3))
    && !/(fence|_wall|_pane|iron_bars|campfire)$/.test(pie.typeId);
}

// Caída de más de 3 bloques o lava delante.
export function precipicio(e, d) {
  const x = e.location.x + d.x * 0.8;
  const z = e.location.z + d.z * 0.8;
  const y = Math.floor(e.location.y);
  for (let h = 0; h <= 4; h++) {
    const b = blockAt(e.dimension, { x, y: y - h, z });
    if (!b) return false;
    if (b.typeId.includes("lava")) return true;
    if (h > 0 && !libre(b)) return false;
    if (b.isLiquid) return false;
  }
  return true;
}

// ¿Tiene una pared detrás (respecto del rival)? Para no dejarse acorralar.
export function acorralado(e, obj) {
  const d = flat(obj.location, e.location);
  return pared(e, d) || precipicio(e, d);
}

function frenar(e, k = 0.6) {
  try {
    if (!e.isOnGround) return;
    const v = e.getVelocity();
    impulse(e, { x: -v.x * k, y: 0, z: -v.z * k });
  } catch {
    // Entidad descargada.
  }
}

function norm(x, z) {
  const l = Math.hypot(x, z) || 1;
  return { x: x / l, z: z / l };
}

// Cada tick (lo llama index.js).
export function moverTick(e, s) {
  if (caminando(e) || saltando(e)) return; // la caminata con búsqueda de camino manda
  const m = s.mov;
  if (!m) return;
  if (m.fin !== undefined && now() >= m.fin) {
    s.mov = m.luego ? { ...m.luego, desde: now() } : { modo: "quieto" };
    return;
  }
  if (now() < (m.pausaHasta ?? 0)) {
    frenar(e, 0.8);
    return;
  }
  const obj = m.obj;
  if (obj && !obj.isValid) {
    s.mov = { modo: "quieto" };
    return;
  }
  if (m.modo === "quieto") {
    frenar(e);
    if (obj) mirarA(e, obj.getHeadLocation());
    s.sprintDesde = 0;
    return;
  }
  let dir;
  let rapidez = RAPIDEZ.caminar;
  let meta;
  let dist = 0;
  if (m.modo === "hacia") {
    meta = obj.location;
    if (m.predecir) {
      const vo = obj.getVelocity();
      const t = Math.min(10, flat(e.location, meta).d / RAPIDEZ.correr);
      meta = { x: meta.x + vo.x * t, y: meta.y, z: meta.z + vo.z * t };
    }
    const d = flat(e.location, meta);
    dist = d.d;
    if (dist <= (m.hasta ?? 2.6)) {
      frenar(e, 0.5);
      mirarA(e, obj.getHeadLocation());
      return;
    }
    dir = d;
    rapidez = m.correr ? RAPIDEZ.correr : RAPIDEZ.caminar;
    // Zigzag contra arqueros (fase 9+): se acerca cambiando de lado para que no le acierten.
    if (m.zigzag) {
      const lado = Math.sin(now() / 7) > 0 ? 1 : -1;
      dir = norm(d.x - d.z * lado * 0.55, d.z + d.x * lado * 0.55);
    }
  } else if (m.modo === "lejos") {
    const d = flat(obj.location, e.location);
    dist = d.d;
    if (dist >= (m.hasta ?? 10)) {
      frenar(e);
      return;
    }
    dir = d;
    rapidez = RAPIDEZ.correr;
  } else if (m.modo === "lado") {
    const d = flat(e.location, obj.location);
    dist = d.d;
    const radio = m.radio ?? dist;
    const corr = Math.max(-0.8, Math.min(0.8, (dist - radio) * 0.6));
    dir = norm(-d.z * m.lado + d.x * corr, d.x * m.lado + d.z * corr);
    rapidez = m.rapidez ?? RAPIDEZ.lado;
  } else if (m.modo === "punto") {
    meta = m.punto;
    const d = flat(e.location, meta);
    dist = d.d;
    if (dist <= (m.hasta ?? 0.6)) {
      frenar(e);
      s.mov = m.luego ? { ...m.luego, desde: now() } : { modo: "quieto", obj };
      return;
    }
    dir = d;
    rapidez = m.correr ? RAPIDEZ.correr : RAPIDEZ.caminar;
  } else {
    return;
  }
  if (now() < (s.velocidadHasta ?? 0)) rapidez *= 1.2;
  if (s.escudoArriba || s.comiendo) rapidez = Math.min(rapidez, RAPIDEZ.lento);
  rapidez *= 0.88 + 0.12 * niveles(s).movimiento;
  const enAgua = e.isInWater;
  // Obstáculos.
  if (!enAgua && pared(e, dir)) {
    if (meta && (m.modo === "hacia" || m.modo === "punto")) {
      caminarA(e, meta, rapidez);
      return;
    }
    if (m.modo === "lado") m.lado = -m.lado;
    frenar(e);
    return;
  }
  if (!enAgua && e.isOnGround && !m.permiteCaer && precipicio(e, dir)) {
    if (m.modo === "lado") m.lado = -m.lado;
    frenar(e, 1);
    return;
  }
  try {
    const v = e.getVelocity();
    const k = e.isOnGround ? 1.8 : enAgua ? 0.9 : 0.35;
    const freno = e.isOnGround ? 1 : enAgua ? 0.5 : 0.3;
    let vy = 0;
    let impulso = 1;
    if (enAgua) {
      if (esAgua(blockAt(e.dimension, { x: e.location.x, y: e.location.y + 1.5, z: e.location.z }))) vy = 0.05;
    } else if (e.isOnGround && escalon(e, dir)) {
      vy = 0.42; // sube el escalón saltando, como un jugador
    } else if (e.isOnGround && m.saltos && dist > 5 && now() >= (s.cd.saltoMov ?? 0)) {
      vy = 0.42; // sprint-jump para perseguir
      impulso = 1.25;
      s.cd.saltoMov = now() + 13;
    }
    impulse(e, { x: dir.x * rapidez * k * impulso - v.x * freno, y: vy, z: dir.z * rapidez * k * impulso - v.z * freno });
  } catch {
    return;
  }
  // Mira al rival mientras pelea (o hacia donde va).
  if (obj) mirarA(e, obj.getHeadLocation());
  else if (meta) mirarA(e, { x: meta.x, y: e.location.y + 1.6, z: meta.z });
  // Sprint: corriendo hacia el rival 3 ticks seguidos cuenta como golpe corriendo.
  if (m.modo === "hacia" && m.correr && e.isOnGround) {
    if (!s.sprintDesde) s.sprintDesde = now();
    if (now() - s.sprintDesde >= 3) s.sprint = true;
  } else if (m.modo !== "hacia") {
    s.sprintDesde = 0;
  }
}

// --- Técnicas ---------------------------------------------------------------------------

export function acercar(s, obj, op = {}) {
  mover(s, "hacia", { obj, hasta: op.hasta ?? 2.6, correr: op.correr ?? puede(s, "correrAtacar"),
    saltos: op.saltos ?? puede(s, "perseguir"), predecir: puede(s, "persecucionInteligente"), zigzag: op.zigzag });
}

export function perseguir(s, obj) {
  acercar(s, obj, { hasta: 2.4, correr: true, saltos: true });
}

export function retroceder(s, obj, hasta = 9) {
  mover(s, "lejos", { obj, hasta });
}

export function strafe(s, obj, lado, ticks = 10, radio) {
  s.lado = lado;
  mover(s, "lado", { obj, lado, radio, fin: now() + ticks, luego: { modo: "quieto", obj } });
}

// W-tap / sprint reset: frena un momento y vuelve a correr hacia el rival.
export function wtap(e, s, obj) {
  s.sprint = false;
  s.sprintDesde = 0;
  mover(s, "hacia", { obj, hasta: 1.2, correr: true, pausaHasta: now() + 2, fin: now() + 7, luego: { modo: "quieto", obj } });
}

// S-tap: un paso atrás justo después del golpe (para no recibir el contragolpe).
export function stap(e, s, obj) {
  s.sprint = false;
  try {
    const d = flat(obj.location, e.location);
    if (!pared(e, d) && !precipicio(e, d)) impulse(e, { x: d.x * 0.3, y: 0, z: d.z * 0.3 });
  } catch {
    // Sin paso.
  }
  mover(s, "quieto", { obj, fin: now() + 4, luego: { modo: "hacia", obj, hasta: 2.6, correr: true } });
}

// Jump reset: al recibir un golpe salta en ese mismo tick y frena el empuje horizontal.
export function jumpReset(e) {
  try {
    if (!e.isOnGround) return false;
    const v = e.getVelocity();
    impulse(e, { x: -v.x * 0.6, y: 0.42, z: -v.z * 0.6 });
    return true;
  } catch {
    return false;
  }
}

// Salto (hacia el rival si se da): para los críticos y los ataques aéreos.
export function saltar(e, s, obj, fuerza = 0.42, avance = 0.18) {
  try {
    if (!e.isOnGround && !e.isInWater) return false;
    const d = obj ? flat(e.location, obj.location) : { x: 0, z: 0 };
    impulse(e, { x: d.x * avance, y: fuerza, z: d.z * avance });
    s.alturaMax = e.location.y;
    return true;
  } catch {
    return false;
  }
}

// Esquiva: paso lateral rápido (fase 9+).
export function esquivar(e, s, obj) {
  try {
    const d = flat(e.location, obj.location);
    let lado = Math.random() < 0.5 ? 1 : -1;
    const lateral = (l) => ({ x: -d.z * l, z: d.x * l });
    if (pared(e, lateral(lado)) || precipicio(e, lateral(lado))) lado = -lado;
    const l = lateral(lado);
    impulse(e, { x: l.x * 0.42, y: e.isOnGround ? 0.12 : 0, z: l.z * 0.42 });
    gesto(e, s, "esquiva", true);
    s.esquivoEn = now();
    return true;
  } catch {
    return false;
  }
}

// Reposicionarse al costado (o detrás) del rival; con "terreno" prefiere un sitio más alto.
export function reposicionar(e, s, obj) {
  try {
    const d = flat(obj.location, e.location);
    const lado = s.lado ?? 1;
    const opciones = [
      { x: obj.location.x - d.z * lado * 3, z: obj.location.z + d.x * lado * 3 },
      { x: obj.location.x + d.z * lado * 3, z: obj.location.z - d.x * lado * 3 },
    ];
    let mejor = opciones[0];
    if (puede(s, "terreno")) {
      let alto = -Infinity;
      for (const o of opciones) {
        const y = alturaLibre(e, o);
        if (y !== undefined && y > alto) {
          alto = y;
          mejor = o;
        }
      }
    }
    const y = alturaLibre(e, mejor) ?? e.location.y;
    mover(s, "punto", { obj, punto: { x: mejor.x, y, z: mejor.z }, hasta: 0.8, correr: true, fin: now() + 30, luego: { modo: "quieto", obj } });
    return true;
  } catch {
    return false;
  }
}

// Altura del suelo libre cerca de (x, z) entre su altura -2 y +2.
function alturaLibre(e, p) {
  const y0 = Math.floor(e.location.y);
  for (let y = y0 + 2; y >= y0 - 2; y--) {
    const piso = blockAt(e.dimension, { x: p.x, y: y - 1, z: p.z });
    if (piso && !libre(piso) && !piso.isLiquid && libre(blockAt(e.dimension, { x: p.x, y, z: p.z }))
      && libre(blockAt(e.dimension, { x: p.x, y: y + 1, z: p.z }))) return y;
  }
  return undefined;
}

// Altura (fase 9+): si hay un bloque más alto al lado, se sube para pelear desde arriba.
export function buscarAltura(e, s, obj) {
  if (!puede(s, "altura")) return false;
  const y0 = Math.floor(e.location.y);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    const p = { x: Math.floor(e.location.x) + dx + 0.5, z: Math.floor(e.location.z) + dz + 0.5 };
    if (alturaLibre(e, p) === y0 + 1) {
      mover(s, "punto", { obj, punto: { x: p.x, y: y0 + 1, z: p.z }, hasta: 0.4, fin: now() + 20, luego: { modo: "quieto", obj } });
      return true;
    }
  }
  return false;
}

export function pararTodo(e, s) {
  detener(e);
  s.mov = { modo: "quieto" };
  frenar(e, 1);
}
