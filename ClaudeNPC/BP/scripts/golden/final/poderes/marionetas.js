import { system, world } from "@minecraft/server";
import { FINAL, GOLDEN_FINAL, PARTICLES, SONIDO } from "../../../config.js";
import { alSensor, EVENTO } from "../../../dano.js";
import { now, particleAt, soundAt } from "../../../util.js";
import { estallido } from "../../comun.js";
import { limitar } from "../arena.js";
import { ejes, particula, pose, punto, tira } from "../comun.js";

// Marionetas (v9.0): Golden alza el brazo y de sus dedos salen CUERDAS AMARILLAS atadas al
// corazón de cada marioneta. Cada cuerda es una cinta sólida (no brilla) que siempre mira a la
// cámara, como las riendas de Minecraft: se ve redonda desde cualquier lado y va exactamente de
// los dedos de Golden al corazón, sin depender de cómo gire una entidad.
// Las marionetas son propias (zombi, husk, ahogado, aldeano zombi, esqueleto con arco, stray,
// bogged y el aldeano que ataca): los ojos amarillos y el corazón enredado son parte de SU
// MODELO (una segunda capa con los mismos huesos), así que se mueven con su cabeza y su pecho y
// no se despegan ni parpadean aunque corran o salten. Solo atacan al jugador: entre ellas no se
// hacen daño ni le hacen daño a Golden (sus sensores de daño). Duran 2 minutos o hasta que les
// das el golpe final: no mueren, se deshacen en polvo dorado y no sueltan nada.

const TAG = "claudenpc_marioneta";
// Corazón (en bloques): alto del centro, adelante del eje del cuerpo y hacia su izquierda.
const PECHO = { pecho: 19.6 / 16, frente: 2.5 / 16, izq: 1.3 / 16 };
const PECHO_ANCHO = { pecho: 19.6 / 16, frente: 3.5 / 16, izq: 1.3 / 16 }; // cuerpo de aldeano (más grueso)
const TIPOS = [
  { id: FINAL.marionetaZombi, aspecto: 0, ...PECHO }, // zombi
  { id: FINAL.marionetaZombi, aspecto: 1, ...PECHO }, // husk
  { id: FINAL.marionetaZombi, aspecto: 2, ...PECHO }, // ahogado
  { id: FINAL.marionetaZombi, aspecto: 3, ...PECHO_ANCHO }, // aldeano zombi
  { id: FINAL.marionetaEsqueleto, aspecto: 0, ...PECHO }, // esqueleto
  { id: FINAL.marionetaEsqueleto, aspecto: 1, ...PECHO }, // stray
  { id: FINAL.marionetaEsqueleto, aspecto: 2, ...PECHO }, // bogged
];
// El aldeano marioneta se dibuja al 93,75 % (como los aldeanos).
const ALDEANO = { id: FINAL.aldeano, escala: 0.9375, ...PECHO_ANCHO };
export const TIPOS_MARIONETA = [FINAL.marionetaZombi, FINAL.marionetaEsqueleto, FINAL.aldeano];
// El juego dibuja a un mob que camina unos 2 ticks atrasado: la cuerda apunta ahí.
const ATRASO = 2;

function mezclar(lista) {
  return lista.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
}

function crearMob(dim, tipo, lugar) {
  for (let intento = 0; intento < 3; intento++) {
    try {
      return tipo.aspecto === undefined ? dim.spawnEntity(tipo.id, lugar)
        : dim.spawnEntity(tipo.id, lugar, { spawnEvent: `claudenpc:aspecto_${tipo.aspecto}` });
    } catch {
      // Lugar no válido: otro intento un poco más arriba.
      lugar = { x: lugar.x, y: lugar.y + 1, z: lugar.z };
    }
  }
  return undefined;
}

export default {
  id: "marionetas",
  cd: 1500,
  si: (c) => c.marionetas === 0,
  peso: (_c) => 2,
  usar(g, j) {
    const e = g.entidad;
    const dim = e.dimension;
    const f = g.final;
    f.marionetas = f.marionetas ?? [];
    g.quietoHasta = now() + 56;
    pose(g, 10);
    soundAt(dim, e.location, "beacon.power", 0.8, 1.2);
    const elegidos = [ALDEANO, ...mezclar(TIPOS).slice(0, Math.max(0, GOLDEN_FINAL.marionetas.cantidad - 1))];
    elegidos.forEach((tipo, k) => {
      system.runTimeout(() => {
        if (!e.isValid || !j.isValid || f.etapa !== "pelea") return;
        const a = (k / elegidos.length) * Math.PI * 2 + Math.random() * 0.5;
        const r = 4.5 + Math.random() * 2.5;
        const lugar = limitar(f.arena, { x: j.location.x + Math.cos(a) * r, y: j.location.y + 0.1, z: j.location.z + Math.sin(a) * r }, 3);
        const m = crearMob(dim, tipo, lugar);
        if (!m) return;
        try {
          m.addTag(TAG);
          for (const [ef, amp] of [["strength", 0], ["speed", 0], ["resistance", 0]]) {
            m.addEffect(ef, GOLDEN_FINAL.marionetas.duran, { amplifier: amp, showParticles: false });
          }
        } catch {
          // Sin efectos.
        }
        f.marionetas.push({ m, tipo, hasta: now() + GOLDEN_FINAL.marionetas.duran, k, historia: [] });
        particleAt(dim, PARTICLES.fusionDestello, { x: lugar.x, y: lugar.y + 1, z: lugar.z });
        particleAt(dim, PARTICLES.curacion, lugar);
        soundAt(dim, lugar, "mob.evocation_illager.prepare_summon", 1.2, 0.8);
        soundAt(dim, lugar, SONIDO.latido, 1.4, 0.6);
      }, 10 + k * 5);
    });
    system.runTimeout(() => e.isValid && pose(g, 0), 56);
    return 58;
  },
};

function polvo(m) {
  try {
    if (!m.isValid) return;
    const p = { x: m.location.x, y: m.location.y + 1, z: m.location.z };
    estallido(m.dimension, p);
    particleAt(m.dimension, PARTICLES.fragmento, p);
    soundAt(m.dimension, p, "random.fizz", 1.2, 0.8);
  } catch {
    // Ya no existe.
  }
}

function quitar(ent) {
  try {
    if (ent?.isValid) ent.remove();
  } catch {
    // Ya no existe.
  }
}

function deshacer(x, efecto = true) {
  if (efecto) polvo(x.m);
  quitar(x.m);
}

export function quitarMarionetas(g, efecto = true) {
  for (const x of g.final?.marionetas ?? []) deshacer(x, efecto);
  if (g.final) g.final.marionetas = [];
}

// La punta de los dedos de Golden (un poco separada para cada cuerda).
function manoDe(g, k = 0) {
  const e = g.entidad;
  const yaw = e.getRotation().y;
  const { adelante, derecha } = ejes(yaw);
  const base = g.pose === 10 ? punto(e.location, yaw, 0.42, 2.35, 0.15)
    : { x: e.location.x + adelante.x * 0.4 + derecha.x * 0.4, y: e.location.y + 1.0, z: e.location.z + adelante.z * 0.4 + derecha.z * 0.4 };
  return { x: base.x + derecha.x * (k - 2.5) * 0.04, y: base.y + (k % 3) * 0.03, z: base.z + derecha.z * (k - 2.5) * 0.04 };
}

// Dónde está el corazón del mob (con su posición y su mirada en ese tick).
function corazonDe(t, estado) {
  const { pos, mira } = estado;
  const lh = Math.hypot(mira.x, mira.z) || 1;
  const fx = mira.x / lh;
  const fz = mira.z / lh;
  const k = t.escala ?? 1;
  // Su izquierda es (fz, -fx).
  return { x: pos.x + (fx * t.frente + fz * t.izq) * k, y: pos.y + t.pecho * k, z: pos.z + (fz * t.frente - fx * t.izq) * k };
}

// La cuerda de "a" (los dedos de Golden) a "b" (el corazón) y un nudo en cada punta.
export function atar(dim, a, b) {
  tira(dim, "claudenpc:cuerda_v9", a, b);
  particula(dim, "claudenpc:cuerda_nudo", b);
  particula(dim, "claudenpc:cuerda_nudo", a);
}

// Cada tick: las cuerdas van de los dedos de Golden al corazón de cada marioneta. Se cortan a
// los 2 minutos o cuando la marioneta se deshace.
export function tickMarionetas(g, _jugadores) {
  const f = g.final;
  if (!f.marionetas?.length) return;
  f.marionetas = f.marionetas.filter((x) => {
    if (!x.m.isValid || now() > x.hasta) {
      deshacer(x, x.m.isValid);
      return false;
    }
    try {
      const ahora = { pos: { ...x.m.location }, mira: x.m.getViewDirection() };
      x.historia = [ahora, ...(x.historia ?? [])].slice(0, ATRASO + 1);
      const visto = x.historia[Math.min(ATRASO, x.historia.length - 1)];
      atar(x.m.dimension, manoDe(g, x.k), corazonDe(x.tipo, visto));
    } catch {
      // Mob no disponible.
    }
    return true;
  });
}

// El golpe que la mataría no se aplica (su sensor): se deshace en polvo dorado, sin soltar nada.
alSensor(EVENTO.fatal, TIPOS_MARIONETA, (m) => {
  polvo(m);
  quitar(m);
});

// Las marionetas no rompen bloques con explosiones.
world.beforeEvents.explosion.subscribe((ev) => {
  try {
    if (ev.source?.hasTag(TAG)) ev.setImpactedBlocks([]);
  } catch {
    // Sin fuente.
  }
});

// Por si el mundo se cerró: marionetas sueltas (y cosas de la v8.2) se deshacen.
export function limpiarMarionetasHuerfanas(dim, vigentes) {
  try {
    for (const m of dim.getEntities({ tags: [TAG] })) if (!vigentes.has(m.id)) m.remove();
    for (const tipo of [...TIPOS_MARIONETA, FINAL.marioneta]) {
      for (const m of dim.getEntities({ type: tipo })) if (!vigentes.has(m.id)) m.remove();
    }
  } catch {
    // Dimensión sin cargar.
  }
}
