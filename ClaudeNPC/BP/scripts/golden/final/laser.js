import { GameMode, system } from "@minecraft/server";
import { FINAL, SONIDO } from "../../config.js";
import { soundAt } from "../../util.js";
import { danar } from "../comun.js";
import { particula, punto } from "./comun.js";

// Láseres de energía de Claude Golden (v9.0). Reemplazan a los rayos: son haces RECTOS de
// energía concentrada (nada de zigzag ni ramas eléctricas):
//   - núcleo casi blanco que brilla y dos capas de halo de color (aditivas) por las que corren
//     pulsos de energía;
//   - destello rápido al aparecer (el haz se ensancha y vuelve) y el haz "sale" hasta su largo;
//   - motas de energía alrededor y una cinta de brillo a lo largo;
//   - al terminar se apaga encogiéndose.
// Cada haz tiene su propio largo (hasta 64 bloques), dirección e inclinación, color y grosor
// (fino, normal, grueso, enorme). La entidad es claudenpc:laser_golden (ver
// source/v90_assets.py): el giro es la rotación con la que aparece y la inclinación, el largo y
// el estilo se ponen con eventos en el mismo tick (no dependen de animaciones que se pierdan).

export const COLORES = ["amarillo", "azul", "morado", "oro"];
export const GROSOR = { fino: 0, normal: 1, grueso: 2, enorme: 3 };
const ANCHO = [0.12, 0.22, 0.42, 0.75]; // media anchura de la cinta de brillo
const ALCANCE = [0.4, 0.6, 0.95, 1.5]; // a qué distancia del eje del haz hace daño
const PASO = 0.5;
const MAX = 128;
const TONO = { amarillo: 1.05, azul: 1.3, morado: 0.8, oro: 0.92 };

export function medir(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const horiz = Math.hypot(dx, dz);
  const largo = Math.hypot(horiz, dy);
  return {
    dx, dy, dz, horiz, largo,
    yaw: (Math.atan2(-dx, dz) * 180) / Math.PI,
    pitch: (-Math.atan2(dy, horiz) * 180) / Math.PI, // positivo: hacia abajo
    dir: largo > 0 ? { x: dx / largo, y: dy / largo, z: dz / largo } : { x: 0, y: -1, z: 0 },
  };
}

// Punto a "d" bloques desde "a" en la dirección dada por yaw (como el de las entidades) y
// pitch (positivo: hacia abajo).
export function hacia(a, yaw, pitch, d) {
  const y = (yaw * Math.PI) / 180;
  const p = (pitch * Math.PI) / 180;
  return { x: a.x - Math.sin(y) * Math.cos(p) * d, y: a.y - Math.sin(p) * d, z: a.z + Math.cos(y) * Math.cos(p) * d };
}

function distSegmento(p, a, m) {
  const t = Math.max(0, Math.min(m.largo, (p.x - a.x) * m.dir.x + (p.y - a.y) * m.dir.y + (p.z - a.z) * m.dir.z));
  return Math.hypot(p.x - (a.x + m.dir.x * t), p.y - (a.y + m.dir.y * t), p.z - (a.z + m.dir.z * t));
}

// ¿El haz toca a este jugador? (pies, cintura y cabeza)
export function toca(p, a, m, alcance) {
  const l = p.location;
  for (const h of [0.15, 0.9, 1.65]) {
    if (distSegmento({ x: l.x, y: l.y + h, z: l.z }, a, m) <= alcance + 0.3) return true;
  }
  return false;
}

// Cinta de brillo a lo largo del haz (siempre mira a la cámara).
function brillo(dim, a, m, color, grosor) {
  particula(dim, `claudenpc:laser_halo_${color}`, { x: a.x + m.dx / 2, y: a.y + m.dy / 2, z: a.z + m.dz / 2 },
    { "variable.dir": m.dir, "variable.largo": m.largo, "variable.ancho": ANCHO[grosor] });
}

// Motas de energía a lo largo del haz (como mucho 10 grupos).
function motas(dim, a, m, color) {
  const paso = Math.max(2, m.largo / 10);
  for (let d = paso * Math.random(); d < m.largo; d += paso) {
    particula(dim, `claudenpc:laser_chispas_${color}`, { x: a.x + m.dir.x * d, y: a.y + m.dir.y * d, z: a.z + m.dir.z * d });
  }
}

function golpear(dim, a, m, grosor, golpe, heridos) {
  let lista = [];
  try {
    lista = dim.getPlayers({ location: { x: a.x + m.dx / 2, y: a.y + m.dy / 2, z: a.z + m.dz / 2 }, maxDistance: m.largo / 2 + 3,
      excludeGameModes: [GameMode.Creative, GameMode.Spectator] });
  } catch {
    return;
  }
  for (const p of lista) {
    try {
      if (heridos.has(p.id) || !toca(p, a, m, golpe.alcance ?? ALCANCE[grosor])) continue;
      if (golpe.alcanza && !golpe.alcanza(p)) continue;
      heridos.add(p.id);
      danar(p, golpe.dano, golpe.golden);
      golpe.alPegar?.(p);
      particula(dim, `claudenpc:laser_chispas_${golpe.color ?? "oro"}`, { x: p.location.x, y: p.location.y + 1, z: p.location.z });
      soundAt(dim, p.location, "random.fizz", 1.6, 0.6);
    } catch {
      // Jugador no disponible.
    }
  }
}

// Dispara un láser de "desde" a "hasta". Opciones:
//   color ("amarillo", "azul", "morado", "oro"), grosor (0 fino - 3 enorme), vida (ticks antes de
//   apagarse), sonido (true), motas (true), impacto (destello y anillo al final),
//   golpe: { golden, dano, activo (ticks que hace daño), alcanza(p), alPegar(p), alcance }.
export function laser(dim, desde, hasta, op = {}) {
  const color = COLORES.includes(op.color) ? op.color : "oro";
  const grosor = Math.max(0, Math.min(3, op.grosor ?? 1));
  const vida = op.vida ?? 10;
  const m = medir(desde, hasta);
  if (m.largo < 0.3) return undefined;
  const n = Math.max(1, Math.min(MAX, Math.round(m.largo / PASO)));
  const inclina = Math.max(0, Math.min(90, Math.round(m.pitch / 2) + 45));
  const estilo = COLORES.indexOf(color) + 4 * grosor;
  let e;
  try {
    e = dim.spawnEntity(FINAL.laser, desde, { initialRotation: m.yaw, spawnEvent: `claudenpc:estilo_${estilo}` });
    e.triggerEvent(`claudenpc:inclina_${inclina}`);
    e.triggerEvent(`claudenpc:largo_${n}`);
  } catch {
    e = undefined;
  }
  particula(dim, `claudenpc:laser_destello_${color}`, desde);
  particula(dim, `claudenpc:laser_estrella_${color}`, desde);
  brillo(dim, desde, m, color, grosor);
  if (op.motas !== false) motas(dim, desde, m, color);
  if (op.impacto) {
    particula(dim, `claudenpc:laser_destello_${color}`, hasta);
    particula(dim, `claudenpc:laser_chispas_${color}`, hasta);
  }
  if (op.sonido !== false) soundAt(dim, desde, SONIDO.laserDisparo, TONO[color] * (0.94 + Math.random() * 0.12), grosor >= 2 ? 1 : 0.7);
  const heridos = new Set();
  const golpe = op.golpe ? { color, ...op.golpe } : undefined;
  if (golpe) golpear(dim, desde, m, grosor, golpe, heridos);
  let t = 0;
  const id = system.runInterval(() => {
    t++;
    try {
      if (t % 3 === 0 && t < vida) brillo(dim, desde, m, color, grosor);
      if (golpe && t <= (golpe.activo ?? 3)) golpear(dim, desde, m, grosor, golpe, heridos);
      if (t === vida && e?.isValid) e.playAnimation("animation.claudenpc.laser.apagar", { controller: "claudenpc_laser_fin", blendOutTime: 0 });
      if (t >= vida + 7) {
        system.clearRun(id);
        if (e?.isValid) e.remove();
      }
    } catch {
      system.clearRun(id);
      try {
        if (e?.isValid) e.remove();
      } catch {
        // Ya no existe.
      }
    }
  }, 1);
  return { e, desde, hasta, m };
}

// Abanico de láseres que acompaña un corte de espada (estilo Dusttrust): los haces salen de la
// hoja uno tras otro siguiendo el arco del corte, muy rápido. "lado": 1 espada derecha (corta de
// arriba a la derecha hacia abajo a la izquierda), 2 izquierda (al revés), 0 las dos (una X).
// Por defecto son de adorno; con "golpe" también hacen daño.
export function tajos(g, lado, color, op = {}) {
  const e = g.entidad;
  const dim = e.dimension;
  let yaw = 0;
  try {
    yaw = e.getRotation().y;
  } catch {
    return;
  }
  const largo = op.largo ?? 22;
  const pasos = op.pasos ?? 4;
  const lados = lado === 0 ? [1, 2] : [lado];
  for (const l of lados) {
    const s = l === 1 ? 1 : -1; // derecha (+) o izquierda (-) de Golden
    const mano = punto(e.location, yaw, 0.7, 1.5, 0.5 * s);
    const colorLado = Array.isArray(color) ? color[l - 1] : color;
    for (let i = 0; i < pasos; i++) {
      const k = pasos === 1 ? 0.5 : i / (pasos - 1);
      // De arriba a su lado hacia abajo al otro lado.
      const dy = -40 * s * (k - 0.5) * 2; // grados de giro (positivo: hacia su derecha)
      const dp = -26 + 54 * k; // de arriba (-) hacia abajo (+)
      system.runTimeout(() => {
        try {
          if (!e.isValid) return;
          laser(dim, mano, hacia(mano, yaw + dy, dp, largo + Math.random() * 6),
            { color: colorLado, grosor: op.grosor ?? (i === pasos - 1 ? 1 : 0), vida: op.vida ?? 4, motas: i % 2 === 0,
              sonido: i === 0, golpe: op.golpe });
        } catch {
          // Golden descargado.
        }
      }, i);
    }
  }
}

// Carga: motas de energía que se juntan en la espada (aviso) y su zumbido.
export function cargar(dim, lugar, color, jugadores) {
  particula(dim, `claudenpc:laser_carga_${color}`, lugar);
  soundAt(dim, lugar, SONIDO.laserCarga, TONO[color], 0.9);
  for (const p of jugadores ?? []) {
    try {
      p.playSound(SONIDO.laserCarga, { pitch: TONO[color], volume: 0.5 });
    } catch {
      // Sin sonido.
    }
  }
}

// Aviso "!" (partículas: no se puede golpear ni romper) flotando sobre donde va a pegar.
export function avisoExcl(dim, lugar, color, t = 0) {
  const c = COLORES.includes(color) ? color : "oro";
  const p = { x: lugar.x, y: lugar.y + 1.9 + Math.sin(t * 0.4) * 0.12, z: lugar.z };
  particula(dim, `claudenpc:aviso_excl_halo_${c}`, p);
  particula(dim, `claudenpc:aviso_excl_${c}`, p);
}
